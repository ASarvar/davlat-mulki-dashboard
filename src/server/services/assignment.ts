import { unlink } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { assertRegionWriteAccess, type SessionUser } from "@/lib/authz";
import { computeIsInefficient } from "./classification";
import { saveDocumentFile, resolveDocumentPath } from "./documents";

export interface AssignInput {
  cadNumber: string;
  categoryCode: number; // qo'lda tanlanadigan (5–10)
  note?: string;
  file?: File | null;
}

// Hududga biriktirilgan user obyektga qo'lda kategoriya (5–10) va asoslovchi PDF biriktiradi.
// isInefficient qayta hisoblanadi, audit yoziladi. Hammasi bitta tranzaksiyada.
export async function assignManualCategory(user: SessionUser, input: AssignInput) {
  const property = await prisma.property.findUnique({
    where: { cadNumber: input.cadNumber },
    select: { id: true, regionId: true, integrationCategoryCode: true },
  });
  if (!property) throw new Error(`Obyekt topilmadi: ${input.cadNumber}`);

  // Rol/hudud: SUPER_ADMIN yoki o'z hududidagi REGION_USER (VIEWER yoza olmaydi).
  assertRegionWriteAccess(user, property.regionId);

  const category = await prisma.category.findUnique({ where: { code: input.categoryCode } });
  if (!category) throw new Error("Kategoriya topilmadi");
  if (category.source !== "MANUAL") throw new Error("Bu kategoriyani qo'lda biriktirib bo'lmaydi (integratsiyadan keladi)");

  const hasFile = !!input.file && input.file.size > 0;
  if (category.requiresDocument && !hasFile) throw new Error("Ushbu kategoriya uchun asoslovchi PDF majburiy");

  // Faylni oldin saqlaymiz (tranzaksiyadan tashqarida). Tx yiqilsa — o'chiramiz.
  let saved: Awaited<ReturnType<typeof saveDocumentFile>> | null = null;
  if (hasFile) {
    saved = await saveDocumentFile(input.file as File, { regionId: property.regionId, cadNumber: input.cadNumber });
  }

  try {
    const isInefficient = computeIsInefficient(property.integrationCategoryCode, input.categoryCode);

    await prisma.$transaction(async (tx) => {
      let documentId: string | undefined;
      if (saved) {
        const doc = await tx.document.create({
          data: {
            propertyId: property.id,
            uploadedById: user.id,
            storageKey: saved.storageKey,
            fileName: saved.fileName,
            fileSize: saved.fileSize,
          },
        });
        documentId = doc.id;
      }

      await tx.propertyCategoryAssignment.create({
        data: {
          propertyId: property.id,
          categoryCode: input.categoryCode,
          assignedById: user.id,
          documentId,
          note: input.note?.trim() || null,
        },
      });

      await tx.property.update({
        where: { id: property.id },
        data: { manualCategoryCode: input.categoryCode, isInefficient },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "ASSIGN_CATEGORY",
          entityType: "Property",
          entityId: property.id,
          metadata: { categoryCode: input.categoryCode, hasDocument: !!documentId },
        },
      });
    });
  } catch (err) {
    // Tranzaksiya yiqilsa — saqlangan faylni tozalaymiz (orphan qolmasin).
    if (saved) await unlink(resolveDocumentPath(saved.storageKey)).catch(() => {});
    throw err;
  }
}
