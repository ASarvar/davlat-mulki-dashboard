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
  // ⚠️ `undefined` (eski API 2 zaxirasi) — ustunga tegilmaydi, avvalgi sana saqlanadi.
  const balanceFields = base.balanceDate !== undefined ? { balanceDate: base.balanceDate } : {};

  // ── Tashkilotlar orasida o'tkazish (2026-09-28) ──
  // Obyekt bazada BOSHQA tashkilotimizda turibdi, lekin endi SHU tashkilot ro'yxatida
  // (API 1) keldi. Ilgari `update` tashkilotni umuman o'zgartirmasdi: eski ega uni
  // "balansdan chiqarilgan" deb belgilar, yangi egada esa u hech qachon paydo bo'lmasdi —
  // obyekt barcha statistikadan (jumladan "Balansga olinganlar"dan) jimgina yo'qolardi
  // (jonli holat: 10:11:40:01:01:0127/0005, Ijara markazi → Direksiya, 17.08.2026).
  // Ko'chirish sharti — ikkisidan biri:
  //  1. eski ega uni allaqachon chiqarib tashlagan (`removedFromBalance`);
  //  2. kadastrdagi joriy egasi (`hosts[0].tin`) aynan shu tashkilot, eskisi emas.
  // ⚠️ Shartsiz ko'chirilmaydi: ulushli egalikda ikki tashkilot bir kadastrni birga
  // ro'yxatlaydi va obyekt har sinxronizatsiyada ular orasida o'tib-qaytib yurardi.
  // 2-shart `hosts[0]` so'rov STIRidan qat'i nazar bir xil bo'lgani uchun barqaror.
  const existing = await prisma.property.findUnique({
    where: { cadNumber },
    select: {
      id: true,
      sourceId: true,
      removedFromBalance: true,
      removedAt: true,
      source: { select: { stir: true } },
    },
  });
  const transferred = isTransferredHere(existing, sourceId, stir, base.holderInn ?? null);
  const transferFields = transferred
    ? {
        sourceId,
        regionId,
        removedFromBalance: false,
        removedAt: null,
        removedToStir: null,
        removedToName: null,
      }
    : {};
  if (transferred) {
    console.log(`[property-base] ${cadNumber}: boshqa tashkilotdan o'tkazilgan — yangi egasiga ko'chirildi`);
  }

  const upsert = prisma.property.upsert({
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
      ...balanceFields,
      syncStatus: "SYNCING",
    },
    update: {
      ...transferFields,
      cadNumberOld: base.cadNumberOld,
      districtId,
      name: base.name,
      address: base.address,
      area: base.area != null ? new Prisma.Decimal(base.area) : null,
      buildingArea: base.buildingArea != null ? new Prisma.Decimal(base.buildingArea) : null,
      isLand: base.isLand,
      rawApi2: base.raw as Prisma.InputJsonValue,
      ...coordFields,
      ...balanceFields,
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
  // ⚠️ O'tkazish tarixi ko'chirish bilan BITTA tranzaksiyada: aks holda obyekt yangi
  // egasiga o'tib, eski egasining "Balansdan chiqarilgan" ro'yxatidan izsiz yo'qolishi mumkin edi.
  const [property] =
    transferred && existing
      ? await prisma.$transaction([
          upsert,
          prisma.balanceTransfer.create({
            data: {
              propertyId: existing.id,
              fromSourceId: existing.sourceId,
              toSourceId: sourceId,
              removedAt: existing.removedAt ?? new Date(),
            },
          }),
        ])
      : [await upsert];

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

/**
 * Obyekt boshqa tashkilotimizdan SHU tashkilotga o'tkazilganmi (yuqoridagi izohga qarang).
 * Sof funksiya — qoida bitta joyda va sinovda tekshiriladi.
 */
export function isTransferredHere(
  existing: { sourceId: string; removedFromBalance: boolean; source: { stir: string } } | null,
  sourceId: string,
  stir: string | null,
  holderInn: string | null,
): boolean {
  if (!existing || existing.sourceId === sourceId) return false;
  if (existing.removedFromBalance) return true;
  return stir !== null && holderInn === stir && existing.source.stir !== holderInn;
}
