import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/authz";
import { buildWhere } from "./properties";

/**
 * "Balansga olinganlar" hisoboti — `/dashboard/balans` (2026-09-28, KPI uchun).
 *
 * Sana — `Property.balanceDate` (kadastrdagi huquq ro'yxatdan o'tgan sana,
 * `lib/balance.ts`). Hudud — obyekt JOYLASHGAN hudud (`Property.regionId`, kadastr
 * prefiksi), respublika darajasidagi tashkilotlar obyektlari ham shu hududga kiradi.
 *
 * Davrlar (2026-09-30): yil boshidan tanlangan kungacha, tanlangan oy, o'tgan oy va
 * tanlangan kun — har biri hudud kesimida alohida ustun.
 *
 * ⚠️ Sonlar `buildWhere()` bilan sanaladi — obyektlar ro'yxati ham aynan shu
 * funksiyani ishlatadi, ya'ni katakdagi son va bosilganda ochiladigan ro'yxat hech
 * qachon ajralmaydi (rol doirasi ham, balansdan chiqarilganlarni tashlash ham bir xil).
 */

/** Davr — ikkala chegara ham kiradi (`"YYYY-MM-DD"`). */
export interface Period {
  from: string;
  to: string;
}

export type PeriodKey = "ytd" | "month" | "prev" | "day";
export type PeriodCounts = Record<PeriodKey, number>;

export interface BalanceRow extends PeriodCounts {
  regionId: string;
  regionName: string;
}

export interface BalanceReport {
  /** Hududlar rasmiy tartibda (`Region.sortOrder`). */
  rows: BalanceRow[];
  totals: PeriodCounts;
  /** Doiradagi, lekin kadastrda huquq sanasi yo'q obyektlar (hisobotga kira olmaydi). */
  undated: number;
}

export async function balanceByRegion(
  user: SessionUser,
  opts: { periods: Record<PeriodKey, Period>; soha?: string },
): Promise<BalanceReport> {
  const { periods, soha } = opts;
  const keys = Object.keys(periods) as PeriodKey[];

  const [wheres, undatedWhere, regions] = await Promise.all([
    Promise.all(
      keys.map((k) => buildWhere(user, { soha, balanceFrom: periods[k].from, balanceTo: periods[k].to })),
    ),
    // ⚠️ Ro'yxat filtri (`balansNone=1`) bilan AYNAN bir xil — kartani bosganda shuncha obyekt.
    buildWhere(user, { soha, balanceUnknown: true }),
    prisma.region.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);

  const [groups, undated] = await Promise.all([
    Promise.all(wheres.map((where) => prisma.property.groupBy({ by: ["regionId"], where, _count: { _all: true } }))),
    prisma.property.count({ where: undatedWhere }),
  ]);

  const counts = new Map<string, number>(); // `${key}:${regionId}` → son
  keys.forEach((k, i) => {
    for (const g of groups[i]) counts.set(`${k}:${g.regionId}`, g._count._all);
  });

  const totals: PeriodCounts = { ytd: 0, month: 0, prev: 0, day: 0 };
  const rows = regions.map((r) => {
    const row: BalanceRow = { regionId: r.id, regionName: r.name, ytd: 0, month: 0, prev: 0, day: 0 };
    for (const k of keys) {
      row[k] = counts.get(`${k}:${r.id}`) ?? 0;
      totals[k] += row[k];
    }
    return row;
  });

  return { rows, totals, undated };
}
