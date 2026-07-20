import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STATUS_APIS } from "@/server/integrations/config";
import { makeStatusApiCall } from "@/server/integrations/statusApi";
import { callWithCadFallback } from "@/server/integrations/withCadFallback";
import {
  deriveIntegrationCategory,
  computeIsInefficient,
  type StatusResultBySource,
} from "@/server/services/classification";
import type { JobOutcome, StatusCheckJob } from "../jobs";

// Job C: API 3–8 ni fallback bilan chaqiradi, natijalarni yozadi, kategoriyalaydi.
// Muvaffaqiyatli tugasa "success" qaytaradi (worker hisoblagichni oshiradi).
export async function processStatusCheck(data: StatusCheckJob): Promise<JobOutcome> {
  const { propertyId, cadNumber, cadNumberOld } = data;

  // Hech bir holat-API sozlanmagan bo'lsa — soxta "topilmadi" yozuvlarini yozmaymiz.
  // Obyekt SYNCED bo'ladi, kategoriya qo'lda biriktirilishi kutiladi.
  if (STATUS_APIS.length === 0) {
    const current = await prisma.property.findUniqueOrThrow({
      where: { id: propertyId },
      select: { integrationCategoryCode: true, manualCategoryCode: true },
    });
    await prisma.property.update({
      where: { id: propertyId },
      data: {
        isInefficient: computeIsInefficient(current.integrationCategoryCode, current.manualCategoryCode),
        syncStatus: "SYNCED",
        lastSyncedAt: new Date(),
        lastSyncError: null,
      },
    });
    return "success";
  }

  // Barcha holat-API'lar parallel (per-API rate-limit rateGuard bilan boshqariladi).
  const results: StatusResultBySource[] = await Promise.all(
    STATUS_APIS.map(async (cfg) => {
      const call = makeStatusApiCall(cfg);
      const res = await callWithCadFallback(call, cadNumber, cadNumberOld);
      return { ...res, source: cfg.source };
    }),
  );

  // Natijalarni saqlash + kategoriyalash + isInefficient — bitta tranzaksiyada.
  await prisma.$transaction(async (tx) => {
    for (const r of results) {
      await tx.objectStatusCheck.upsert({
        where: { propertyId_apiSource: { propertyId, apiSource: r.source } },
        create: {
          propertyId,
          apiSource: r.source,
          found: r.found,
          matchedByOldCad: r.matchedByOldCad,
          status: r.status ?? null,
          rawResponse: (r.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
        update: {
          found: r.found,
          matchedByOldCad: r.matchedByOldCad,
          status: r.status ?? null,
          rawResponse: (r.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          checkedAt: new Date(),
        },
      });
    }

    const integrationCategoryCode = deriveIntegrationCategory(results);
    const current = await tx.property.findUniqueOrThrow({
      where: { id: propertyId },
      select: { manualCategoryCode: true },
    });
    const isInefficient = computeIsInefficient(integrationCategoryCode, current.manualCategoryCode);

    await tx.property.update({
      where: { id: propertyId },
      data: {
        integrationCategoryCode,
        isInefficient,
        syncStatus: "SYNCED",
        lastSyncedAt: new Date(),
        lastSyncError: null,
      },
    });
  });

  return "success";
}
