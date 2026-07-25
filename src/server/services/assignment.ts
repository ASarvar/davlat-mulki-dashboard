import { unlink } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { assertRegionWriteAccess, userRegionScope, isAdmin, type SessionUser } from "@/lib/authz";
import { computeIsInefficient, CAT_VACANT } from "./classification";
import { ASSIGNABLE_CATEGORY_CODES } from "@/lib/categories";
import { saveDocumentFile, resolveDocumentPath } from "./documents";
import { notify } from "./notifications";

export interface AssignInput {
  cadNumber: string;
  categoryCode: number; // faqat 9 (Yaroqsiz) yoki 10 (Chekka)
  note?: string;
  file?: File | null;
}

// Kategoriya biriktirish / so'rov yuborish.
//  - NAZORATCHI → so'rov (CategoryChangeRequest, darhol qo'llanmaydi, Moderator tasdiqlaydi)
//  - ADMIN/SUPER_ADMIN → darhol qo'llaydi
//  - MODERATOR → to'g'ridan-to'g'ri biriktirish huquqi YO'Q, faqat so'rovlarni ko'rib chiqadi
//    (reviewRequest orqali) — shuning uchun bu yerga kirolmaydi.
// Har ikki holatda ham faqat 9/10 kategoriyalari va faqat "Bo'sh turgan" obyektlar uchun.
export async function assignManualCategory(user: SessionUser, input: AssignInput) {
  if (user.role !== "NAZORATCHI" && !isAdmin(user.role)) {
    throw new Error("Ruxsat yo'q");
  }
  if (!(ASSIGNABLE_CATEGORY_CODES as readonly number[]).includes(input.categoryCode)) {
    throw new Error("Bu kategoriyani qo'lda biriktirib bo'lmaydi");
  }

  const property = await prisma.property.findUnique({
    where: { cadNumber: input.cadNumber },
    select: { id: true, regionId: true, integrationCategoryCode: true, manualCategoryCode: true },
  });
  if (!property) throw new Error(`Obyekt topilmadi: ${input.cadNumber}`);

  // Faqat "Bo'sh turgan" (effektiv 11) obyektni biriktirish mumkin.
  // `integrationCategoryCode`/`manualCategoryCode` ikkalasi ham null bo'lsa — bu ham
  // "Bo'sh turgan" hisoblanadi (CAT_VACANT ustunga yozilmaydi, faqat effektiv fallback).
  const effective = property.integrationCategoryCode ?? property.manualCategoryCode ?? CAT_VACANT;
  if (effective !== CAT_VACANT) {
    throw new Error("Faqat 'Bo'sh turgan' obyektni Yaroqsiz/Chekka kategoriyaga biriktirish mumkin");
  }

  const category = await prisma.category.findUnique({ where: { code: input.categoryCode } });
  if (!category) throw new Error("Kategoriya topilmadi");

  const hasFile = !!input.file && input.file.size > 0;
  if (!hasFile) throw new Error("Asoslovchi PDF majburiy");

  // Faylni oldin saqlaymiz (tranzaksiyadan tashqarida). Tx yiqilsa — o'chiramiz.
  const saved = await saveDocumentFile(input.file as File, {
    regionId: property.regionId,
    cadNumber: input.cadNumber,
  });

  const isNazoratchi = user.role === "NAZORATCHI";

  // Ruxsat: nazoratchi/moderator o'z hududi; admin — hamma. (VIEWER umuman kirmaydi.)
  await assertRegionWriteAccess(user, property.regionId);

  try {
    await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          propertyId: property.id,
          uploadedById: user.id,
          storageKey: saved.storageKey,
          fileName: saved.fileName,
          fileSize: saved.fileSize,
        },
      });

      if (isNazoratchi) {
        // SO'ROV — darhol qo'llanmaydi.
        await tx.categoryChangeRequest.create({
          data: {
            propertyId: property.id,
            requestedById: user.id,
            fromCategory: effective,
            toCategory: input.categoryCode,
            note: input.note?.trim() || null,
            documentId: doc.id,
            status: "PENDING",
          },
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: "REQUEST_CATEGORY",
            entityType: "Property",
            entityId: property.id,
            metadata: { toCategory: input.categoryCode },
          },
        });
      } else {
        // DARHOL biriktirish.
        await tx.propertyCategoryAssignment.create({
          data: {
            propertyId: property.id,
            categoryCode: input.categoryCode,
            assignedById: user.id,
            documentId: doc.id,
            note: input.note?.trim() || null,
          },
        });
        await tx.property.update({
          where: { id: property.id },
          data: {
            manualCategoryCode: input.categoryCode,
            isInefficient: computeIsInefficient(property.integrationCategoryCode, input.categoryCode),
          },
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: "ASSIGN_CATEGORY",
            entityType: "Property",
            entityId: property.id,
            metadata: { categoryCode: input.categoryCode },
          },
        });
      }
    });
  } catch (err) {
    if (saved) await unlink(resolveDocumentPath(saved.storageKey)).catch(() => {});
    throw err;
  }

  return { requested: isNazoratchi };
}

// Qo'lda biriktirilgan kategoriyani (9/10) olib tashlash — obyekt yana "Bo'sh turgan"ga
// qaytadi (manualCategoryCode = null). Faqat ADMIN/SUPER_ADMIN uchun (MODERATOR'da
// to'g'ridan-to'g'ri biriktirish/bekor qilish huquqi yo'q), darhol qo'llanadi.
export async function removeManualCategory(user: SessionUser, cadNumber: string) {
  if (!isAdmin(user.role)) {
    throw new Error("Ruxsat yo'q");
  }

  const property = await prisma.property.findUnique({
    where: { cadNumber },
    select: { id: true, regionId: true, integrationCategoryCode: true, manualCategoryCode: true },
  });
  if (!property) throw new Error(`Obyekt topilmadi: ${cadNumber}`);

  if (
    property.manualCategoryCode == null ||
    !(ASSIGNABLE_CATEGORY_CODES as readonly number[]).includes(property.manualCategoryCode)
  ) {
    throw new Error("Obyekt Yaroqsiz/Chekka kategoriyasida emas");
  }

  await assertRegionWriteAccess(user, property.regionId);

  // Bu obyektning 9/10-kategoriya biriktirishlariga asoslovchi PDF'lari — kategoriya
  // olib tashlanganda ular ham o'chiriladi (tarix yozuvi qoladi, faqat hujjat havolasi
  // yo'qoladi — Document.documentId FK "ON DELETE SET NULL").
  const assignmentsWithDocs = await prisma.propertyCategoryAssignment.findMany({
    where: {
      propertyId: property.id,
      categoryCode: { in: [...ASSIGNABLE_CATEGORY_CODES] },
      documentId: { not: null },
    },
    select: { documentId: true },
  });
  const documentIds = assignmentsWithDocs.map((a) => a.documentId!).filter(Boolean);

  let deletedStorageKeys: string[] = [];

  await prisma.$transaction(async (tx) => {
    await tx.property.update({
      where: { id: property.id },
      data: {
        manualCategoryCode: null,
        isInefficient: computeIsInefficient(property.integrationCategoryCode, null),
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "REMOVE_CATEGORY",
        entityType: "Property",
        entityId: property.id,
        metadata: { fromCategory: property.manualCategoryCode },
      },
    });
    if (documentIds.length > 0) {
      const docs = await tx.document.findMany({
        where: { id: { in: documentIds } },
        select: { storageKey: true },
      });
      deletedStorageKeys = docs.map((d) => d.storageKey);
      await tx.document.deleteMany({ where: { id: { in: documentIds } } });
    }
  });

  await Promise.all(deletedStorageKeys.map((key) => unlink(resolveDocumentPath(key)).catch(() => {})));
}

// ── Moderator: so'rovni ko'rib chiqish ──

// Moderatorning tasdiqlash doirasidagi kutilayotgan so'rovlar.
export async function listPendingRequests(user: SessionUser) {
  const scope = await userRegionScope(user); // null = hamma hudud
  return prisma.categoryChangeRequest.findMany({
    where: {
      status: "PENDING",
      ...(scope === null ? {} : { property: { regionId: { in: scope } } }),
    },
    orderBy: { createdAt: "asc" },
    include: {
      property: { select: { cadNumber: true, region: { select: { name: true } } } },
      requestedBy: { select: { fullName: true, username: true } },
      document: { select: { id: true, fileName: true } },
    },
  });
}

export async function reviewRequest(
  user: SessionUser,
  requestId: string,
  approve: boolean,
  reviewNote?: string,
) {
  const req = await prisma.categoryChangeRequest.findUnique({
    where: { id: requestId },
    include: { property: { select: { id: true, cadNumber: true, regionId: true, integrationCategoryCode: true } } },
  });
  if (!req || req.status !== "PENDING") throw new Error("So'rov topilmadi yoki allaqachon ko'rib chiqilgan");

  // Faqat o'z hududidagi so'rovni ko'rib chiqadi.
  await assertRegionWriteAccess(user, req.property.regionId);

  // Rad etilsa — nazoratchi yuklagan PDF ham o'chiriladi (tx ichida DB yozuvi,
  // fayl tranzaksiyadan keyin diskdan o'chiriladi).
  let rejectedDocStorageKey: string | null = null;

  await prisma.$transaction(async (tx) => {
    await tx.categoryChangeRequest.update({
      where: { id: requestId },
      data: {
        status: approve ? "APPROVED" : "REJECTED",
        reviewedById: user.id,
        reviewNote: reviewNote?.trim() || null,
        reviewedAt: new Date(),
      },
    });

    if (approve) {
      await tx.propertyCategoryAssignment.create({
        data: {
          propertyId: req.property.id,
          categoryCode: req.toCategory,
          assignedById: user.id,
          documentId: req.documentId,
          note: req.note,
        },
      });
      await tx.property.update({
        where: { id: req.property.id },
        data: {
          manualCategoryCode: req.toCategory,
          isInefficient: computeIsInefficient(req.property.integrationCategoryCode, req.toCategory),
        },
      });
    } else if (req.documentId) {
      const deletedDoc = await tx.document.delete({ where: { id: req.documentId } });
      rejectedDocStorageKey = deletedDoc.storageKey;
    }

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: approve ? "APPROVE_REQUEST" : "REJECT_REQUEST",
        entityType: "CategoryChangeRequest",
        entityId: requestId,
        metadata: { toCategory: req.toCategory },
      },
    });
  });

  if (rejectedDocStorageKey) {
    await unlink(resolveDocumentPath(rejectedDocStorageKey)).catch(() => {});
  }

  // Nazoratchiga bildirishnoma.
  const verb = approve ? "tasdiqlandi" : "rad etildi";
  await notify(
    req.requestedById,
    `${req.property.cadNumber} obyekti bo'yicha kategoriya so'rovingiz ${verb}${
      reviewNote?.trim() ? `: ${reviewNote.trim()}` : ""
    }`,
    `/dashboard/objects/${req.property.cadNumber
      .split("/")
      .map((s) => encodeURIComponent(s).replace(/%3A/gi, ":"))
      .join("/")}`,
  );
}
