import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";

export interface RegionStat {
  regionId: string;
  name: string;
  sortOrder: number;
  /** Obyektlar soni (Kadastr agentligi ma'lumoti bo'yicha) */
  total: number;
  /** Ijaraga berilgan obyektlar soni (kadastr raqami bo'yicha) */
  rentedObjects: number;
  /** Ijaraga berilishi (%) */
  rentedPct: number;
  /** Shartnomalar soni */
  contractCount: number;
  /** Ijara maydoni (kv.m) */
  rentArea: number;
  /** Yillik ijara summasi */
  rentSum: number;
  inefficient: number;
}

export interface CategoryStat {
  code: number | null;
  count: number;
}

/** Hudud × kategoriya kesishmasi. `counts` kaliti: kategoriya kodi. */
export interface RegionCategoryRow {
  regionId: string;
  name: string;
  total: number;
  counts: Record<string, number>;
  /**
   * Ijara xususiyati bo'yicha kesim — EFFEKTIV kategoriyadan qat'i nazar.
   * Obyekt sotilgan bo'lsa ham, ijara shartnomasi bor bo'lsa shu yerda sanaladi.
   */
  rentBreakdown: {
    /** Tekin foydalanish (shartnoma bor, jami summa 0) */
    free: RentAreaStat;
    /** Ijara shartnomasi bor (jami summa > 0) */
    paid: RentAreaStat;
    /** Bo'sh maydoni bor (ijarasi bor, lekin maydon to'liq band emas) */
    hasVacant: { count: number; area: number };
    /**
     * Kat 5 (Tekin foydalanish) yoki kat 6 (Ijara shartnomasi bor) — FAQAT shu ikkisiga EFFEKTIV
     * kategoriyasi bo'yicha tegishli obyektlar (`counts["5"] + counts["6"]`). `free`/`paid` dan farqli:
     * ular xususiyat bo'yicha (savdodagi obyekt ham kirishi mumkin), bu yerda faqat sof kat 5/6.
     */
    onlyFreeOrPaidCategory: { count: number };
    /** Bo'sh turgan (kat 11) — ijara yo'q, butun foydali maydon bo'sh */
    vacant: { count: number; usefulArea: number };
    /**
     * To'liq ijaraga berilgan: ijara shartnomasi bor (tekin foydalanish yoki pullik —
     * ikkisidan biri yoki ikkisi birga) VA foydali maydon to'liq band (vacantArea = 0).
     */
    fullyRented: { count: number };
    /** Savdodagi lotlar — obyekt ikkalasida ham bo'lishi mumkin (kat 3 va 4). */
    privatizationLot: { count: number; rentContracts: number; rentedObjects: number };
    rentLot: { count: number; area: number; rentContracts: number; rentedObjects: number };
    /**
     * Xususiylashtirish YOKI ijara savdosida turgan obyektlar (hasPrivatizationLot OR hasRentLot) —
     * ikkalasida ham bo'lgan obyekt FAQAT BIR marta sanaladi (kat3.count + kat4.count emas, chunki
     * 44 ta obyekt ikkalasida ham bor — qo'shsak ikki marta hisoblanardi).
     */
    onAnyAuction: { count: number };
    /** Kat 1 (Sotilgan, bo'lib to'lash) obyektlaridan ijara shartnomasi borlari soni. */
    installmentSoldRented: { count: number };
    /** Kat 7 (Savdoga chiqarish jarayonida) obyektlaridan ijara shartnomasi borlari soni. */
    onAuctionProcessRented: { count: number };
  };
}

export interface RentAreaStat {
  count: number;
  /** Foydali maydon (object_area_u) yig'indisi */
  usefulArea: number;
  /** Ijaraga berilgan maydon */
  rentedArea: number;
  /** Bo'sh maydon = foydali − ijaraga berilgan (manfiy bo'lsa 0) */
  vacantArea: number;
}

export interface DashboardStats {
  total: number;
  inefficient: number;
  synced: number;
  pending: number;
  failed: number;
  /** JAMI qatori (barcha hududlar yig'indisi) */
  totals: Omit<RegionStat, "regionId" | "name" | "sortOrder">;
  byRegion: RegionStat[];
  byCategory: CategoryStat[];
  /** Hudud × kategoriya jadvali (JAMI qatori UI'da hisoblanadi). */
  byRegionCategory: RegionCategoryRow[];
}

// DIQQAT: unstable_cache natijani serializatsiya qiladi — faqat oddiy tiplar.
async function computeDashboardStats(): Promise<DashboardStats> {
  const [total, inefficient, synced, pending, failed, regionRows, byCategoryRaw] = await Promise.all([
    prisma.property.count(),
    prisma.property.count({ where: { isInefficient: true } }),
    prisma.property.count({ where: { syncStatus: "SYNCED" } }),
    prisma.property.count({ where: { syncStatus: "PENDING" } }),
    prisma.property.count({ where: { syncStatus: "FAILED" } }),
    // Hudud kesimi — bitta so'rovda (obyekt, ijara, shartnoma, maydon, summa).
    prisma.$queryRawUnsafe<
      {
        id: string;
        name: string;
        sortOrder: number;
        total: bigint;
        inefficient: bigint;
        rented: bigint;
        contracts: bigint;
        area: string | null;
        sum: string | null;
      }[]
    >(`
      SELECT r.id, r.name, r."sortOrder",
             COUNT(p.id)                                              AS total,
             COUNT(p.id) FILTER (WHERE p."isInefficient")             AS inefficient,
             COUNT(p.id) FILTER (WHERE p."rentContractCount" > 0)     AS rented,
             COALESCE(SUM(p."rentContractCount"), 0)                  AS contracts,
             COALESCE(SUM(p."rentTotalArea"), 0)                      AS area,
             COALESCE(SUM(p."rentTotalSum"), 0)                       AS sum
      FROM "Region" r
      LEFT JOIN "Property" p ON p."regionId" = r.id
      GROUP BY r.id, r.name, r."sortOrder"
      ORDER BY r."sortOrder", r.name
    `),
    prisma.$queryRaw<{ code: number | null; count: number }[]>`
      SELECT COALESCE("integrationCategoryCode", "manualCategoryCode") AS code,
             COUNT(*)::int AS count
      FROM "Property"
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  // Hudud × kategoriya (effektiv kategoriya bo'yicha).
  const regionCategoryRaw = await prisma.$queryRawUnsafe<
    { regionId: string; code: number | null; count: bigint }[]
  >(`
    SELECT p."regionId",
           COALESCE(p."integrationCategoryCode", p."manualCategoryCode") AS code,
           COUNT(*) AS count
    FROM "Property" p
    GROUP BY 1, 2
  `);

  // Ijara xususiyati bo'yicha kesim — kategoriyaga BOG'LIQ EMAS.
  // "Bo'sh maydon" = foydali maydon (buildingArea) − ijaraga berilgan (rentTotalArea).
  const rentRaw = await prisma.$queryRawUnsafe<
    {
      regionId: string;
      freeCount: bigint; freeUseful: string | null; freeRented: string | null; freeVacant: string | null;
      paidCount: bigint; paidUseful: string | null; paidRented: string | null; paidVacant: string | null;
      hasVacantCount: bigint; hasVacantArea: string | null;
      vacantCount: bigint; vacantUseful: string | null;
      privLotCount: bigint; rentLotCount: bigint; rentLotArea: string | null;
      privLotContracts: string | null; rentLotOnlyContracts: string | null;
      fullyRentedCount: bigint;
      privLotRentedObjects: bigint; rentLotOnlyRentedObjects: bigint;
      cat1RentedObjects: bigint; cat7RentedObjects: bigint;
      onAnyAuctionCount: bigint;
    }[]
  >(`
    WITH r AS (
      SELECT "regionId",
             COALESCE("buildingArea", 0)      AS useful,
             COALESCE("rentTotalArea", 0)     AS rented,
             COALESCE("rentTotalSum", 0)      AS sum,
             COALESCE("rentContractCount", 0) AS cnt,
             COALESCE("vacantArea", 0)        AS vacant,
             COALESCE("auctionTotalArea", 0)  AS lotarea,
             "hasPrivatizationLot"            AS priv,
             "hasRentLot"                     AS rentlot,
             COALESCE("integrationCategoryCode", "manualCategoryCode") AS cat
      FROM "Property"
    )
    SELECT "regionId",
           COUNT(*) FILTER (WHERE cnt > 0 AND sum = 0)  AS "freeCount",
           COALESCE(SUM(useful) FILTER (WHERE cnt > 0 AND sum = 0), 0) AS "freeUseful",
           COALESCE(SUM(rented) FILTER (WHERE cnt > 0 AND sum = 0), 0) AS "freeRented",
           COALESCE(SUM(vacant) FILTER (WHERE cnt > 0 AND sum = 0), 0) AS "freeVacant",
           COUNT(*) FILTER (WHERE cnt > 0 AND sum > 0)  AS "paidCount",
           COALESCE(SUM(useful) FILTER (WHERE cnt > 0 AND sum > 0), 0) AS "paidUseful",
           COALESCE(SUM(rented) FILTER (WHERE cnt > 0 AND sum > 0), 0) AS "paidRented",
           COALESCE(SUM(vacant) FILTER (WHERE cnt > 0 AND sum > 0), 0) AS "paidVacant",
           COUNT(*)      FILTER (WHERE cnt > 0 AND vacant > 0) AS "hasVacantCount",
           COALESCE(SUM(vacant) FILTER (WHERE cnt > 0 AND vacant > 0), 0) AS "hasVacantArea",
           -- To'liq ijaraga berilgan: shartnoma bor (tekin yoki pullik) VA foydali maydon
           -- to'liq band (bo'sh joy qolmagan).
           COUNT(*)      FILTER (WHERE cnt > 0 AND vacant = 0) AS "fullyRentedCount",
           COUNT(*)      FILTER (WHERE cat = 11) AS "vacantCount",
           COALESCE(SUM(useful) FILTER (WHERE cat = 11), 0) AS "vacantUseful",
           COUNT(*)      FILTER (WHERE priv)    AS "privLotCount",
           COUNT(*)      FILTER (WHERE rentlot) AS "rentLotCount",
           COALESCE(SUM(lotarea) FILTER (WHERE rentlot), 0) AS "rentLotArea",
           -- Xususiylashtirish YOKI ijara savdosida (birlashma, takror sanalmaydi).
           COUNT(*)      FILTER (WHERE priv OR rentlot) AS "onAnyAuctionCount",
           -- Ijara shartnoma soni kat 3/4 ustunlari uchun: xususiylashtirish lotida bo'lsa
           -- (ijara lotida ham bo'lsa ham) kat 3 ga, faqat ijara lotida bo'lsa kat 4 ga.
           COALESCE(SUM(cnt) FILTER (WHERE priv), 0) AS "privLotContracts",
           COALESCE(SUM(cnt) FILTER (WHERE rentlot AND NOT priv), 0) AS "rentLotOnlyContracts",
           -- Ijaraga berilgan OBYEKTLAR soni (shartnoma soni emas) — kat 3/4 va 1/7 uchun.
           COUNT(*) FILTER (WHERE priv AND cnt > 0)               AS "privLotRentedObjects",
           COUNT(*) FILTER (WHERE rentlot AND NOT priv AND cnt > 0) AS "rentLotOnlyRentedObjects",
           COUNT(*) FILTER (WHERE cat = 1 AND cnt > 0)            AS "cat1RentedObjects",
           COUNT(*) FILTER (WHERE cat = 7 AND cnt > 0)            AS "cat7RentedObjects"
    FROM r GROUP BY 1
  `);

  const byRegion: RegionStat[] = regionRows.map((r) => {
    const t = Number(r.total);
    const rented = Number(r.rented);
    return {
      regionId: r.id,
      name: r.name,
      sortOrder: r.sortOrder,
      total: t,
      inefficient: Number(r.inefficient),
      rentedObjects: rented,
      rentedPct: t > 0 ? Math.round((rented / t) * 1000) / 10 : 0,
      contractCount: Number(r.contracts),
      rentArea: Number(r.area ?? 0),
      rentSum: Number(r.sum ?? 0),
    };
  });

  // Hudud × kategoriya jadvalini yig'amiz (hududlar tartibi saqlanadi).
  const countsByRegion = new Map<string, Record<string, number>>();
  for (const row of regionCategoryRaw) {
    const key = row.code == null ? "none" : String(row.code);
    const rec = countsByRegion.get(row.regionId) ?? {};
    rec[key] = (rec[key] ?? 0) + Number(row.count);
    countsByRegion.set(row.regionId, rec);
  }
  const rentByRegion = new Map(rentRaw.map((r) => [r.regionId, r]));
  const n = (v: string | null | undefined) => Number(v ?? 0);

  const byRegionCategory: RegionCategoryRow[] = byRegion.map((r) => {
    const rr = rentByRegion.get(r.regionId);
    const mk = (
      count: bigint | undefined,
      useful: string | null | undefined,
      rented: string | null | undefined,
      vacant: string | null | undefined,
    ): RentAreaStat => ({
      count: Number(count ?? 0),
      usefulArea: n(useful),
      rentedArea: n(rented),
      // Obyekt darajasida hisoblangan bo'sh maydonlar yig'indisi (manfiy emas).
      vacantArea: n(vacant),
    });
    const counts = countsByRegion.get(r.regionId) ?? {};
    return {
      regionId: r.regionId,
      name: r.name,
      total: r.total,
      counts,
      rentBreakdown: {
        free: mk(rr?.freeCount, rr?.freeUseful, rr?.freeRented, rr?.freeVacant),
        paid: mk(rr?.paidCount, rr?.paidUseful, rr?.paidRented, rr?.paidVacant),
        hasVacant: { count: Number(rr?.hasVacantCount ?? 0), area: n(rr?.hasVacantArea) },
        onlyFreeOrPaidCategory: { count: (counts["5"] ?? 0) + (counts["6"] ?? 0) },
        vacant: { count: Number(rr?.vacantCount ?? 0), usefulArea: n(rr?.vacantUseful) },
        fullyRented: { count: Number(rr?.fullyRentedCount ?? 0) },
        privatizationLot: {
          count: Number(rr?.privLotCount ?? 0),
          rentContracts: n(rr?.privLotContracts),
          rentedObjects: Number(rr?.privLotRentedObjects ?? 0),
        },
        rentLot: {
          count: Number(rr?.rentLotCount ?? 0),
          area: n(rr?.rentLotArea),
          rentContracts: n(rr?.rentLotOnlyContracts),
          rentedObjects: Number(rr?.rentLotOnlyRentedObjects ?? 0),
        },
        installmentSoldRented: { count: Number(rr?.cat1RentedObjects ?? 0) },
        onAuctionProcessRented: { count: Number(rr?.cat7RentedObjects ?? 0) },
        onAnyAuction: { count: Number(rr?.onAnyAuctionCount ?? 0) },
      },
    };
  });

  // JAMI — hududlar yig'indisi (foiz alohida hisoblanadi, o'rtacha emas).
  const sum = (f: (s: RegionStat) => number) => byRegion.reduce((a, s) => a + f(s), 0);
  const totalObjects = sum((s) => s.total);
  const totalRented = sum((s) => s.rentedObjects);

  return {
    total,
    inefficient,
    synced,
    pending,
    failed,
    totals: {
      total: totalObjects,
      inefficient: sum((s) => s.inefficient),
      rentedObjects: totalRented,
      rentedPct: totalObjects > 0 ? Math.round((totalRented / totalObjects) * 1000) / 10 : 0,
      contractCount: sum((s) => s.contractCount),
      rentArea: sum((s) => s.rentArea),
      rentSum: sum((s) => s.rentSum),
    },
    byRegion,
    byCategory: byCategoryRaw.map((c) => ({ code: c.code, count: Number(c.count) })),
    byRegionCategory,
  };
}

// Keshlash: "dashboard" tegi + 60s TTL (worker alohida process — revalidateTag chaqira olmaydi).
export const getDashboardStats = unstable_cache(computeDashboardStats, ["dashboard-stats-v7"], {
  tags: ["dashboard"],
  revalidate: 60,
});

export type DashboardColumnSub = { label: string; area?: boolean; get: (r: RegionCategoryRow) => number };
export type DashboardColumn = { code: number; short: string; nameUz: string; subs: DashboardColumnSub[] };

/**
 * "Davlat obyektlaridan foydalanish markazi balansidagi obyektlar" jadvalining ustun
 * tuzilishi — sahifa (UI) va Excel eksporti bir xil mantiqni ishlatishi uchun shu yerda
 * markazlashtirilgan (properties.ts dagi buildWhere() bilan bir xil printsip).
 */
export function buildDashboardColumns(): DashboardColumn[] {
  return CATEGORIES.map((c) => {
    const base = { code: c.code, short: c.short, nameUz: c.nameUz };
    switch (c.code) {
      case 1:
        return {
          ...base,
          subs: [
            { label: "Soni", get: (r: RegionCategoryRow) => r.counts[String(c.code)] ?? 0 },
            // { label: "Ijaraga berilgan obyektlar soni", get: (r: RegionCategoryRow) => r.rentBreakdown.installmentSoldRented.count },
          ],
        };
      case 3:
        return {
          ...base,
          subs: [
            { label: "Soni", get: (r: RegionCategoryRow) => r.rentBreakdown.privatizationLot.count },
            // { label: "Ijara shartnoma soni", get: (r: RegionCategoryRow) => r.rentBreakdown.privatizationLot.rentContracts },
            // { label: "Ijaraga berilgan obyektlar soni", get: (r: RegionCategoryRow) => r.rentBreakdown.privatizationLot.rentedObjects },
          ],
        };
      case 4:
        return {
          ...base,
          subs: [
            { label: "Soni", get: (r: RegionCategoryRow) => r.rentBreakdown.rentLot.count },
            { label: "Maydon", area: true, get: (r: RegionCategoryRow) => r.rentBreakdown.rentLot.area },
            // { label: "Ijara shartnoma soni", get: (r: RegionCategoryRow) => r.rentBreakdown.rentLot.rentContracts },
            // { label: "Ijaraga berilgan obyektlar soni", get: (r: RegionCategoryRow) => r.rentBreakdown.rentLot.rentedObjects },
          ],
        };
      case 7:
        return {
          ...base,
          subs: [
            { label: "Soni", get: (r: RegionCategoryRow) => r.counts[String(c.code)] ?? 0 },
            // { label: "Ijaraga berilgan obyektlar soni", get: (r: RegionCategoryRow) => r.rentBreakdown.onAuctionProcessRented.count },
          ],
        };
      case 5:
        return {
          ...base,
          subs: [
            { label: "Soni", get: (r: RegionCategoryRow) => r.rentBreakdown.free.count },
            { label: "Foydali maydon", area: true, get: (r: RegionCategoryRow) => r.rentBreakdown.free.usefulArea },
            { label: "Ijara maydoni", area: true, get: (r: RegionCategoryRow) => r.rentBreakdown.free.rentedArea },
            { label: "Bo‘sh maydon", area: true, get: (r: RegionCategoryRow) => r.rentBreakdown.free.vacantArea },
          ],
        };
      case 6:
        return {
          ...base,
          subs: [
            { label: "Soni", get: (r: RegionCategoryRow) => r.rentBreakdown.paid.count },
            { label: "Foydali maydon", area: true, get: (r: RegionCategoryRow) => r.rentBreakdown.paid.usefulArea },
            { label: "Ijara maydoni", area: true, get: (r: RegionCategoryRow) => r.rentBreakdown.paid.rentedArea },
            { label: "Bo‘sh maydon", area: true, get: (r: RegionCategoryRow) => r.rentBreakdown.paid.vacantArea },
          ],
        };
      case 11:
        return {
          ...base,
          subs: [
            { label: "Soni", get: (r: RegionCategoryRow) => r.rentBreakdown.vacant.count },
            { label: "Maydoni", area: true, get: (r: RegionCategoryRow) => r.rentBreakdown.vacant.usefulArea },
          ],
        };
      case 12:
        return {
          ...base,
          subs: [
            { label: "Soni", get: (r: RegionCategoryRow) => r.rentBreakdown.hasVacant.count },
            { label: "Bo'sh maydoni", area: true, get: (r: RegionCategoryRow) => r.rentBreakdown.hasVacant.area },
          ],
        };
      default:
        return { ...base, subs: [{ label: "Soni", get: (r: RegionCategoryRow) => r.counts[String(c.code)] ?? 0 }] };
    }
  });
}
