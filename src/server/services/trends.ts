import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sourceCond, type StatsScope } from "./stats";

/**
 * HODISAVIY trendlar — haqiqiy vaqt qatori.
 *
 * ⚠️ Nima uchun faqat shu ikki manba: `Property` ning statistika ustunlari har
 * sinxronizatsiyada USTIDAN YOZILADI, ya'ni "o'tgan oyda nechta obyekt bo'sh turgan
 * edi" degan savolga bazada javob YO'Q. Sana saqlaydigan yagona jadvallar —
 * `RentContract.contractDate` (shartnoma tuzilgan sana) va `AuctionLot.auctionDate`.
 *
 * ⚠️ `AuctionLot` har sinxronizatsiyada `deleteMany + createMany` bilan almashtiriladi,
 * shuning uchun auksion trendi FAQAT HOZIRGI faol lotlar kesimi — tarixiy qator EMAS.
 * Grafik ostida buni aniq yozish shart, aks holda "auksionlar kamaydi" degan yolg'on
 * xulosa chiqarilardi.
 */

export interface TrendPoint {
  /** "YYYY-MM" */
  month: string;
  count: number;
  /** Maydon, m² (ijara trendida). */
  area: number;
}

const MONTHS = 24;

/** Bo'sh oylarni nol bilan to'ldiradi — aks holda grafik oyni butunlay tashlab ketardi. */
function fillMonths(rows: { month: string; count: number; area: number }[]): TrendPoint[] {
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const out: TrendPoint[] = [];
  const now = new Date();
  for (let i = MONTHS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const hit = byMonth.get(key);
    out.push({ month: key, count: hit?.count ?? 0, area: hit?.area ?? 0 });
  }
  return out;
}

export interface RentTrend {
  points: TrendPoint[];
  /** Sanasi ko'rsatilmagan shartnomalar — grafik yig'indisi KPI'dan kichik chiqishini tushuntiradi. */
  undated: number;
}

async function computeRentContractTrend(scope: StatsScope = {}): Promise<RentTrend> {
  const cond = sourceCond(scope, Prisma.sql`p.`);

  // ⚠️ `AT TIME ZONE 'Asia/Tashkent'` — konteyner UTC da ishlaydi, usiz oy chegarasi
  // 5 soatga siljib, oyning birinchi kunidagi shartnomalar oldingi oyga tushardi.
  const rows = await prisma.$queryRaw<{ month: string; count: number; area: number }[]>(Prisma.sql`
    SELECT to_char(date_trunc('month', c."contractDate" AT TIME ZONE 'Asia/Tashkent'), 'YYYY-MM') AS month,
           COUNT(*)::int AS count,
           COALESCE(SUM(c."rentalArea"), 0)::float8 AS area
    FROM "RentContract" c
    JOIN "Property" p ON p.id = c."propertyId"
    WHERE c."contractDate" IS NOT NULL
      AND c."contractDate" >= now() - (${MONTHS} || ' months')::interval
      AND ${cond}
    GROUP BY 1
    ORDER BY 1
  `);

  const undatedRows = await prisma.$queryRaw<{ n: number }[]>(Prisma.sql`
    SELECT COUNT(*)::int AS n
    FROM "RentContract" c
    JOIN "Property" p ON p.id = c."propertyId"
    WHERE c."contractDate" IS NULL AND ${cond}
  `);

  return { points: fillMonths(rows), undated: undatedRows[0]?.n ?? 0 };
}

async function computeAuctionTrend(scope: StatsScope = {}): Promise<TrendPoint[]> {
  const cond = sourceCond(scope, Prisma.sql`p.`);
  const rows = await prisma.$queryRaw<{ month: string; count: number; area: number }[]>(Prisma.sql`
    SELECT to_char(date_trunc('month', l."auctionDate" AT TIME ZONE 'Asia/Tashkent'), 'YYYY-MM') AS month,
           COUNT(*)::int AS count,
           COALESCE(SUM(l."area"), 0)::float8 AS area
    FROM "AuctionLot" l
    JOIN "Property" p ON p.id = l."propertyId"
    WHERE l."auctionDate" IS NOT NULL
      AND l."auctionDate" >= now() - (${MONTHS} || ' months')::interval
      AND ${cond}
    GROUP BY 1
    ORDER BY 1
  `);
  return fillMonths(rows);
}

// ⚠️ Doira argument sifatida uzatiladi — kesh kaliti rol doirasini ham qamraydi.
export const getRentContractTrend = unstable_cache(computeRentContractTrend, ["rent-trend-v1"], {
  tags: ["dashboard"],
  revalidate: 60,
});
export const getAuctionTrend = unstable_cache(computeAuctionTrend, ["auction-trend-v1"], {
  tags: ["dashboard"],
  revalidate: 60,
});
