import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchBase } from "@/server/integrations/propertyBase";
import { STATUS_APIS } from "@/server/integrations/config";
import { isAuctionConfigured } from "@/server/integrations/auction";
import { isRentApiConfigured } from "@/server/integrations/rentApi";
import { isRentAuctionConfigured } from "@/server/integrations/rentAuction";
import { computeIsInefficient } from "@/server/services/classification";
import { resolveDistrictId } from "@/server/services/districts";
import { enqueueStatusCheck } from "../dispatch";
import type { JobOutcome, PropertyBaseJob } from "../jobs";

// Job B: API 2 orqali obyekt asosiy ma'lumotlarini oladi va bazaga upsert qiladi.
// cad_number_old ni majburiy saqlaydi, so'ng status-check job'ini qo'yadi.
export async function processPropertyBase(data: PropertyBaseJob): Promise<JobOutcome> {
  const { syncRunId, sourceId, regionId, cadNumber } = data;

  // ⚠️ Yangi `cad_data` API'si STIRni MAJBURIY qiladi. Odatda u job payloadida
  // keladi (`syncSource.ts` fan-out'da qo'shadi); deploydan OLDIN navbatga tushgan
  // eski joblarda esa yo'q — o'shanda bazadan olamiz, aks holda job jimgina
  // eski API 2 ga tushib qolardi.
  const stir =
    data.stir ??
    (await prisma.organizationSource.findUnique({ where: { id: sourceId }, select: { stir: true } }))
      ?.stir ??
    null;

  const result = await fetchBase(cadNumber, stir);

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
    // Sababni ham qaytaramiz — u run'ning `failureSummary` iga yoziladi.
    return { outcome: "fail", reason: result.reason };
  }

  const base = result.data;
  const districtId = await resolveDistrictId(base.districtCode, base.district, regionId);

  // ⚠️ Koordinata FAQAT yangi qiymat bo'lganda yoziladi — `null` ga qaytarilmaydi.
  // Bino kadastr javobi bir marta geometriyasiz kelgani uchun joyidan ko'chmaydi
  // (auksion koordinatasi bilan bir xil printsip, `checkPropertyStatus.ts` ga qarang).
  const coordFields = base.coords
    ? {
        lat: base.coords.lat,
        lng: base.coords.lng,
        coordSource: "CADASTRE",
        coordsAt: new Date(),
      }
    : {};

  const property = await prisma.property.upsert({
    where: { cadNumber },
    create: {
      cadNumber,
      cadNumberOld: base.cadNumberOld,
      regionId,
      districtId,
      sourceId,
      name: base.name,
      address: base.address,
      area: base.area != null ? new Prisma.Decimal(base.area) : null,
      buildingArea: base.buildingArea != null ? new Prisma.Decimal(base.buildingArea) : null,
      isLand: base.isLand,
      rawApi2: base.raw as Prisma.InputJsonValue,
      ...coordFields,
      syncStatus: "SYNCING",
    },
    update: {
      cadNumberOld: base.cadNumberOld,
      districtId,
      name: base.name,
      address: base.address,
      area: base.area != null ? new Prisma.Decimal(base.area) : null,
      buildingArea: base.buildingArea != null ? new Prisma.Decimal(base.buildingArea) : null,
      isLand: base.isLand,
      rawApi2: base.raw as Prisma.InputJsonValue,
      ...coordFields,
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
  if (
    STATUS_APIS.length === 0 &&
    !isAuctionConfigured() &&
    !isRentApiConfigured() &&
    !isRentAuctionConfigured()
  ) {
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
