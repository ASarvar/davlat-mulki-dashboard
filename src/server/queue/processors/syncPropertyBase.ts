import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchPropertyBase } from "@/server/integrations/api2";
import { STATUS_APIS } from "@/server/integrations/config";
import { isAuctionConfigured } from "@/server/integrations/auction";
import { isRentApiConfigured } from "@/server/integrations/rentApi";
import { computeIsInefficient } from "@/server/services/classification";
import { enqueueStatusCheck } from "../dispatch";
import type { JobOutcome, PropertyBaseJob } from "../jobs";

// Job B: API 2 orqali obyekt asosiy ma'lumotlarini oladi va bazaga upsert qiladi.
// cad_number_old ni majburiy saqlaydi, so'ng status-check job'ini qo'yadi.
export async function processPropertyBase(data: PropertyBaseJob): Promise<JobOutcome> {
  const { syncRunId, sourceId, regionId, cadNumber } = data;

  const result = await fetchPropertyBase(cadNumber);

  if (!result.ok) {
    // API 2 ma'lumot bermadi — obyektni FAILED belgilaymiz va API xabarini saqlaymiz.
    // Bu leaf "fail" (status-check qo'yilmaydi).
    await prisma.property.upsert({
      where: { cadNumber },
      create: {
        cadNumber,
        regionId,
        sourceId,
        syncStatus: "FAILED",
        lastSyncError: result.reason,
        lastSyncedAt: new Date(),
      },
      update: { syncStatus: "FAILED", lastSyncError: result.reason, lastSyncedAt: new Date() },
    });
    return "fail";
  }

  const base = result.data;

  const property = await prisma.property.upsert({
    where: { cadNumber },
    create: {
      cadNumber,
      cadNumberOld: base.cadNumberOld,
      regionId,
      sourceId,
      name: base.name,
      address: base.address,
      area: base.area != null ? new Prisma.Decimal(base.area) : null,
      buildingArea: base.buildingArea != null ? new Prisma.Decimal(base.buildingArea) : null,
      rawApi2: base.raw as Prisma.InputJsonValue,
      syncStatus: "SYNCING",
    },
    update: {
      cadNumberOld: base.cadNumberOld,
      name: base.name,
      address: base.address,
      area: base.area != null ? new Prisma.Decimal(base.area) : null,
      buildingArea: base.buildingArea != null ? new Prisma.Decimal(base.buildingArea) : null,
      rawApi2: base.raw as Prisma.InputJsonValue,
      syncStatus: "SYNCING",
    },
    select: {
      id: true,
      cadNumber: true,
      cadNumberOld: true,
      integrationCategoryCode: true,
      manualCategoryCode: true,
    },
  });

  // Hech qanday holat-tekshiruvi sozlanmagan bo'lsa — ikkinchi bosqich bo'sh ish bo'lardi.
  // Uni navbatga qo'ymaymiz va obyektni shu yerda yakunlaymiz (bir marta kamroq
  // navbat aylanishi = sezilarli tezlanish).
  if (STATUS_APIS.length === 0 && !isAuctionConfigured() && !isRentApiConfigured()) {
    await prisma.property.update({
      where: { id: property.id },
      data: {
        isInefficient: computeIsInefficient(property.integrationCategoryCode, property.manualCategoryCode),
        syncStatus: "SYNCED",
        lastSyncedAt: new Date(),
        lastSyncError: null,
      },
    });
    return "success";
  }

  await enqueueStatusCheck({
    syncRunId,
    propertyId: property.id,
    cadNumber: property.cadNumber,
    cadNumberOld: property.cadNumberOld,
  });

  return "pending"; // yakuniy hisob status-check bosqichida
}
