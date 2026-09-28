import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/authz";
import { buildWhere } from "./properties";
import { listSourceNames } from "./sources";

/**
 * "Balansga olinganlar" hisoboti — `/dashboard/balans` (2026-09-28, KPI uchun).
 *
 * Sana — `Property.balanceDate` (kadastrdagi huquq ro'yxatdan o'tgan sana,
 * `lib/balance.ts`). Hudud — obyekt JOYLASHGAN hudud (`Property.regionId`, kadastr
 * prefiksi), respublika darajasidagi tashkilotlar obyektlari ham shu hududga kiradi.
 *
 * ⚠️ Sonlar `buildWhere()` bilan sanaladi — obyektlar ro'yxati ham aynan shu
 * funksiyani ishlatadi, ya'ni katakdagi son va bosilganda ochiladigan ro'yxat hech
 * qachon ajralmaydi (rol doirasi ham, balansdan chiqarilganlarni tashlash ham bir xil).
 */

export interface BalanceRow {
  regionId: string;
  regionName: string;
  bySoha: Record<string, number>;
  total: number;
}

export interface BalanceReport {
  /** Ustunlar — soha nomlari (Ijara markazi birinchi). Soha tanlangan bo'lsa faqat o'sha. */
  sohas: string[];
  rows: BalanceRow[];
  totals: { bySoha: Record<string, number>; total: number };
  /** O'tgan oy jami — taqqoslash uchun (xuddi shu doira va soha). */
  previousTotal: number;
  /** Doiradagi, lekin kadastrda huquq sanasi yo'q obyektlar (hisobotga kira olmaydi). */
  undated: number;
}

export async function balanceByRegion(
  user: SessionUser,
  opts: { from: string; to: string; prevFrom: string; prevTo: string; soha?: string },
): Promise<BalanceReport> {
  const { from, to, prevFrom, prevTo, soha } = opts;

  const [where, prevWhere, scopeWhere, allSohas, regions] = await Promise.all([
    buildWhere(user, { soha, balanceFrom: from, balanceTo: to }),
    buildWhere(user, { soha, balanceFrom: prevFrom, balanceTo: prevTo }),
    buildWhere(user, { soha }),
    listSourceNames(),
    prisma.region.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);

  const [groups, previousTotal, undated] = await Promise.all([
    prisma.property.groupBy({ by: ["regionId", "sourceId"], where, _count: { _all: true } }),
    prisma.property.count({ where: prevWhere }),
    prisma.property.count({ where: { AND: [scopeWhere, { balanceDate: null }] } }),
  ]);

  const sourceIds = [...new Set(groups.map((g) => g.sourceId))];
  const sources = await prisma.organizationSource.findMany({
    where: { id: { in: sourceIds } },
    select: { id: true, name: true },
  });
  const sohaOf = new Map(sources.map((s) => [s.id, s.name]));

  const sohas = (soha ? [soha] : allSohas).slice().sort((a, b) =>
    a === "Ijara markazi" ? -1 : b === "Ijara markazi" ? 1 : 0,
  );
  const empty = () => Object.fromEntries(sohas.map((s) => [s, 0])) as Record<string, number>;

  const byRegion = new Map<string, Record<string, number>>();
  for (const g of groups) {
    const name = sohaOf.get(g.sourceId);
    if (!name) continue;
    const cell = byRegion.get(g.regionId) ?? empty();
    cell[name] = (cell[name] ?? 0) + g._count._all;
    byRegion.set(g.regionId, cell);
  }

  const totals = { bySoha: empty(), total: 0 };
  const rows = regions.map((r) => {
    const bySoha = byRegion.get(r.id) ?? empty();
    const total = Object.values(bySoha).reduce((a, b) => a + b, 0);
    for (const s of sohas) totals.bySoha[s] += bySoha[s] ?? 0;
    totals.total += total;
    return { regionId: r.id, regionName: r.name, bySoha, total };
  });

  return { sohas, rows, totals, previousTotal, undated };
}
