import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { sourceScopeLabel } from "@/lib/sourceLabel";

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

/**
 * Hudud × kategoriya kesishmasi. `counts` kaliti: kategoriya kodi.
 * ⚠️ Bu tuzilma TUMAN kesimida ham ishlatiladi (`computeDistrictStats`) — o'shanda
 * `regionId` maydonida TUMAN id'si turadi. Ya'ni u "guruh identifikatori", jadval
 * qatorining kaliti; ustun mantiqi (`buildDashboardColumns`) ikkalasiga bir xil.
 */
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
  /**
   * Respublika darajasidagi (regionId=null) tashkilotlarning `byRegion`/`byRegionCategory`
   * OXIRIGA qo'shilgan qatorlari — `regionId` maydonida haqiqiy hudud EMAS, balki
   * `OrganizationSource.id` turadi. UI shu ro'yxat orqali ularni haqiqiy hududlardan
   * ajratadi (tuman ochish o'chiriladi, drill-down "region=" o'rniga "tashkilot=" ishlatadi).
   */
  nationalOrgIds: string[];
}

// DIQQAT: unstable_cache natijani serializatsiya qiladi — faqat oddiy tiplar.
// ── Guruhlangan agregatlar (hudud yoki tuman kesimi uchun BIR XIL mantiq) ──
// `gid` — guruh kaliti: hudud kesimida "regionId", tuman kesimida "districtId".
// ⚠️ Ikkala kesim ham SHU ikki funksiyani chaqiradi — SQL takrorlanmaydi, aks holda
// yangi ustun qo'shilganda biri yangilanib, ikkinchisi eskirib qolardi.
type CatRow = { gid: string | null; code: number | null; count: bigint };
type RentRow = {
  gid: string | null;
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
};

// Effektiv kategoriya bo'yicha sanoq.
/**
 * Statistika doirasi — IKKI mustaqil cheklov, AND bilan birikadi:
 *  - `sourceName` — foydalanuvchi TANLAYDIGAN soha filtri (dashboard'dagi manba tugmalari)
 *  - `sourceIds`  — ROL doirasi (`userSourceScope()`), foydalanuvchi o'zgartira olmaydi.
 *                   `null`/`undefined` = cheklovsiz, `[]` = hech narsa ko'rinmaydi.
 * ⚠️ Ikkalasini aralashtirmang: sohani foydalanuvchi almashtiradi, `sourceIds` esa
 * xavfsizlik chegarasi — u har doim qo'llanishi shart.
 */
export interface StatsScope {
  sourceName?: string;
  sourceIds?: string[] | null;
}

/**
 * Doirani SQL shartiga aylantiradi. `col` — `sourceId` ustuni ifodasi
 * (`p."sourceId"` yoki alias'siz `"sourceId"`). Qiymatlar PARAMETRLANADI.
 */
function sourceCond(scope: StatsScope, col: Prisma.Sql): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (scope.sourceName) {
    parts.push(Prisma.sql`${col} IN (SELECT id FROM "OrganizationSource" WHERE name = ${scope.sourceName})`);
  }
  if (scope.sourceIds != null) {
    // Bo'sh doira = biriktirilmagan foydalanuvchi: hech narsa ko'rmasligi kerak.
    if (scope.sourceIds.length === 0) return Prisma.sql`FALSE`;
    parts.push(Prisma.sql`${col} IN (${Prisma.join(scope.sourceIds)})`);
  }
  if (parts.length === 0) return Prisma.sql`TRUE`;
  return parts.reduce((a, b) => Prisma.sql`${a} AND ${b}`);
}

/** O'sha doiraning Prisma `where` ko'rinishi (count'lar uchun). */
function sourceWhere(scope: StatsScope): Prisma.PropertyWhereInput {
  const and: Prisma.PropertyWhereInput[] = [];
  if (scope.sourceName) and.push({ source: { name: scope.sourceName } });
  if (scope.sourceIds != null) and.push({ sourceId: { in: scope.sourceIds } });
  return and.length ? { AND: and } : {};
}

/**
 * Doira ichidagi RESPUBLIKA darajasidagi (regionId=null) tashkilotlar — masalan
 * "Davlat aktivlari agentligi"ning markaziy tashkiloti yoki "Direksiya". Ularning
 * obyektlari kadastr prefiksi orqali istalgan hududga tarqalgan bo'lishi mumkin —
 * shuning uchun hudud jadvalida ALOHIDA qator sifatida ko'rsatiladi (hech qanday
 * hudud qatoriga QO'SHILMAYDI, aks holda qaysi hisob qayerdan kelgani ko'rinmay qolardi).
 */
async function nationalOrgRows(scope: StatsScope): Promise<{ id: string; name: string }[]> {
  const where: Prisma.OrganizationSourceWhereInput = { regionId: null };
  if (scope.sourceName) where.name = scope.sourceName;
  if (scope.sourceIds != null) {
    if (scope.sourceIds.length === 0) return [];
    where.id = { in: scope.sourceIds };
  }
  return prisma.organizationSource.findMany({ where, select: { id: true, name: true } });
}

function categoryCountRows(groupCol: Prisma.Sql, cond: Prisma.Sql) {
  return prisma.$queryRaw<CatRow[]>(Prisma.sql`
    SELECT ${groupCol} AS gid,
           COALESCE(p."integrationCategoryCode", p."manualCategoryCode", 11) AS code,
           COUNT(*) AS count
    FROM "Property" p
    WHERE ${cond}
    GROUP BY 1, 2
  `);
}

// Ijara xususiyati bo'yicha kesim — kategoriyaga BOG'LIQ EMAS.
// "Bo'sh maydon" = foydali maydon (buildingArea) − ijaraga berilgan (rentTotalArea).
function rentBreakdownRows(groupCol: Prisma.Sql, cond: Prisma.Sql) {
  return prisma.$queryRaw<RentRow[]>(Prisma.sql`
    WITH r AS (
      SELECT ${groupCol} AS gid,
             COALESCE(p."buildingArea", 0)      AS useful,
             COALESCE(p."rentTotalArea", 0)     AS rented,
             COALESCE(p."rentTotalSum", 0)      AS sum,
             COALESCE(p."rentContractCount", 0) AS cnt,
             COALESCE(p."vacantArea", 0)        AS vacant,
             COALESCE(p."auctionTotalArea", 0)  AS lotarea,
             p."hasPrivatizationLot"            AS priv,
             p."hasRentLot"                     AS rentlot,
             COALESCE(p."integrationCategoryCode", p."manualCategoryCode", 11) AS cat
      FROM "Property" p
      WHERE ${cond}
    )
    SELECT gid,
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
}

const n0 = (v: string | null | undefined) => Number(v ?? 0);

// Guruh (hudud/tuman) uchun bitta qatorni yig'adi — jadval ustunlari shu tuzilmadan o'qiydi.
function buildRow(
  id: string,
  name: string,
  counts: Record<string, number>,
  rr: RentRow | undefined,
): RegionCategoryRow {
  const mk = (
    count: bigint | undefined,
    useful: string | null | undefined,
    rented: string | null | undefined,
    vacant: string | null | undefined,
  ): RentAreaStat => ({
    count: Number(count ?? 0),
    usefulArea: n0(useful),
    rentedArea: n0(rented),
    vacantArea: n0(vacant),
  });

  return {
    regionId: id,
    name,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    counts,
    rentBreakdown: {
      free: mk(rr?.freeCount, rr?.freeUseful, rr?.freeRented, rr?.freeVacant),
      paid: mk(rr?.paidCount, rr?.paidUseful, rr?.paidRented, rr?.paidVacant),
      hasVacant: { count: Number(rr?.hasVacantCount ?? 0), area: n0(rr?.hasVacantArea) },
      onlyFreeOrPaidCategory: { count: (counts["5"] ?? 0) + (counts["6"] ?? 0) },
      vacant: { count: Number(rr?.vacantCount ?? 0), usefulArea: n0(rr?.vacantUseful) },
      fullyRented: { count: Number(rr?.fullyRentedCount ?? 0) },
      privatizationLot: {
        count: Number(rr?.privLotCount ?? 0),
        rentContracts: n0(rr?.privLotContracts),
        rentedObjects: Number(rr?.privLotRentedObjects ?? 0),
      },
      rentLot: {
        count: Number(rr?.rentLotCount ?? 0),
        area: n0(rr?.rentLotArea),
        rentContracts: n0(rr?.rentLotOnlyContracts),
        rentedObjects: Number(rr?.rentLotOnlyRentedObjects ?? 0),
      },
      onAnyAuction: { count: Number(rr?.onAnyAuctionCount ?? 0) },
      installmentSoldRented: { count: Number(rr?.cat1RentedObjects ?? 0) },
      onAuctionProcessRented: { count: Number(rr?.cat7RentedObjects ?? 0) },
    },
  };
}

// gid → kategoriya sanoqlari xaritasi.
function countsByGid(rows: CatRow[]): Map<string, Record<string, number>> {
  const m = new Map<string, Record<string, number>>();
  for (const row of rows) {
    if (row.gid == null) continue;
    const key = row.code == null ? "none" : String(row.code);
    const rec = m.get(row.gid) ?? {};
    rec[key] = (rec[key] ?? 0) + Number(row.count);
    m.set(row.gid, rec);
  }
  return m;
}

// Hudud/tuman darajasidagi umumiy jamlanma (obyekt, ijara, shartnoma, maydon, summa).
// `RegionStat` shakliga to'g'ridan-to'g'ri mos keladi.
// ⚠️ Filtr JOIN shartida — shunda o'sha manbada obyekti yo'q guruh ham jadvalda 0 bilan
// qoladi (WHERE'da bo'lsa guruh butunlay tushib qolardi).
type TotalsRow = {
  id: string;
  name: string;
  sortOrder: number;
  total: bigint;
  inefficient: bigint;
  rented: bigint;
  contracts: bigint;
  area: string | null;
  sum: string | null;
};

function groupTotalsRows(opts: {
  table: Prisma.Sql;      // Prisma.sql`"Region"` yoki `"District"`
  joinOn: Prisma.Sql;     // p."regionId" = g.id  /  p."districtId" = g.id
  sortExpr: Prisma.Sql;   // g."sortOrder" yoki 0
  groupExtra: Prisma.Sql; // , g."sortOrder" yoki bo'sh
  order: Prisma.Sql;
  where: Prisma.Sql;
  srcCond: Prisma.Sql;
}) {
  const { table, joinOn, sortExpr, groupExtra, order, where, srcCond } = opts;
  return prisma.$queryRaw<TotalsRow[]>(Prisma.sql`
    SELECT g.id, g.name, ${sortExpr} AS "sortOrder",
           COUNT(p.id)                                          AS total,
           COUNT(p.id) FILTER (WHERE p."isInefficient")         AS inefficient,
           COUNT(p.id) FILTER (WHERE p."rentContractCount" > 0) AS rented,
           COALESCE(SUM(p."rentContractCount"), 0)              AS contracts,
           COALESCE(SUM(p."rentTotalArea"), 0)                  AS area,
           COALESCE(SUM(p."rentTotalSum"), 0)                   AS sum
    FROM ${table} g
    LEFT JOIN "Property" p ON ${joinOn} AND ${srcCond}
    WHERE ${where}
    GROUP BY g.id, g.name${groupExtra}
    ORDER BY ${order}
  `);
}

function toRegionStat(r: TotalsRow): RegionStat {
  const t = Number(r.total);
  const rented = Number(r.rented);
  return {
    regionId: r.id,
    name: r.name,
    sortOrder: Number(r.sortOrder),
    total: t,
    inefficient: Number(r.inefficient),
    rentedObjects: rented,
    rentedPct: t > 0 ? Math.round((rented / t) * 1000) / 10 : 0,
    contractCount: Number(r.contracts),
    rentArea: Number(r.area ?? 0),
    rentSum: Number(r.sum ?? 0),
  };
}

/**
 * Bitta hududning TUMANLARI bo'yicha ijara jamlanmasi — "Hududlar kesimi — ijara
 * shartnomalari" jadvalida hudud qatori ochilganda. Hudud qatori bilan bir xil
 * `RegionStat` shakli, shuning uchun ustunlar ham bir xil.
 */
export async function computeDistrictRentStats(
  regionId: string,
  scope: StatsScope = {},
): Promise<RegionStat[]> {
  const baseCond = sourceCond(scope, Prisma.sql`p."sourceId"`);
  // Respublika darajasidagi tashkilotlar bu yerda ham chiqarib tashlanadi —
  // districtRows() bilan bir xil printsip (computeDashboardStats izohiga qarang).
  const natIds = (await nationalOrgRows(scope)).map((o) => o.id);
  const srcCond = natIds.length
    ? Prisma.sql`${baseCond} AND p."sourceId" NOT IN (${Prisma.join(natIds)})`
    : baseCond;
  const rows = await groupTotalsRows({
    table: Prisma.sql`"District"`,
    joinOn: Prisma.sql`p."districtId" = g.id`,
    sortExpr: Prisma.sql`0`,
    groupExtra: Prisma.empty,
    order: Prisma.sql`g.name`,
    where: Prisma.sql`g."regionId" = ${regionId}`,
    srcCond,
  });
  return rows.map(toRegionStat);
}

/**
 * TUMANLAR kesimi. `regionId` berilsa — faqat o'sha hudud (dashboard'da qator ochilganda),
 * berilmasa — barcha tumanlar (Excel eksporti uchun, bitta juft so'rovda).
 * Ustunlar hudud qatoridagi bilan bir xil (`buildDashboardColumns()`), chunki qaytariladigan
 * tuzilma ham bir xil (`RegionCategoryRow`). Obyekti yo'q tumanlar ham ro'yxatda qoladi (0 bilan).
 */
async function districtRows(regionId: string | undefined, scope: StatsScope) {
  // Respublika darajasidagi tashkilotlar (agar bor bo'lsa) hudud/tuman kesimidan
  // butunlay chiqarilgan (computeDashboardStats bilan bir xil printsip) — ularning
  // sonlari dashboard'da alohida "Markaziy apparat"/"Respublika" qatorida ko'rinadi.
  const natIds = (await nationalOrgRows(scope)).map((o) => o.id);
  const baseCond = sourceCond(scope, Prisma.sql`p."sourceId"`);
  const condExNat = natIds.length
    ? Prisma.sql`${baseCond} AND p."sourceId" NOT IN (${Prisma.join(natIds)})`
    : baseCond;
  const srcPart = Prisma.sql`AND ${condExNat}`;
  const regionPart = regionId ? Prisma.sql`AND p."regionId" = ${regionId}` : Prisma.empty;
  const cond = Prisma.sql`p."districtId" IS NOT NULL ${regionPart} ${srcPart}`;
  const groupCol = Prisma.sql`p."districtId"`;

  const [districts, catRows, rentRows] = await Promise.all([
    prisma.district.findMany({
      where: regionId ? { regionId } : {},
      orderBy: [{ region: { sortOrder: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, regionId: true, region: { select: { name: true } } },
    }),
    categoryCountRows(groupCol, cond),
    rentBreakdownRows(groupCol, cond),
  ]);

  const counts = countsByGid(catRows);
  const rentMap = new Map(rentRows.filter((r) => r.gid != null).map((r) => [r.gid as string, r]));

  return districts.map((d) => ({
    regionId: d.regionId,
    regionName: d.region.name,
    row: buildRow(d.id, d.name, counts.get(d.id) ?? {}, rentMap.get(d.id)),
  }));
}

/** Bitta hududning tumanlari — dashboard jadvalida hudud qatori ochilganda. */
export async function computeDistrictStats(
  regionId: string,
  scope: StatsScope = {},
): Promise<RegionCategoryRow[]> {
  return (await districtRows(regionId, scope)).map((d) => d.row);
}

/**
 * Barcha tumanlar, hudud bo'yicha guruhlangan — Excel eksporti uchun.
 * Hududlar `Region.sortOrder`, tumanlar nom bo'yicha tartiblanadi.
 */
export async function computeDistrictStatsByRegion(
  scope: StatsScope = {},
): Promise<{ regionId: string; regionName: string; districts: RegionCategoryRow[] }[]> {
  const rows = await districtRows(undefined, scope);
  const grouped: { regionId: string; regionName: string; districts: RegionCategoryRow[] }[] = [];
  for (const d of rows) {
    let g = grouped.find((x) => x.regionId === d.regionId);
    if (!g) {
      g = { regionId: d.regionId, regionName: d.regionName, districts: [] };
      grouped.push(g);
    }
    g.districts.push(d.row);
  }
  // ⚠️ Butunlay bo'sh hudud guruhlari tashlanadi. `districtRows()` BARCHA tumanlarni
  // qaytaradi (jadvalda 0 li qatorlar ham ko'rinishi kerak), lekin bir tashkilotga
  // cheklangan foydalanuvchi uchun bu 14 hudud × 205 tuman nol qator degani edi.
  // Cheklovsiz foydalanuvchida har bir hududda obyekt bor — natija o'zgarmaydi.
  return grouped.filter((g) => g.districts.some((d) => d.total > 0));
}

// Eksport qilingan — keshdan tashqari chaqirish (skript/sinov) uchun ham kerak.
export async function computeDashboardStats(scope: StatsScope = {}): Promise<DashboardStats> {
  // Prisma tomon (count) uchun filtr.
  const srcWhere = sourceWhere(scope);

  // Raw SQL uchun filtr — PARAMETRLANGAN (Prisma.sql), satr sifatida yopishtirilmaydi.
  const srcCond = sourceCond(scope, Prisma.sql`p."sourceId"`);
  // Alias'siz variant (CTE va oddiy FROM "Property" uchun).
  const srcCondNoAlias = sourceCond(scope, Prisma.sql`"sourceId"`);

  // Respublika darajasidagi tashkilotlar (masalan "Davlat aktivlari agentligi"ning
  // markaziy tashkiloti) — ularning obyektlari HECH QANDAY hudud qatoriga
  // qo'shilmaydi, o'z alohida qatorida ko'rsatiladi (pastda).
  const natOrgs = await nationalOrgRows(scope);
  const natIds = natOrgs.map((o) => o.id);
  const regionSrcCond = natIds.length
    ? Prisma.sql`${srcCond} AND p."sourceId" NOT IN (${Prisma.join(natIds)})`
    : srcCond;

  const [total, synced, pending, failed, regionRows, byCategoryRaw] = await Promise.all([
    prisma.property.count({ where: srcWhere }),
    prisma.property.count({ where: { syncStatus: "SYNCED", ...srcWhere } }),
    prisma.property.count({ where: { syncStatus: "PENDING", ...srcWhere } }),
    prisma.property.count({ where: { syncStatus: "FAILED", ...srcWhere } }),
    // Hudud kesimi — umumiy yordamchi orqali (tuman kesimi ham shuni ishlatadi).
    groupTotalsRows({
      table: Prisma.sql`"Region"`,
      joinOn: Prisma.sql`p."regionId" = g.id`,
      sortExpr: Prisma.sql`g."sortOrder"`,
      groupExtra: Prisma.sql`, g."sortOrder"`,
      order: Prisma.sql`g."sortOrder", g.name`,
      where: Prisma.sql`TRUE`,
      srcCond: regionSrcCond,
    }),
    prisma.$queryRaw<{ code: number | null; count: number }[]>(Prisma.sql`
      SELECT COALESCE("integrationCategoryCode", "manualCategoryCode", 11) AS code,
             COUNT(*)::int AS count
      FROM "Property"
      WHERE ${srcCondNoAlias}
      GROUP BY 1
      ORDER BY 1
    `),
  ]);

  // ⚠️ "Bo'sh turgan" (samarasiz) soni `Property.isInefficient` ustunidan ALOHIDA
  // so'rov bilan EMAS, shu yerdagi `byCategoryRaw`dan (code=11) olinadi. Ilgari
  // alohida `prisma.property.count({isInefficient:true})` so'rovi bo'lgan — u
  // `byCategoryRaw` bilan bir xil `Promise.all` ichida, lekin alohida ulanishda
  // bajarilgani uchun fon worker'i aynan shu ikki so'rov orasida bitta obyektni
  // yangilab qo'ysa, tepadagi karta va pastdagi jadval bir necha obyektga farq
  // qilib qolardi (poyga holati — worker faol sinxronlanayotganda ko'rinadi,
  // isInefficient ustuni o'zi buzilmagan bo'lsa ham). Effektiv kategoriya=11
  // bo'lish sharti `computeIsInefficient()` bilan matematik teng (manualCategoryCode
  // faqat 9/10/null bo'ladi, integrationCategoryCode 1–7/null — demak effektiv
  // faqat ikkalasi ham null bo'lganda 11ga tushadi), shuning uchun bitta manbadan
  // olish xavfsiz va HAR DOIM jadval bilan mos keladi.
  const inefficient = byCategoryRaw.find((c) => c.code === 11)?.count ?? 0;

  // Hudud × kategoriya (effektiv kategoriya bo'yicha) — respublika darajasidagilarsiz.
  const regionCategoryRaw = await categoryCountRows(Prisma.sql`p."regionId"`, regionSrcCond);

  // Ijara xususiyati bo'yicha kesim — kategoriyaga BOG'LIQ EMAS.
  // "Bo'sh maydon" = foydali maydon (buildingArea) − ijaraga berilgan (rentTotalArea).
  // Ijara xususiyati bo'yicha kesim — hudud bo'yicha (tuman kesimi ham shu funksiyani ishlatadi).
  const rentRaw = await rentBreakdownRows(Prisma.sql`p."regionId"`, regionSrcCond);

  // Respublika darajasidagi tashkilotlar — bir XIL mantiq, lekin guruh ustuni
  // `p."sourceId"` (`OrganizationSource.id`), hudud emas.
  let nationalRegionStats: RegionStat[] = [];
  let nationalCategoryRows: RegionCategoryRow[] = [];
  if (natIds.length > 0) {
    const natCond = Prisma.sql`${srcCond} AND p."sourceId" IN (${Prisma.join(natIds)})`;
    const [natTotalsRaw, natCatRaw, natRentRaw] = await Promise.all([
      groupTotalsRows({
        table: Prisma.sql`"OrganizationSource"`,
        joinOn: Prisma.sql`p."sourceId" = g.id`,
        sortExpr: Prisma.sql`0`,
        groupExtra: Prisma.empty,
        order: Prisma.sql`g.name`,
        where: Prisma.sql`g.id IN (${Prisma.join(natIds)})`,
        srcCond: srcCond,
      }),
      categoryCountRows(Prisma.sql`p."sourceId"`, natCond),
      rentBreakdownRows(Prisma.sql`p."sourceId"`, natCond),
    ]);
    const natCounts = countsByGid(natCatRaw);
    const natRentByGid = new Map(natRentRaw.filter((r) => r.gid != null).map((r) => [r.gid as string, r]));
    const labelById = new Map(natOrgs.map((o) => [o.id, sourceScopeLabel(o.name, null)]));

    nationalRegionStats = natTotalsRaw.map((r) => ({
      ...toRegionStat(r),
      name: labelById.get(r.id) ?? r.name,
    }));
    nationalCategoryRows = natTotalsRaw.map((r) =>
      buildRow(r.id, labelById.get(r.id) ?? r.name, natCounts.get(r.id) ?? {}, natRentByGid.get(r.id)),
    );
  }

  const byRegion: RegionStat[] = [...regionRows.map(toRegionStat), ...nationalRegionStats];

  // Hudud × kategoriya jadvalini yig'amiz (hududlar tartibi saqlanadi, so'ng
  // respublika darajasidagi qatorlar OXIRIGA qo'shiladi).
  // Qator tuzilishi tuman kesimi bilan BIR XIL — `buildRow` ikkalasiga xizmat qiladi.
  const countsByRegion = countsByGid(regionCategoryRaw);
  const rentByRegion = new Map(rentRaw.filter((r) => r.gid != null).map((r) => [r.gid as string, r]));

  const byRegionCategory: RegionCategoryRow[] = [
    ...regionRows.map((r) =>
      buildRow(r.id, r.name, countsByRegion.get(r.id) ?? {}, rentByRegion.get(r.id)),
    ),
    ...nationalCategoryRows,
  ];

  // JAMI — hududlar + respublika darajasidagi qatorlar yig'indisi (foiz alohida
  // hisoblanadi, o'rtacha emas). Umumiy son o'zgarmaydi — faqat qayerda hisoblanishi
  // (hudud qatorimi, "Markaziy apparat" qatorimi) aniqroq bo'ladi.
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
    nationalOrgIds: natIds,
  };
}

// Keshlash: "dashboard" tegi + 60s TTL (worker alohida process — revalidateTag chaqira olmaydi).
// `scope` argumenti kesh kalitiga avtomatik kiradi — ya'ni har bir soha VA har bir
// rol doirasi (sourceIds) o'z keshiga ega bo'ladi. ⚠️ Shuning uchun doirani argument
// sifatida uzatish shart: keshdan boshqa foydalanuvchining natijasi qaytmasligi kerak.
export const getDashboardStats = unstable_cache(computeDashboardStats, ["dashboard-stats-v9"], {
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
