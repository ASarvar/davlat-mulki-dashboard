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

/** Hudud × kategoriya kesishmasi. `counts` kaliti: kategoriya kodi yoki "none". */
export interface RegionCategoryRow {
  regionId: string;
  name: string;
  total: number;
  counts: Record<string, number>;
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
  const byRegionCategory: RegionCategoryRow[] = byRegion.map((r) => ({
    regionId: r.regionId,
    name: r.name,
    total: r.total,
    counts: countsByRegion.get(r.regionId) ?? {},
  }));

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
export const getDashboardStats = unstable_cache(computeDashboardStats, ["dashboard-stats-v3"], {
  tags: ["dashboard"],
  revalidate: 60,
});
