import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface RegionStat {
  regionId: string;
  name: string;
  total: number;
  inefficient: number;
}

export interface CategoryStat {
  code: number | null; // null = kategoriyasiz
  count: number;
}

export interface DashboardStats {
  total: number;
  inefficient: number;
  synced: number;
  pending: number;
  failed: number;
  byRegion: RegionStat[];
  byCategory: CategoryStat[];
}

// DIQQAT: unstable_cache natijani serializatsiya qiladi — faqat oddiy tiplar
// (number/string) qaytaramiz, Date qaytarmaymiz.
async function computeDashboardStats(): Promise<DashboardStats> {
  const [total, inefficient, synced, pending, failed, regions, totalByRegion, inefByRegion, byCategoryRaw] =
    await Promise.all([
      prisma.property.count(),
      prisma.property.count({ where: { isInefficient: true } }),
      prisma.property.count({ where: { syncStatus: "SYNCED" } }),
      prisma.property.count({ where: { syncStatus: "PENDING" } }),
      prisma.property.count({ where: { syncStatus: "FAILED" } }),
      prisma.region.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.property.groupBy({ by: ["regionId"], _count: { _all: true } }),
      prisma.property.groupBy({ by: ["regionId"], _count: { _all: true }, where: { isInefficient: true } }),
      // Effektiv kategoriya (integratsiya > qo'lda) bo'yicha — COALESCE bilan.
      prisma.$queryRaw<{ code: number | null; count: number }[]>`
        SELECT COALESCE("integrationCategoryCode", "manualCategoryCode") AS code,
               COUNT(*)::int AS count
        FROM "Property"
        GROUP BY 1
        ORDER BY 1
      `,
    ]);

  const totalMap = new Map(totalByRegion.map((r) => [r.regionId, r._count._all]));
  const inefMap = new Map(inefByRegion.map((r) => [r.regionId, r._count._all]));

  const byRegion: RegionStat[] = regions.map((r) => ({
    regionId: r.id,
    name: r.name,
    total: totalMap.get(r.id) ?? 0,
    inefficient: inefMap.get(r.id) ?? 0,
  }));

  return {
    total,
    inefficient,
    synced,
    pending,
    failed,
    byRegion,
    byCategory: byCategoryRaw.map((c) => ({ code: c.code, count: Number(c.count) })),
  };
}

// Keshlash: "dashboard" tegi bilan (web tomonidagi o'zgarishlarda revalidateTag)
// + 60s TTL — worker (alohida process) revalidateTag chaqira olmaydi, shuning uchun
// fon sinxronizatsiyasi natijalari eng kechi 60 soniyada ko'rinadi.
export const getDashboardStats = unstable_cache(computeDashboardStats, ["dashboard-stats-v1"], {
  tags: ["dashboard"],
  revalidate: 60,
});
