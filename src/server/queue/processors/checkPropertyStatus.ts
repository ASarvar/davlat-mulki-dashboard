import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STATUS_APIS } from "@/server/integrations/config";
import { makeStatusApiCall } from "@/server/integrations/statusApi";
import { callWithCadFallback } from "@/server/integrations/withCadFallback";
import { checkAuction, isAuctionConfigured, EMPTY_AUCTION, type AuctionInfo } from "@/server/integrations/auction";
import { fetchRentContracts, isRentApiConfigured, EMPTY_RENT, type RentInfo } from "@/server/integrations/rentApi";
import {
  deriveIntegrationCategory,
  deriveAuctionCategory,
  deriveRentCategory,
  computeIsInefficient,
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
  const [auction, rent] = await Promise.all([
    runAuctionCheck(cadNumber, cadNumberOld),
    runRentCheck(cadNumber, cadNumberOld),
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

    // Kategoriya ustuvorligi: auksion (sotilgan/savdoda) > ijara shartnomasi > boshqa API'lar.
    // Sabab: sotilgan yoki savdodagi obyektning holati ijara shartnomasidan muhimroq.
    const auctionCategory = deriveAuctionCategory(auction);
    const rentCategory = deriveRentCategory(rent);
    const otherCategory = deriveIntegrationCategory(results);
    const integrationCategoryCode = auctionCategory ?? rentCategory ?? otherCategory;

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
        // Auksion maydonlari (topilmasa tozalanadi — eski qiymat qolib ketmasin)
        lotNumber: auction.lotNumber,
        lotStatus: auction.lotStatus,
        auctionOrderId: auction.orderId,
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
