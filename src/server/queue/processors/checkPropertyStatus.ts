import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchPropertyBase } from "@/server/integrations/api2";
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
  checkAllUtilities,
  isUtilityConfigured,
  UTILITY_ENDPOINTS,
  type UtilityResults,
} from "@/server/integrations/utilities";
import {
  deriveIntegrationCategory,
  deriveAuctionCategory,
  deriveRentCategory,
  computeIsInefficient,
  type StatusResultBySource,
} from "@/server/services/classification";
import { resolveDistrictId } from "@/server/services/districts";
import type { JobOutcome, StatusCheckJob } from "../jobs";

// Auksion (1,2,3,4,7) va ijara-shartnoma (5,6) kod diapazonlari bir-biriga kesishmaydi
// va ustuvorlik har doim auksion > ijara > boshqa bo'lgani uchun, joriy `integrationCategoryCode`
// qaysi diapazonda ekanini bilish o'sha modulning OXIRGI hissasini aniq qayta tiklaydi —
// modul yangilanmasa ham, uning eski natijasi merge'da to'g'ri ishtirok etadi.
const AUCTION_RANGE = new Set([1, 2, 3, 4, 7]);
const RENT_RANGE = new Set([5, 6]);

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

// Job C: asosiy ma'lumot (API 2, ixtiyoriy), auksion (API 3+4+6, ixtiyoriy), ijara
// shartnomalari (API 5, ixtiyoriy) va kommunal xizmatlar (suv/gaz/elektr, ixtiyoriy) —
// har biri mustaqil yoqilishi/o'chirilishi mumkin (`STATUS_REFRESH` sinxronizatsiyasi
// uchun). Hech biri berilmasa — FULL_ALL/REGION/SINGLE zanjiridagi kabi hammasi
// ishlaydi, xulq-atvor o'zgarmaydi.
//
// ⚠️ Auksion (API3/4) va ijara loti (API6) BITTA guruh: ikkalasi ham bitta
// `deriveAuctionCategory()` chaqiruviga kiradi va `AuctionLot` jadvalida birga
// saqlanadi (PRIVATIZATION + RENT turlari), shuning uchun alohida yoqib bo'lmaydi.
//
// ⚠️ Kommunal modul KATEGORIYAGA UMUMAN TA'SIR QILMAYDI — u mustaqil kuzatuv o'lchovi
// (obyekt bo'sh turgani holda suv/gaz/elektr sarflayaptimi). Shu sababli u
// `integrationCategoryCode` hisobiga kirmaydi va `AUCTION_RANGE`/`RENT_RANGE` kabi
// "yangilanmagan modul hissasini tiklash" mantig'i ham kerak emas: yangilanmasa,
// tegishli ustunlar oddiygina `update` ga qo'shilmaydi va bazadagi qiymat qoladi.
export async function processStatusCheck(data: StatusCheckJob): Promise<JobOutcome> {
  const {
    propertyId,
    cadNumber,
    cadNumberOld,
    refreshBase = true,
    refreshAuction = true,
    refreshRent = true,
    refreshUtility = true,
  } = data;

  const current = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
    select: {
      manualCategoryCode: true,
      area: true,
      buildingArea: true,
      rawApi2: true,
      integrationCategoryCode: true,
      hasPrivatizationLot: true,
      hasRentLot: true,
      auctionTotalArea: true,
      rentTotalArea: true,
    },
  });

  // ── 0) Asosiy ma'lumot (API 2) — ixtiyoriy ──
  // Bu QAYTA tekshiruv (obyekt allaqachon bor), shuning uchun API xato bersa ham
  // mavjud yaxshi ma'lumotni o'chirmaymiz — xatoni saqlab, qolgan bosqichlar bilan
  // davom etamiz (initial kashfiyotdagi processPropertyBase'dan farqli, u yerda
  // xato = obyekt umuman yo'q degani, bu yerda esa bor obyektning vaqtinchalik
  // yangilanmay qolishi).
  let baseBuildingArea = current.buildingArea != null ? Number(current.buildingArea) : 0;
  let baseRawApi2 = current.rawApi2;
  let baseError: string | null = null;
  if (refreshBase) {
    const base = await fetchPropertyBase(cadNumber);
    if (base.ok) {
      const b = base.data;
      // Tuman API 2 bilan birga keladi — obyekt hududi bo'yicha District upsert qilamiz.
      const { regionId } = await prisma.property.findUniqueOrThrow({
        where: { id: propertyId },
        select: { regionId: true },
      });
      const districtId = await resolveDistrictId(b.districtCode, b.district, regionId);
      await prisma.property.update({
        where: { id: propertyId },
        data: {
          cadNumberOld: b.cadNumberOld,
          districtId,
          name: b.name,
          address: b.address,
          area: b.area != null ? new Prisma.Decimal(b.area) : null,
          buildingArea: b.buildingArea != null ? new Prisma.Decimal(b.buildingArea) : null,
          isLand: b.isLand,
          rawApi2: b.raw as Prisma.InputJsonValue,
        },
      });
      baseBuildingArea = b.buildingArea ?? 0;
      baseRawApi2 = b.raw as typeof current.rawApi2;
    } else {
      baseError = base.reason;
    }
  }

  // ── 1) Auksion zanjiri (API 3+4) va ijara loti (API 6) — parallel, ixtiyoriy ──
  // ── 2) Ijara shartnomalari (API 5) — parallel, mustaqil ravishda ixtiyoriy ──
  // ── 3) Kommunal (suv/gaz/elektr) — parallel, mustaqil ravishda ixtiyoriy ──
  const [auction, rentLot, rent, utilities] = await Promise.all([
    refreshAuction ? runAuctionCheck(cadNumber, cadNumberOld) : Promise.resolve(null),
    refreshAuction ? runRentLotCheck(cadNumber, cadNumberOld) : Promise.resolve(null),
    refreshRent ? runRentCheck(cadNumber, cadNumberOld) : Promise.resolve(null),
    refreshUtility && isUtilityConfigured()
      ? checkAllUtilities(cadNumber, cadNumberOld)
      : Promise.resolve(null as UtilityResults | null),
  ]);

  // 3) Qolgan holat-API'lar (sozlanganlari, har biri fallback bilan) — hech qanday
  // toggle so'ralmagan, doim ishlaydi (odatda sozlanmagan, arzon).
  const results: StatusResultBySource[] = await Promise.all(
    STATUS_APIS.map(async (cfg) => {
      const call = makeStatusApiCall(cfg);
      const res = await callWithCadFallback(call, cadNumber, cadNumberOld);
      return { ...res, source: cfg.source };
    }),
  );

  await prisma.$transaction(async (tx) => {
    if (refreshAuction && isAuctionConfigured()) {
      await tx.objectStatusCheck.upsert({
        where: { propertyId_apiSource: { propertyId, apiSource: "AUCTION" } },
        create: {
          propertyId,
          apiSource: "AUCTION",
          found: auction!.found,
          matchedByOldCad: false,
          status: auction!.orderStatus ?? auction!.lotStatus ?? null,
          rawResponse: (auction!.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
        update: {
          found: auction!.found,
          status: auction!.orderStatus ?? auction!.lotStatus ?? null,
          rawResponse: (auction!.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          checkedAt: new Date(),
        },
      });
    }

    if (refreshRent && isRentApiConfigured()) {
      await tx.objectStatusCheck.upsert({
        where: { propertyId_apiSource: { propertyId, apiSource: "API5" } },
        create: {
          propertyId,
          apiSource: "API5",
          found: rent!.found,
          matchedByOldCad: false,
          status: rent!.found ? `${rent!.contractCount} ta shartnoma` : null,
          rawResponse: (rent!.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
        update: {
          found: rent!.found,
          status: rent!.found ? `${rent!.contractCount} ta shartnoma` : null,
          rawResponse: (rent!.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          checkedAt: new Date(),
        },
      });
    }

    if (refreshAuction && isRentAuctionConfigured()) {
      await tx.objectStatusCheck.upsert({
        where: { propertyId_apiSource: { propertyId, apiSource: "API6" } },
        create: {
          propertyId,
          apiSource: "API6",
          found: rentLot!.found,
          matchedByOldCad: rentLot!.matchedByOldCad,
          status: rentLot!.found ? `${rentLot!.lots.length} ta lot` : null,
          rawResponse: (rentLot!.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
        update: {
          found: rentLot!.found,
          matchedByOldCad: rentLot!.matchedByOldCad,
          status: rentLot!.found ? `${rentLot!.lots.length} ta lot` : null,
          rawResponse: (rentLot!.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          checkedAt: new Date(),
        },
      });
    }

    // ── Kommunal xizmatlar ──
    // Xom javob shu yerda saqlanadi (`rawApi2`/`ObjectStatusCheck.rawResponse` bilan bir
    // xil printsip): mezon o'zgarsa — masalan "sarflayapti" oyi — tashqi API'ni qayta
    // chaqirmasdan qayta hisoblash mumkin. Faqat SOZLANGAN endpoint'lar yoziladi,
    // aks holda sozlanmagan xizmat har bir obyektga soxta "topilmadi" yozuvini qoldirardi.
    if (refreshUtility && utilities) {
      for (const ep of UTILITY_ENDPOINTS) {
        const u = utilities[ep.kind];
        await tx.objectStatusCheck.upsert({
          where: { propertyId_apiSource: { propertyId, apiSource: ep.kind } },
          create: {
            propertyId,
            apiSource: ep.kind,
            found: u.found,
            matchedByOldCad: u.matchedByOldCad,
            status: u.summary,
            rawResponse: (u.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          },
          update: {
            found: u.found,
            matchedByOldCad: u.matchedByOldCad,
            status: u.summary,
            rawResponse: (u.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            checkedAt: new Date(),
          },
        });
      }
    }

    // Kategoriya ustuvorligi: auksion (sotilgan/savdoda) > ijara shartnomasi > boshqa API'lar.
    // ── Auksion lotlari ──
    // ⚠️ `hasPrivatizationLot` — FAQAT "hozir savdoda turibdi" bayrog'i (kat 3 hisobi
    // shunga tayanadi, shuning uchun sotilganlar `!isSold` bilan chiqarib tashlanadi —
    // aks holda kat 3 1427 ta chiqadi, 524 o'rniga). Bu bayroqni lot YOZUVINI saqlash
    // shartiga ISHLATMANG: ilgari shunday qilingan edi va natijada obyekt sotilgach
    // uning `AuctionLot` qatori HAR safar qayta sinxronlanganda o'chirilib, qayta
    // yaratilmasdi — ro'yxatda (Property.lotNumber, pastda alohida yoziladi) lot
    // ko'rinardi, obyekt sahifasida (auctionLots relation) esa "0" chiqardi.
    const hasPrivatizationLot = refreshAuction
      ? Boolean(auction!.found && auction!.lotNumber && !auction!.isSold)
      : current.hasPrivatizationLot;
    // Tarixiy yozuv uchun: lot mavjudligining o'zi yetarli — sotilgan-sotilmaganidan qat'i nazar.
    const auctionLotExists = refreshAuction ? Boolean(auction!.found && auction!.lotNumber) : false;
    // ⚠️ `hasPrivatizationLot` bilan bir xil qoida: sotilgan obyekt endi "ijara savdosida"
    // hisoblanmasin (aks holda "Savdoda ijara"/"Auksion savdolarida" ustunlari sotilganlarni
    // ham qo'shib shishib ketadi — 2026-08-11 jonli ma'lumotda 8 ta shunday holat topildi).
    const hasRentLot = refreshAuction ? Boolean(rentLot!.found && !auction!.isSold) : current.hasRentLot;
    const auctionTotalAreaNum = refreshAuction
      ? rentLot!.totalArea
      : Number(current.auctionTotalArea ?? 0);

    if (refreshAuction) {
      // Faqat shu modul yangilanganda qayta yoziladi — yangilanmasa oldingi lotlar
      // (va ularning tarixi) tegilmaydi.
      await tx.auctionLot.deleteMany({ where: { propertyId } });
      const lotRows: Prisma.AuctionLotCreateManyInput[] = [];

      if (auctionLotExists) {
        lotRows.push({
          propertyId,
          type: "PRIVATIZATION",
          lotNumber: auction!.lotNumber,
          orderId: auction!.orderId,
          area: auction!.area != null ? new Prisma.Decimal(auction!.area) : null,
          startPrice: auction!.startPrice != null ? new Prisma.Decimal(auction!.startPrice) : null,
          auctionDate: auction!.auctionDate,
          lotStatus: auction!.lotStatus,
          orderStatus: auction!.orderStatus,
          matchedByOldCad: false,
        });
      }
      for (const l of rentLot!.lots) {
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
          matchedByOldCad: rentLot!.matchedByOldCad,
        });
      }
      if (lotRows.length > 0) await tx.auctionLot.createMany({ data: lotRows });
    }

    // Yangilanmagan modul — oldingi HISSASINI diapazonidan qayta tiklaydi (yuqoridagi
    // izohga qarang). Bu `deriveAuctionCategory`/`deriveRentCategory`ni qayta chaqirish
    // bilan bir xil natija beradi, lekin xom API javoblarini saqlab yurishni talab qilmaydi.
    const auctionCategory = refreshAuction
      ? deriveAuctionCategory({ ...auction!, hasRentLot })
      : current.integrationCategoryCode != null && AUCTION_RANGE.has(current.integrationCategoryCode)
        ? current.integrationCategoryCode
        : null;
    const rentCategory = refreshRent
      ? deriveRentCategory(rent!)
      : current.integrationCategoryCode != null && RENT_RANGE.has(current.integrationCategoryCode)
        ? current.integrationCategoryCode
        : null;
    const otherCategory = deriveIntegrationCategory(results);
    // Hech qanday integratsiya kategoriyasi topilmasa — `null` saqlanadi (kat 11 emas!).
    // Agar shu yerda CAT_VACANT (11) yozilsa, keyinchalik qo'lda 9/10ga biriktirilganda
    // "integrationCategoryCode ?? manualCategoryCode" hamisha 11ni qaytaradi — qo'lda
    // biriktirish hech qachon effektiv kategoriyaga ta'sir qilmay qoladi. "Kategoriyasiz"
    // holati esa effectiveCategory()/buildWhere()/stats.ts'da alohida CAT_VACANT fallback
    // bilan ko'rsatiladi (haqiqiy ustunga yozilmasdan).
    const integrationCategoryCode = auctionCategory ?? rentCategory ?? otherCategory ?? null;

    // ── Maydon tuzatish ──
    // Ba'zi obyektlarda shartnoma maydoni foydali maydondan (object_area_u) katta chiqadi —
    // demak obyekt aslida yer uchastkasi. Bunday holatda maydonni `land_area` dan olamiz
    // (real ma'lumotda 84 holatdan 71 tasida land_area shartnoma maydonini qoplaydi).
    const raw = baseRawApi2 as Record<string, unknown> | null;
    const landArea = raw?.land_area != null ? Number(raw.land_area) : null;
    const usefulRaw = baseBuildingArea;
    const rentedArea = refreshRent ? (rent!.found ? rent!.totalArea : 0) : Number(current.rentTotalArea ?? 0);

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
        hasPrivatizationLot,
        hasRentLot,
        ...(refreshAuction
          ? {
              // Auksion maydonlari (topilmasa tozalanadi — eski qiymat qolib ketmasin).
              // API 3/4 lotni ko'rmasa, API 6 dagi ijara lotini ishlatamiz.
              lotNumber: auction!.lotNumber ?? rentLot!.lots[0]?.lotNumber ?? null,
              lotStatus: auction!.lotStatus ?? rentLot!.lots[0]?.lotStatus ?? null,
              auctionOrderId: auction!.orderId ?? rentLot!.lots[0]?.orderId ?? null,
              auctionTotalArea: auctionTotalAreaNum > 0 ? new Prisma.Decimal(auctionTotalAreaNum) : null,
              auctionStatusId: auction!.orderStatusId,
              auctionStatus: auction!.orderStatus,
              termPayment: auction!.termPayment,
              paymentTermMonths: auction!.paymentTermMonths,
              auctionGroupName: auction!.groupName,
              auctionCheckedAt: isAuctionConfigured() ? new Date() : null,
            }
          : {}),
        ...(refreshRent
          ? {
              // Ijara (API 5)
              rentContractCount: rent!.found ? rent!.contractCount : null,
              rentTotalSum: rent!.found ? new Prisma.Decimal(rent!.totalSum) : null,
              rentTotalArea: rent!.found ? new Prisma.Decimal(rent!.totalArea) : null,
              rentMatchedByOldCad: rent!.matchedByOldCad,
              rentCheckedAt: isRentApiConfigured() ? new Date() : null,
            }
          : {}),
        ...(refreshUtility && utilities
          ? {
              // Kommunal bayroqlar — dashboard agregati uchun materiallashtirilgan.
              // ⚠️ Uch daraja ATAYIN alohida saqlanadi, chunki ular boshqa-boshqa
              // narsani bildiradi:
              //   hasGas       — abonent hisobi mavjud (ochiq bo'lsa ham, jim bo'lsa ham)
              //   gasBilled    — hisob faol, to'lov hisoblanmoqda (hisoblagichsiz ham)
              //   gasConsuming — HISOBLAGICH haqiqiy sarfni ko'rsatgan (eng qat'iy)
              hasWater: utilities.WATER.found,
              hasGas: utilities.GAS.found,
              hasElectric: utilities.ELECTRIC.found,
              gasConsuming: utilities.GAS.consuming,
              gasBilled: utilities.GAS.billed,
              // Oxirgi to'lov sanasi — "yaqinda faol" mezoni uchun (gasBilled dan
              // kuchliroq dalil: hisob-kitob to'lovsiz ham davom etadi).
              gasLastPaymentAt: utilities.GAS.lastPaymentAt,
              // ⚠️ Bu "tekshirildi" belgisi — topilgan/topilmaganidan QAT'I NAZAR
              // qo'yiladi. Dashboardda "tekshirilmagan" (null) alohida ustun, chunki
              // API "abonent yo'q" va "hudud qamralmagan" holatini farqlay olmaydi.
              utilityCheckedAt: new Date(),
            }
          : {}),
        vacantArea: new Prisma.Decimal(vacantArea),
        // Maydon land_area'dan olingan bo'lsa, ikkala ustunni ham yangilaymiz.
        ...(areaOverride ? { area: areaOverride, buildingArea: areaOverride } : {}),
        syncStatus: "SYNCED",
        lastSyncedAt: new Date(),
        // API2 (asosiy ma'lumot) shu qayta tekshiruvda xato bergan bo'lsa ko'rinadi,
        // aks holda tozalanadi (avvalgi xato eskirgan bo'lardi).
        lastSyncError: baseError,
      },
    });

    if (refreshRent) {
      // Ijara shartnomalari: to'liq almashtiramiz (API "haqiqat manbai").
      if (isRentApiConfigured()) {
        await tx.rentContract.deleteMany({ where: { propertyId } });
        if (rent!.contracts.length > 0) {
          await tx.rentContract.createMany({
            data: rent!.contracts.map((c) => ({
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
              matchedByOldCad: rent!.matchedByOldCad,
            })),
          });
        }
      }
    }
  });

  return "success";
}
