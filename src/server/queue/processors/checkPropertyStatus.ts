import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STATUS_APIS } from "@/server/integrations/config";
import { makeStatusApiCall } from "@/server/integrations/statusApi";
import { callWithCadFallback } from "@/server/integrations/withCadFallback";
import { checkAuction, isAuctionConfigured, EMPTY_AUCTION, type AuctionInfo } from "@/server/integrations/auction";
import { fetchRentContracts, isRentApiConfigured, EMPTY_RENT, type RentInfo } from "@/server/integrations/rentApi";
import {
  fetchActiveRentLot,
  isRentAuctionConfigured,
  EMPTY_RENT_LOT,
  type RentLotInfo,
} from "@/server/integrations/rentAuction";
import {
  deriveIntegrationCategory,
  deriveAuctionCategory,
  deriveRentCategory,
  computeIsInefficient,
  CAT_VACANT,
  type StatusResultBySource,
} from "@/server/services/classification";
import type { JobOutcome, StatusCheckJob } from "../jobs";

// Auksion zanjiri (API 3 -> API 4) fallback bilan: yangi kadastr topilmasa eski bilan.
async function runAuctionCheck(cadNumber: string, cadNumberOld: string | null): Promise<AuctionInfo> {
  if (!isAuctionConfigured()) return EMPTY_AUCTION;

  const primary = await checkAuction(cadNumber);
  if (primary.found) return primary;

  if (cadNumberOld && cadNumberOld !== cadNumber) {
    const fallback = await checkAuction(cadNumberOld);
    if (fallback.found) return fallback;
  }
  return EMPTY_AUCTION;
}

// API 5 (ijara) — eski kadastr fallback bilan. Fallback ishlagani belgilanadi.
async function runRentCheck(cadNumber: string, cadNumberOld: string | null): Promise<RentInfo> {
  if (!isRentApiConfigured()) return EMPTY_RENT;

  const primary = await fetchRentContracts(cadNumber);
  if (primary.found) return primary;

  if (cadNumberOld && cadNumberOld !== cadNumber) {
    const fallback = await fetchRentContracts(cadNumberOld);
    if (fallback.found) return { ...fallback, matchedByOldCad: true };
  }
  return EMPTY_RENT;
}

// API 6 (faol ijara loti) — eski kadastr fallback bilan.
async function runRentLotCheck(cadNumber: string, cadNumberOld: string | null): Promise<RentLotInfo> {
  if (!isRentAuctionConfigured()) return EMPTY_RENT_LOT;

  const primary = await fetchActiveRentLot(cadNumber);
  if (primary.found) return primary;

  if (cadNumberOld && cadNumberOld !== cadNumber) {
    const fallback = await fetchActiveRentLot(cadNumberOld);
    if (fallback.found) return { ...fallback, matchedByOldCad: true };
  }
  return EMPTY_RENT_LOT;
}

const toDate = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

const toDec = (v: unknown): Prisma.Decimal | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? new Prisma.Decimal(n) : null;
};

// Job C: auksion (API 3+4) va boshqa holat-API'larni tekshiradi, kategoriyalaydi.
export async function processStatusCheck(data: StatusCheckJob): Promise<JobOutcome> {
  const { propertyId, cadNumber, cadNumberOld } = data;

  // 1) Auksion zanjiri va ijara shartnomalari — parallel (turli API'lar).
  const [auction, rent, rentLot] = await Promise.all([
    runAuctionCheck(cadNumber, cadNumberOld),
    runRentCheck(cadNumber, cadNumberOld),
    runRentLotCheck(cadNumber, cadNumberOld),
  ]);

  // 2) Qolgan holat-API'lar (sozlanganlari), har biri fallback bilan.
  const results: StatusResultBySource[] = await Promise.all(
    STATUS_APIS.map(async (cfg) => {
      const call = makeStatusApiCall(cfg);
      const res = await callWithCadFallback(call, cadNumber, cadNumberOld);
      return { ...res, source: cfg.source };
    }),
  );

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

    // Auksion natijasini ham tekshiruv sifatida yozamiz (audit uchun).
    if (isAuctionConfigured()) {
      await tx.objectStatusCheck.upsert({
        where: { propertyId_apiSource: { propertyId, apiSource: "AUCTION" } },
        create: {
          propertyId,
          apiSource: "AUCTION",
          found: auction.found,
          matchedByOldCad: false,
          status: auction.orderStatus ?? auction.lotStatus ?? null,
          rawResponse: (auction.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
        update: {
          found: auction.found,
          status: auction.orderStatus ?? auction.lotStatus ?? null,
          rawResponse: (auction.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          checkedAt: new Date(),
        },
      });
    }

    // Ijara natijasini ham tekshiruv sifatida yozamiz.
    if (isRentApiConfigured()) {
      await tx.objectStatusCheck.upsert({
        where: { propertyId_apiSource: { propertyId, apiSource: "API5" } },
        create: {
          propertyId,
          apiSource: "API5",
          found: rent.found,
          matchedByOldCad: false,
          status: rent.found ? `${rent.contractCount} ta shartnoma` : null,
          rawResponse: (rent.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
        update: {
          found: rent.found,
          status: rent.found ? `${rent.contractCount} ta shartnoma` : null,
          rawResponse: (rent.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          checkedAt: new Date(),
        },
      });
    }

    // Faol ijara loti (API 6) natijasi.
    if (isRentAuctionConfigured()) {
      await tx.objectStatusCheck.upsert({
        where: { propertyId_apiSource: { propertyId, apiSource: "API6" } },
        create: {
          propertyId,
          apiSource: "API6",
          found: rentLot.found,
          matchedByOldCad: rentLot.matchedByOldCad,
          status: rentLot.found ? `${rentLot.lots.length} ta lot` : null,
          rawResponse: (rentLot.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
        update: {
          found: rentLot.found,
          matchedByOldCad: rentLot.matchedByOldCad,
          status: rentLot.found ? `${rentLot.lots.length} ta lot` : null,
          rawResponse: (rentLot.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          checkedAt: new Date(),
        },
      });
    }

    // Kategoriya ustuvorligi: auksion (sotilgan/savdoda) > ijara shartnomasi > boshqa API'lar.
    // Sabab: sotilgan yoki savdodagi obyektning holati ijara shartnomasidan muhimroq.
    // ── Auksion lotlari ──
    // Obyekt bir vaqtda ham xususiylashtirish, ham ijara savdosida bo'lishi mumkin,
    // va har biri bir nechta lotga bo'lingan bo'lishi mumkin. Hammasini saqlaymiz.
    // "Savdoda" = HOZIR savdoda turgan. Sotilgan obyektning ham loti bor, lekin u
    // savdoda emas — shuning uchun sotilganlarni chiqarib tashlaymiz.
    const hasPrivatizationLot = Boolean(auction.found && auction.lotNumber && !auction.isSold);
    const hasRentLot = rentLot.found;
    const auctionTotalArea = rentLot.totalArea;

    await tx.auctionLot.deleteMany({ where: { propertyId } });
    const lotRows: Prisma.AuctionLotCreateManyInput[] = [];

    if (hasPrivatizationLot) {
      lotRows.push({
        propertyId,
        type: "PRIVATIZATION",
        lotNumber: auction.lotNumber,
        orderId: auction.orderId,
        area: auction.area != null ? new Prisma.Decimal(auction.area) : null,
        startPrice: auction.startPrice != null ? new Prisma.Decimal(auction.startPrice) : null,
        auctionDate: auction.auctionDate,
        lotStatus: auction.lotStatus,
        orderStatus: auction.orderStatus,
        matchedByOldCad: false,
      });
    }
    for (const l of rentLot.lots) {
      lotRows.push({
        propertyId,
        type: "RENT",
        lotNumber: l.lotNumber,
        orderId: l.orderId,
        area: l.rentArea != null ? new Prisma.Decimal(l.rentArea) : null,
        startPrice: l.startPrice != null ? new Prisma.Decimal(l.startPrice) : null,
        auctionDate: l.auctionDate,
        lotStatus: l.lotStatus,
        orderStatus: l.orderStatus,
        name: l.name,
        matchedByOldCad: rentLot.matchedByOldCad,
      });
    }
    if (lotRows.length > 0) await tx.auctionLot.createMany({ data: lotRows });

    const auctionCategory = deriveAuctionCategory({ ...auction, hasRentLot });
    const rentCategory = deriveRentCategory(rent);
    const otherCategory = deriveIntegrationCategory(results);
    // Hech qanday integratsiya kategoriyasi topilmasa — obyekt BO'SH TURGAN hisoblanadi.
    // (Ilgari kategoriyasiz qolar edi; foydalanuvchi talabi bo'yicha endi kat 11.)
    const integrationCategoryCode = auctionCategory ?? rentCategory ?? otherCategory ?? CAT_VACANT;

    const current = await tx.property.findUniqueOrThrow({
      where: { id: propertyId },
      select: { manualCategoryCode: true, area: true, buildingArea: true, rawApi2: true },
    });

    // ── Maydon tuzatish ──
    // Ba'zi obyektlarda shartnoma maydoni foydali maydondan (object_area_u) katta chiqadi —
    // demak obyekt aslida yer uchastkasi. Bunday holatda maydonni `land_area` dan olamiz
    // (real ma'lumotda 84 holatdan 71 tasida land_area shartnoma maydonini qoplaydi).
    const raw = current.rawApi2 as Record<string, unknown> | null;
    const landArea = raw?.land_area != null ? Number(raw.land_area) : null;
    const usefulRaw = current.buildingArea != null ? Number(current.buildingArea) : 0;
    const rentedArea = rent.found ? rent.totalArea : 0;

    const useLand = rentedArea > usefulRaw && landArea != null && landArea > usefulRaw;
    const usefulArea = useLand ? landArea : usefulRaw;
    const areaOverride = useLand ? new Prisma.Decimal(landArea) : undefined;

    const vacantArea = Math.max(usefulArea - rentedArea, 0);
    const isInefficient = computeIsInefficient(integrationCategoryCode, current.manualCategoryCode);

    await tx.property.update({
      where: { id: propertyId },
      data: {
        integrationCategoryCode,
        isInefficient,
        // Auksion maydonlari (topilmasa tozalanadi — eski qiymat qolib ketmasin).
        // API 3/4 lotni ko'rmasa, API 6 dagi ijara lotini ishlatamiz.
        lotNumber: auction.lotNumber ?? rentLot.lots[0]?.lotNumber ?? null,
        lotStatus: auction.lotStatus ?? rentLot.lots[0]?.lotStatus ?? null,
        auctionOrderId: auction.orderId ?? rentLot.lots[0]?.orderId ?? null,
        hasPrivatizationLot,
        hasRentLot,
        auctionTotalArea: auctionTotalArea > 0 ? new Prisma.Decimal(auctionTotalArea) : null,
        auctionStatusId: auction.orderStatusId,
        auctionStatus: auction.orderStatus,
        termPayment: auction.termPayment,
        paymentTermMonths: auction.paymentTermMonths,
        auctionGroupName: auction.groupName,
        auctionCheckedAt: isAuctionConfigured() ? new Date() : null,
        // Ijara (API 5)
        rentContractCount: rent.found ? rent.contractCount : null,
        rentTotalSum: rent.found ? new Prisma.Decimal(rent.totalSum) : null,
        rentTotalArea: rent.found ? new Prisma.Decimal(rent.totalArea) : null,
        rentMatchedByOldCad: rent.matchedByOldCad,
        vacantArea: new Prisma.Decimal(vacantArea),
        // Maydon land_area'dan olingan bo'lsa, ikkala ustunni ham yangilaymiz.
        ...(areaOverride ? { area: areaOverride, buildingArea: areaOverride } : {}),
        rentCheckedAt: isRentApiConfigured() ? new Date() : null,
        syncStatus: "SYNCED",
        lastSyncedAt: new Date(),
        lastSyncError: null,
      },
    });

    // Ijara shartnomalari: to'liq almashtiramiz (API "haqiqat manbai").
    if (isRentApiConfigured()) {
      await tx.rentContract.deleteMany({ where: { propertyId } });
      if (rent.contracts.length > 0) {
        await tx.rentContract.createMany({
          data: rent.contracts.map((c) => ({
            propertyId,
            contractNumber: c.contract_number?.toString().trim() || null,
            contractDate: toDate(c.contract_date),
            contractSum: toDec(c.contract_sum),
            rentalArea: toDec(c.rental_area),
            ownerTin: c.owner_tin?.toString().trim() || null,
            ownerName: c.owner_name?.toString().trim() || null,
            tenantTin: c.tenant_tin?.toString().trim() || null,
            tenantName: c.tenant_name?.toString().trim() || null,
            docLink: c.doc_link?.toString().trim() || null,
            regionName: c.region_name?.toString().trim() || null,
            districtName: c.district_name?.toString().trim() || null,
            matchedByOldCad: rent.matchedByOldCad,
          })),
        });
      }
    }
  });

  return "success";
}
