import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

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
    /** Bo'sh turgan (kat 11) — ijara yo'q, butun foydali maydon bo'sh */
    vacant: { count: number; usefulArea: number };
    /** Savdodagi lotlar — obyekt ikkalasida ham bo'lishi mumkin (kat 3 va 4). */
    privatizationLot: { count: number };
    rentLot: { count: number; area: number };
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
           COUNT(*)      FILTER (WHERE cat = 11) AS "vacantCount",
           COALESCE(SUM(useful) FILTER (WHERE cat = 11), 0) AS "vacantUseful",
           COUNT(*)      FILTER (WHERE priv)    AS "privLotCount",
           COUNT(*)      FILTER (WHERE rentlot) AS "rentLotCount",
           COALESCE(SUM(lotarea) FILTER (WHERE rentlot), 0) AS "rentLotArea"
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
    return {
      regionId: r.regionId,
      name: r.name,
      total: r.total,
      counts: countsByRegion.get(r.regionId) ?? {},
      rentBreakdown: {
        free: mk(rr?.freeCount, rr?.freeUseful, rr?.freeRented, rr?.freeVacant),
        paid: mk(rr?.paidCount, rr?.paidUseful, rr?.paidRented, rr?.paidVacant),
        hasVacant: { count: Number(rr?.hasVacantCount ?? 0), area: n(rr?.hasVacantArea) },
        vacant: { count: Number(rr?.vacantCount ?? 0), usefulArea: n(rr?.vacantUseful) },
        privatizationLot: { count: Number(rr?.privLotCount ?? 0) },
        rentLot: { count: Number(rr?.rentLotCount ?? 0), area: n(rr?.rentLotArea) },
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
