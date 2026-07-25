import { unlink } from "node:fs/promises";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertRegionWriteAccess, userRegionScope, isAdmin, type SessionUser } from "@/lib/authz";
import { computeIsInefficient, CAT_VACANT } from "./classification";
import { ASSIGNABLE_CATEGORY_CODES } from "@/lib/categories";
import { objectHref } from "@/lib/cadastre";
import { saveDocumentFile, resolveDocumentPath, MAX_IMAGE_ATTACHMENTS, type SavedDocument } from "./documents";
import { notify } from "./notifications";

export interface AssignInput {
  cadNumber: string;
  categoryCode: number; // faqat 9 (Yaroqsiz) yoki 10 (Chekka)
  note?: string;
  file?: File | null; // asoslovchi PDF — majburiy
  images?: File[]; // ixtiyoriy ilova rasmlari, MAX_IMAGE_ATTACHMENTS tagacha
}

// Kategoriya biriktirish / so'rov yuborish.
//  - IJROCHI → so'rov (CategoryChangeRequest → PENDING_MODERATOR, darhol qo'llanmaydi)
//  - ADMIN/SUPER_ADMIN → darhol qo'llaydi
//  - MODERATOR/RAHBARIYAT → to'g'ridan-to'g'ri biriktirmaydi, faqat so'rovni ko'rib chiqadi
// Har ikki holatda ham faqat 9/10 kategoriyalari va faqat "Bo'sh turgan" obyektlar uchun.
export async function assignManualCategory(user: SessionUser, input: AssignInput) {
  if (user.role !== "IJROCHI" && !isAdmin(user.role)) {
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

  const images = (input.images ?? []).filter((f) => f instanceof File && f.size > 0);
  if (images.length > MAX_IMAGE_ATTACHMENTS) {
    throw new Error(`Ko'pi bilan ${MAX_IMAGE_ATTACHMENTS} ta rasm yuklash mumkin`);
  }

  // Ruxsat: ijrochi o'z hududi; admin — hamma. (VIEWER umuman kirmaydi.)
  await assertRegionWriteAccess(user, property.regionId);

  // Fayllarni oldin saqlaymiz (tranzaksiyadan tashqarida). Tx yiqilsa — hammasini o'chiramiz.
  const saved: SavedDocument[] = [];
  try {
    saved.push(
      await saveDocumentFile(input.file as File, {
        regionId: property.regionId,
        cadNumber: input.cadNumber,
        kind: "pdf",
      }),
    );
    for (const img of images) {
      saved.push(
        await saveDocumentFile(img, {
          regionId: property.regionId,
          cadNumber: input.cadNumber,
          kind: "image",
        }),
      );
    }
  } catch (err) {
    await cleanupFiles(saved.map((s) => s.storageKey));
    throw err;
  }

  const [savedPdf, ...savedImages] = saved;
  const isIjrochi = user.role === "IJROCHI";

  try {
    await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          propertyId: property.id,
          uploadedById: user.id,
          storageKey: savedPdf.storageKey,
          fileName: savedPdf.fileName,
          fileSize: savedPdf.fileSize,
          mimeType: savedPdf.mimeType,
        },
      });

      // Rasmlar PDF'ning "bolalari" — PDF o'chsa ular ham kaskad o'chadi.
      for (const img of savedImages) {
        await tx.document.create({
          data: {
            propertyId: property.id,
            uploadedById: user.id,
            storageKey: img.storageKey,
            fileName: img.fileName,
            fileSize: img.fileSize,
            mimeType: img.mimeType,
            parentId: doc.id,
          },
        });
      }

      if (isIjrochi) {
        // SO'ROV — darhol qo'llanmaydi, avval moderator, keyin rahbariyat ko'radi.
        await tx.categoryChangeRequest.create({
          data: {
            propertyId: property.id,
            requestedById: user.id,
            fromCategory: effective,
            toCategory: input.categoryCode,
            note: input.note?.trim() || null,
            documentId: doc.id,
            status: "PENDING_MODERATOR",
          },
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: "REQUEST_CATEGORY",
            entityType: "Property",
            entityId: property.id,
            metadata: { toCategory: input.categoryCode, images: savedImages.length },
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
            metadata: { categoryCode: input.categoryCode, images: savedImages.length },
          },
        });
      }
    });
  } catch (err) {
    await cleanupFiles(saved.map((s) => s.storageKey));
    throw err;
  }

  return { requested: isIjrochi };
}

// Qo'lda biriktirilgan kategoriyani (9/10) olib tashlash — obyekt yana "Bo'sh turgan"ga
// qaytadi (manualCategoryCode = null). ADMIN/SUPER_ADMIN va RAHBARIYAT uchun, darhol qo'llanadi.
// ⚠️ Sabab MAJBURIY va `PropertyCategoryAssignment`ga 11-kategoriya yozuvi sifatida
// saqlanadi — shunda "Biriktirishlar tarixi"da nima uchun qaytarilgani ko'rinadi.
export async function removeManualCategory(user: SessionUser, cadNumber: string, note?: string) {
  if (!isAdmin(user.role) && user.role !== "RAHBARIYAT") {
    throw new Error("Ruxsat yo'q");
  }

  const reason = note?.trim() || null;
  if (!reason) throw new Error("Kategoriyani qaytarish sababini yozing");

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
  // yo'qoladi — Document.documentId FK "ON DELETE SET NULL"). Ilova rasmlari kaskad o'chadi.
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
    // Qaytarish ham tarixda qoladi: 11 (Bo'sh turgan) yozuvi + sabab.
    await tx.propertyCategoryAssignment.create({
      data: {
        propertyId: property.id,
        categoryCode: CAT_VACANT,
        assignedById: user.id,
        note: reason,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "REMOVE_CATEGORY",
        entityType: "Property",
        entityId: property.id,
        metadata: { fromCategory: property.manualCategoryCode, reason },
      },
    });
    if (documentIds.length > 0) {
      // Rasmlar (children) DB'da kaskad o'chadi, lekin diskdan o'chirish uchun
      // ularning storageKey'lari ham kerak.
      const docs = await tx.document.findMany({
        where: { OR: [{ id: { in: documentIds } }, { parentId: { in: documentIds } }] },
        select: { storageKey: true },
      });
      deletedStorageKeys = docs.map((d) => d.storageKey);
      await tx.document.deleteMany({ where: { id: { in: documentIds } } });
    }
  });

  await cleanupFiles(deletedStorageKeys);
}

// ── So'rovlarni ko'rib chiqish (2 bosqich) ──

// Rol qaysi bosqichdagi so'rovlarni ko'ra oladi.
//  MODERATOR   → PENDING_MODERATOR (o'z hududlari)
//  RAHBARIYAT  → PENDING_RAHBARIYAT (hamma hudud)
//  ADMIN/SUPER → ikkala bosqich ham
export function reviewableStages(role: SessionUser["role"]): ("PENDING_MODERATOR" | "PENDING_RAHBARIYAT")[] {
  if (isAdmin(role)) return ["PENDING_MODERATOR", "PENDING_RAHBARIYAT"];
  if (role === "MODERATOR") return ["PENDING_MODERATOR"];
  if (role === "RAHBARIYAT") return ["PENDING_RAHBARIYAT"];
  return [];
}

// Foydalanuvchining ko'rib chiqish doirasidagi kutilayotgan so'rovlar.
export async function listPendingRequests(user: SessionUser) {
  const stages = reviewableStages(user.role);
  if (stages.length === 0) return [];

  // Hudud doirasi faqat moderator bosqichida ma'noga ega — rahbariyat hamma hududni ko'radi.
  const scope = await userRegionScope(user); // null = cheklovsiz

  const where: Prisma.CategoryChangeRequestWhereInput = {
    status: { in: stages },
    ...(scope === null ? {} : { property: { regionId: { in: scope } } }),
  };

  return prisma.categoryChangeRequest.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      property: { select: { cadNumber: true, region: { select: { name: true } } } },
      requestedBy: { select: { fullName: true, username: true } },
      moderator: { select: { fullName: true } },
      document: {
        select: {
          id: true,
          fileName: true,
          children: { select: { id: true, fileName: true }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
}

/**
 * So'rovlar TARIXI — har bir rol uchun, o'z doirasida:
 *  - IJROCHI   → faqat o'zi yuborgan so'rovlar
 *  - MODERATOR → biriktirilgan hudud(lar)idagi so'rovlar
 *  - RAHBARIYAT / ADMIN / SUPER_ADMIN / VIEWER → hammasi
 * Kutilayotganlar ham kiradi (ijrochi o'z so'rovi qayerda turganini ko'rishi kerak).
 */
export async function listRequestHistory(user: SessionUser, limit = 200) {
  const where: Prisma.CategoryChangeRequestWhereInput = {};

  if (user.role === "IJROCHI") {
    where.requestedById = user.id;
  } else if (user.role === "MODERATOR") {
    const scope = await userRegionScope(user);
    if (scope !== null) where.property = { regionId: { in: scope } };
  }

  return prisma.categoryChangeRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      property: { select: { cadNumber: true, region: { select: { name: true } } } },
      requestedBy: { select: { fullName: true } },
      moderator: { select: { fullName: true } },
      rahbar: { select: { fullName: true } },
      document: {
        select: {
          id: true,
          fileName: true,
          children: { select: { id: true, fileName: true }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
}

/**
 * So'rovni ko'rib chiqish. Bosqichga qarab natija boshqacha:
 *  - PENDING_MODERATOR + qabul  → PENDING_RAHBARIYAT (kategoriya HALI qo'llanmaydi)
 *  - PENDING_RAHBARIYAT + qabul → APPROVED + kategoriya qo'llanadi
 *  - istalgan bosqichda rad     → REJECTED, hujjatlar o'chadi, sabab bilan xabar boradi
 * Rad etishda sabab MAJBURIY — ijrochi nima uchun rad etilganini bilishi kerak.
 */
export async function reviewRequest(
  user: SessionUser,
  requestId: string,
  approve: boolean,
  reviewNote?: string,
) {
  const note = reviewNote?.trim() || null;
  if (!approve && !note) throw new Error("Rad etish sababini yozing");

  const req = await prisma.categoryChangeRequest.findUnique({
    where: { id: requestId },
    include: {
      property: { select: { id: true, cadNumber: true, regionId: true, integrationCategoryCode: true } },
    },
  });
  if (!req) throw new Error("So'rov topilmadi");

  const stages = reviewableStages(user.role);
  if (!stages.includes(req.status as (typeof stages)[number])) {
    throw new Error(
      req.status === "PENDING_MODERATOR"
        ? "Bu so'rovni avval moderator ko'rib chiqishi kerak"
        : req.status === "PENDING_RAHBARIYAT"
          ? "Bu so'rov rahbariyat tasdig'ini kutmoqda"
          : "So'rov allaqachon ko'rib chiqilgan",
    );
  }

  // Moderator bosqichida hudud cheklovi tekshiriladi (rahbariyat/admin — cheklovsiz).
  await assertRegionWriteAccess(user, req.property.regionId);

  const isModeratorStage = req.status === "PENDING_MODERATOR";
  const now = new Date();

  // Rad etilsa — yuklangan PDF va rasmlar ham o'chiriladi (DB tx ichida, fayllar keyin).
  let deletedStorageKeys: string[] = [];

  await prisma.$transaction(async (tx) => {
    const stageData: Prisma.CategoryChangeRequestUpdateInput = isModeratorStage
      ? { moderator: { connect: { id: user.id } }, moderatorNote: note, moderatorAt: now }
      : { rahbar: { connect: { id: user.id } }, rahbarNote: note, rahbarAt: now };

    await tx.categoryChangeRequest.update({
      where: { id: requestId },
      data: {
        ...stageData,
        status: !approve ? "REJECTED" : isModeratorStage ? "PENDING_RAHBARIYAT" : "APPROVED",
      },
    });

    if (approve && !isModeratorStage) {
      // Yakuniy tasdiq — kategoriya endi qo'llanadi.
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
    } else if (!approve && req.documentId) {
      const docs = await tx.document.findMany({
        where: { OR: [{ id: req.documentId }, { parentId: req.documentId }] },
        select: { storageKey: true },
      });
      deletedStorageKeys = docs.map((d) => d.storageKey);
      await tx.document.delete({ where: { id: req.documentId } });
    }

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: !approve
          ? "REJECT_REQUEST"
          : isModeratorStage
            ? "ACCEPT_REQUEST_MODERATOR"
            : "APPROVE_REQUEST",
        entityType: "CategoryChangeRequest",
        entityId: requestId,
        metadata: { toCategory: req.toCategory, stage: req.status },
      },
    });
  });

  await cleanupFiles(deletedStorageKeys);

  // ── Bildirishnomalar ──
  const link = objectHref(req.property.cadNumber);
  const cad = req.property.cadNumber;
  const reason = note ? `: ${note}` : "";

  if (!approve) {
    const who = isModeratorStage ? "Moderator" : "Rahbariyat";
    await notify(req.requestedById, `${cad} — kategoriya so'rovingiz rad etildi (${who})${reason}`, link);
    // Rahbariyat rad etsa, qabul qilgan moderator ham bilishi kerak.
    if (!isModeratorStage && req.moderatorId && req.moderatorId !== req.requestedById) {
      await notify(req.moderatorId, `${cad} — siz qabul qilgan so'rovni rahbariyat rad etdi${reason}`, link);
    }
  } else if (isModeratorStage) {
    await notify(
      req.requestedById,
      `${cad} — so'rovingiz moderator tomonidan qabul qilindi, rahbariyat tasdig'i kutilmoqda${reason}`,
      link,
    );
  } else {
    await notify(req.requestedById, `${cad} — kategoriya so'rovingiz rahbariyat tomonidan tasdiqlandi${reason}`, link);
    if (req.moderatorId && req.moderatorId !== req.requestedById) {
      await notify(req.moderatorId, `${cad} — siz qabul qilgan so'rov rahbariyat tomonidan tasdiqlandi`, link);
    }
  }
}

// Diskdagi fayllarni o'chirish (xato bo'lsa jim o'tadi — DB allaqachon izchil).
async function cleanupFiles(storageKeys: string[]) {
  await Promise.all(
    storageKeys.map((key) =>
      unlink(resolveDocumentPath(key)).catch(() => {}),
    ),
  );
}
