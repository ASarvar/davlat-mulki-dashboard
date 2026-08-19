import { Prisma, type SyncStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CAT_FREE_USE,
  CAT_HAS_RENT,
  CAT_HAS_VACANT_AREA,
  CAT_ON_AUCTION,
  CAT_ON_AUCTION_RENT,
  CAT_VACANT,
} from "./classification";
import { userSourceScope, isAdmin, type SessionUser } from "@/lib/authz";
import { CAT_REMOVED_FROM_BALANCE } from "@/lib/categories";
import {
  parseUtilityRaw,
  formatLastPayment as payDate,
  type UtilityInfo,
  type UtilityKind,
} from "@/server/integrations/utilities";
import { recentPaymentCutoff } from "./stats";

export interface PropertyFilters {
  q?: string; // kadastr (yangi/eski) bo'yicha qidiruv
  regionId?: string;
  /** Tuman (District.id) — hudud ichida torroq kesim. */
  districtId?: string;
  categoryCode?: number; // effektiv kategoriya (1–10)
  inefficient?: boolean;
  syncStatus?: SyncStatus;
  /** Soha = manba nomi ("Ijara markazi", "Sog'liqni saqlash", ...) */
  soha?: string;
  /** Aniq TASHKILOT (OrganizationSource.id) — soha ichidagi torroq kesim (masalan bitta hudud yoki "Markaziy apparat"). */
  sourceId?: string;
  /** Ijara shartnomasi bor VA foydali maydon to'liq band (vacantArea = 0). Kategoriyaga bog'liq emas. */
  fullyRented?: boolean;
  /** Ijara shartnomasi bor — tekin foydalanish yoki pullik, ikkisidan biri. Kategoriyaga bog'liq emas. */
  hasRentContract?: boolean;
  /** Xususiylashtirish YOKI ijara savdosida (kat 3 va 4 birlashmasi, takror sanalmaydi). */
  onAnyAuction?: boolean;
  /** Yer uchastkasimi (true) yoki bino (false) — Davlat aktivlari/Direksiya jadvalidagi Yer/Bino ustunlaridan. */
  isLand?: boolean;
  /** MODERATOR uchun: faqat o'ziga biriktirilgan hudud(lar) bo'yicha saralash (ko'rish cheklovi emas). */
  myRegionsOnly?: boolean;
  /** Kommunal xizmat kesimi — dashboard'dagi kommunal jadval ustunlaridan drill-down. */
  utility?: UtilityFilter;
}

/**
 * Kommunal jadval ustunlariga MOS keladigan filtr qiymatlari. Har biri
 * `stats.ts` → `utilityRows()` dagi AYNAN o'sha shart bilan juftlashtirilgan —
 * jadvaldagi raqamni bosganda ro'yxatda shuncha obyekt chiqishi uchun.
 *
 * ⚠️ `none` ("Hech biri") va `unchecked` ("Tekshirilmagan") — IKKI BOSHQA narsa:
 * birinchisi tekshirilgan va abonent topilmagan, ikkinchisi umuman tekshirilmagan.
 * Ularni birlashtirish "foydalanmayapti" degan xato xulosani keltirib chiqarardi.
 */
export const UTILITY_FILTERS = [
  "water",
  "gas",
  "gasBilled",
  "gasConsuming",
  "electric",
  "electricConsuming",
  "electricMatch",
  "any",
  "recentlyPaid",
  "none",
  "unchecked",
] as const;
export type UtilityFilter = (typeof UTILITY_FILTERS)[number];

export const UTILITY_FILTER_LABEL: Record<UtilityFilter, string> = {
  water: "Suv abonenti bor",
  gas: "Gaz abonenti bor",
  gasBilled: "Gaz hisobi faol (to'lov hisoblanmoqda)",
  gasConsuming: "Gaz hisoblagichi bo'yicha sarf bor",
  electric: "Elektr abonenti bor",
  electricConsuming: "Elektr sarfi bor",
  // ⚠️ Elektr API'si kadastrni taxminan moslashtiradi — bu filtr aynan MOS kelganlarni
  // beradi, ya'ni "abonent bor" ro'yxatining ishonchli qismini (utilities.ts, TUZOQ 6).
  electricMatch: "Elektr abonenti kadastri mos",
  any: "Kamida bitta kommunal xizmat",
  recentlyPaid: "Gaz yoki elektr uchun yaqinda to'lov bo'lgan",
  none: "Hech qaysi kommunal xizmat yo'q",
  unchecked: "Kommunal tekshirilmagan",
};

const PAGE_SIZE = 20;
export const PROPERTY_PAGE_SIZE = PAGE_SIZE;

// Rol/hudud + filtrlar asosida WHERE quramiz.
// EKSPORT ham shu funksiyani ishlatadi — hudud doirasi bir joyda, takrorlanmaydi.
export async function buildWhere(user: SessionUser, f: PropertyFilters): Promise<Prisma.PropertyWhereInput> {
  const and: Prisma.PropertyWhereInput[] = [];

  // ── Balansdan chiqarilganlar ──
  // Standart holatda ular ro'yxatda UMUMAN ko'rinmaydi (dashboard hisoblariga ham
  // kirmaydi — `stats.ts` → sourceCond/sourceWhere). Faqat ADMIN "Balansdan chiqarilgan"
  // kategoriyasini ataylab tanlaganda chiqadi (foydalanuvchi talabi, 2026-08-06).
  // ⚠️ Admin bo'lmagan foydalanuvchi bu kodni qo'lda URLga yozsa ham natija BO'SH
  // bo'ladi (filtr e'tiborsiz qoldirilmaydi) — aks holda u oddiy ro'yxatni ko'rib,
  // filtr ishlagan deb o'ylardi.
  const wantsRemoved = f.categoryCode === CAT_REMOVED_FROM_BALANCE;
  if (wantsRemoved) {
    if (!isAdmin(user.role)) return { id: "__forbidden__" };
    and.push({ removedFromBalance: true });
  } else {
    and.push({ removedFromBalance: false });
  }

  // TASHKILOT doirasi: IJROCHI faqat o'z tashkilotining obyektlarini ko'radi
  // (biriktirilmagan bo'lsa — hech narsa). Boshqa rollar (admin/moderator/kuzatuvchi)
  // hamma obyektni ko'radi, lekin filtr param'ni hurmat qiladi. MODERATOR qo'shimcha
  // ravishda "faqat mening tashkilotlarim" bilan saralashi mumkin (myRegionsOnly) —
  // bu ko'rish cheklovi emas, ixtiyoriy filtr.
  // ⚠️ Hudud endi FAQAT foydalanuvchi tanlaydigan filtr — doira emas.
  if (user.role === "IJROCHI") {
    and.push(user.sourceId ? { sourceId: user.sourceId } : { id: "__no_source__" });
    if (f.regionId) and.push({ regionId: f.regionId });
  } else {
    if (f.regionId) and.push({ regionId: f.regionId });
    if (f.myRegionsOnly && user.role === "MODERATOR") {
      const scope = await userSourceScope(user);
      if (scope !== null) and.push({ sourceId: { in: scope } });
    }
  }

  // Tuman — hudud ichidagi torroq kesim. Rol doirasi bilan AND birikadi, ya'ni
  // IJROCHI boshqa hududning tumanini so'rasa ham natija bo'sh chiqadi (kengaytirmaydi).
  if (f.districtId) and.push({ districtId: f.districtId });

  // Kadastr qidiruvi (pg_trgm GIN indeks orqali ILIKE %q%).
  if (f.q?.trim()) {
    const q = f.q.trim();
    and.push({
      OR: [
        { cadNumber: { contains: q, mode: "insensitive" } },
        { cadNumberOld: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  // Kategoriya filtri.
  // 5 (Tekin foydalanish), 6 (Ijara shartnomasi bor) va 12 (Bo'sh maydoni bor) —
  // dashboard'da XUSUSIYAT bo'yicha hisoblanadi (obyekt sotilgan bo'lsa ham ijarasi bo'lishi
  // mumkin), shuning uchun filtr ham shu mantiqni takrorlashi shart. Aks holda jadvaldagi
  // raqamni bosganda ro'yxat bo'sh chiqadi.
  // ⚠️ `wantsRemoved` bu yerga TUSHMASLIGI kerak: 13 haqiqiy kategoriya kodi emas,
  // pastdagi `else` shoxi uni `integrationCategoryCode = 13` deb qidirib, natijani
  // doim bo'sh qaytarardi (holbuki shart yuqorida allaqachon qo'yilgan).
  if (f.categoryCode && !wantsRemoved) {
    const c = f.categoryCode;
    if (c === CAT_ON_AUCTION) {
      // Xususiylashtirish savdosida — obyekt bir vaqtda ijara savdosida ham bo'lishi mumkin.
      and.push({ hasPrivatizationLot: true });
    } else if (c === CAT_ON_AUCTION_RENT) {
      and.push({ hasRentLot: true });
    } else if (c === CAT_FREE_USE) {
      and.push({ rentContractCount: { gt: 0 }, rentTotalSum: 0 });
    } else if (c === CAT_HAS_RENT) {
      and.push({ rentContractCount: { gt: 0 }, rentTotalSum: { gt: 0 } });
    } else if (c === CAT_HAS_VACANT_AREA) {
      // Bo'sh maydoni bor = ijarasi bor, lekin foydali maydon to'liq band emas.
      and.push({ rentContractCount: { gt: 0 } });
      and.push({ vacantArea: { gt: 0 } });
    } else if (c === CAT_VACANT) {
      // "Bo'sh turgan" DB ustunlarida hech qachon literal 11 sifatida saqlanmaydi —
      // bu ikkala kategoriya ustuni ham null bo'lgan (hali hech narsaga biriktirilmagan) holat.
      and.push({ integrationCategoryCode: null, manualCategoryCode: null });
    } else {
      and.push({
        OR: [
          { integrationCategoryCode: c },
          { integrationCategoryCode: null, manualCategoryCode: c },
        ],
      });
    }
  }

  // Soha bo'yicha: obyekt qaysi tashkilot manbasiga tegishli.
  if (f.soha) and.push({ source: { name: f.soha } });
  // Aniq tashkilot (soha ichidagi bitta hudud yoki "Markaziy apparat") — soha filtri bilan AND birikadi.
  if (f.sourceId) and.push({ sourceId: f.sourceId });

  // To'liq ijaraga berilgan — dashboard'dagi mos ustun bilan bir xil mantiq (stats.ts → rentRaw).
  if (f.fullyRented) and.push({ rentContractCount: { gt: 0 }, vacantArea: 0 });
  // "Ijaraga berilgan obyektlar" ustuni — faqat EFFEKTIV kategoriyasi 5 yoki 6 bo'lganlar
  // (boshqa kategoriyadagi, masalan savdodagi, ijara shartnomali obyektlar bu yerga kirmaydi).
  if (f.hasRentContract) {
    and.push({
      OR: [
        { integrationCategoryCode: CAT_FREE_USE },
        { integrationCategoryCode: null, manualCategoryCode: CAT_FREE_USE },
        { integrationCategoryCode: CAT_HAS_RENT },
        { integrationCategoryCode: null, manualCategoryCode: CAT_HAS_RENT },
      ],
    });
  }
  // "Auksion savdolarida (Xususiy. va Ijara)" ustuni — xususiylashtirish YOKI ijara savdosida.
  if (f.onAnyAuction) and.push({ OR: [{ hasPrivatizationLot: true }, { hasRentLot: true }] });

  // ── Kommunal xizmatlar ──
  // ⚠️ Shartlar `stats.ts` → `utilityRows()` dagi FILTER (...) ifodalari bilan
  // bir xil bo'lishi SHART, aks holda jadvaldagi raqamni bosganda ro'yxatdagi
  // son boshqacha chiqadi (CLAUDE.md dagi buildWhere qoidasi).
  if (f.utility) {
    const anyUtility: Prisma.PropertyWhereInput[] = [
      { hasWater: true },
      { hasGas: true },
      { hasElectric: true },
    ];
    switch (f.utility) {
      case "water":
        and.push({ hasWater: true });
        break;
      case "gas":
        and.push({ hasGas: true });
        break;
      case "gasBilled":
        and.push({ gasBilled: true });
        break;
      case "gasConsuming":
        and.push({ gasConsuming: true });
        break;
      case "electric":
        and.push({ hasElectric: true });
        break;
      case "electricConsuming":
        and.push({ electricConsuming: true });
        break;
      case "electricMatch":
        and.push({ electricCadastreMatch: true });
        break;
      case "any":
        and.push({ OR: anyUtility });
        break;
      case "recentlyPaid":
        // ⚠️ Chegara `stats.ts` → `recentPaymentCutoff()` dan — jadvaldagi SQL bilan
        // bir xil funksiya, aks holda ustundagi son va ro'yxatdagi son ajralib ketardi.
        // ⚠️ Shart ham SQL bilan bir xil bo'lishi SHART: gaz YOKI elektr.
        and.push({
          OR: [
            { gasLastPaymentAt: { gte: recentPaymentCutoff() } },
            { electricLastPaymentAt: { gte: recentPaymentCutoff() } },
          ],
        });
        break;
      case "none":
        // Tekshirilgan, lekin hech qaysi xizmatda abonent topilmagan.
        and.push({
          utilityCheckedAt: { not: null },
          hasWater: false,
          hasGas: false,
          hasElectric: false,
        });
        break;
      case "unchecked":
        and.push({ utilityCheckedAt: null });
        break;
    }
  }

  if (typeof f.isLand === "boolean") and.push({ isLand: f.isLand });
  if (typeof f.inefficient === "boolean") and.push({ isInefficient: f.inefficient });
  if (f.syncStatus) and.push({ syncStatus: f.syncStatus });

  return and.length ? { AND: and } : {};
}

export interface PropertyListItem {
  id: string;
  cadNumber: string;
  cadNumberOld: string | null;
  regionName: string;
  districtName: string | null;
  address: string | null;
  area: string | null;
  integrationCategoryCode: number | null;
  manualCategoryCode: number | null;
  isInefficient: boolean;
  syncStatus: SyncStatus;
  lotNumber: string | null;
  lotStatus: string | null;
  /** Bo'sh maydon (foydali − ijarada). "Bo'sh maydoni bor" filtri uchun ko'rsatiladi. */
  vacantArea: string | null;
  /** Balansdan chiqarilgan — faqat admin "Balansdan chiqarilgan" filtrida ko'radi. */
  removedFromBalance: boolean;
  removedAt: Date | null;
  removedToStir: string | null;
  removedToName: string | null;
}

export interface PropertyListResult {
  items: PropertyListItem[];
  page: number; // 1 dan boshlanadi
  pageCount: number;
  total: number;
}

/**
 * Ro'yxatdagi bitta kommunal katakcha — client komponentga uzatiladigan TAYYOR ko'rinish.
 *
 * ⚠️ Formatlash SERVER tomonda qilinadi va client'ga faqat oddiy tiplar boradi.
 * Sabab: `integrations/utilities.ts` → `@/lib/env` ni import qiladi (server-only, zod
 * validatsiyasi bilan) — uni client bundle'ga tortib kiritish mumkin emas.
 */
export interface UtilityCell {
  found: boolean;
  /** Katakda ko'rinadigan qisqa matn ("Bor" / "—"). */
  short: string;
  /** Katakdagi ikkinchi qator — eng muhim bitta ko'rsatkich. */
  hint: string | null;
  /** Ochilganda ko'rinadigan "nomi → qiymati" juftliklari. */
  rows: { label: string; value: string }[];
  /** Eski kadastr orqali topilganmi (ro'yxatda belgi sifatida ko'rinadi). */
  matchedByOldCad: boolean;
}

export interface PropertyUtilityCells {
  WATER: UtilityCell;
  GAS: UtilityCell;
  ELECTRIC: UtilityCell;
}

const EMPTY_CELL: UtilityCell = { found: false, short: "—", hint: null, rows: [], matchedByOldCad: false };

const sum = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("uz-UZ")} so'm`);

/** `UtilityInfo` → ro'yxatda ko'rsatiladigan katakcha (xizmat turiga qarab boshqa maydonlar). */
function toCell(kind: UtilityKind, u: UtilityInfo): UtilityCell {
  if (!u.found) return EMPTY_CELL;
  const rows: { label: string; value: string }[] = [];

  if (kind === "WATER") {
    if (u.subscriberName) rows.push({ label: "Abonent", value: u.subscriberName });
    if (u.subscriberCode) rows.push({ label: "Abonent kodi", value: u.subscriberCode });
    rows.push({ label: "Balans", value: sum(u.balance) });
    if (u.balanceStatus) rows.push({ label: "Holati", value: u.balanceStatus });
    return { found: true, short: "Bor", hint: u.balance != null ? sum(u.balance) : null, rows, matchedByOldCad: u.matchedByOldCad };
  }

  if (kind === "GAS") {
    if (u.subscriberName) rows.push({ label: "Abonent", value: u.subscriberName });
    if (u.subscriberCode) rows.push({ label: "Abonent kodi", value: u.subscriberCode });
    if (u.address) rows.push({ label: "Manzil", value: u.address });
    rows.push({ label: "Joriy balans", value: sum(u.balance) });
    rows.push({
      label: "Oxirgi to'lov",
      value: payDate(u) ? `${payDate(u)} — ${sum(u.lastPaymentSum)}` : "—",
    });
    rows.push({
      label: "12 oylik sarf",
      // ⚠️ 0 "sarf yo'q" degani EMAS — hisoblagichi yo'q abonentda gaz norma bo'yicha
      // hisoblanadi, shuning uchun izoh bilan ko'rsatiladi.
      value:
        u.consumedTotal && u.consumedTotal > 0
          ? `${u.consumedTotal.toLocaleString("uz-UZ")} m³`
          : "0 m³ (hisoblagich yo'q yoki sarf qayd etilmagan)",
    });
    rows.push({ label: "Hisob holati", value: u.billed ? "Faol — to'lov hisoblanmoqda" : "Harakat yo'q" });
    return { found: true, short: "Bor", hint: payDate(u) ? `to'lov: ${payDate(u)}` : null, rows, matchedByOldCad: u.matchedByOldCad };
  }

  // ELECTRIC — 2 bosqichli: tafsilot bo'lmasa (eski yozuv yoki 2-bosqich sozlanmagan)
  // faqat kodlar ko'rinadi, avvalgidek.
  if (u.subscribers.length === 0) {
    rows.push({ label: "Abonent kodlari", value: u.codes.join(", ") || "—" });
    rows.push({ label: "Kodlar soni", value: String(u.codes.length) });
    rows.push({ label: "Tafsilot", value: "Olinmagan — kommunal sinxronizatsiyani qayta ishga tushiring" });
    return { found: true, short: "Bor", hint: `${u.codes.length} ta kod`, rows, matchedByOldCad: u.matchedByOldCad };
  }

  if (u.subscriberName) rows.push({ label: "Abonent", value: u.subscriberName });
  if (u.subscriberCode) rows.push({ label: "Abonent kodi", value: u.subscriberCode });
  if (u.codes.length > 1) rows.push({ label: "Abonentlar soni", value: String(u.subscribers.length) });
  if (u.address) rows.push({ label: "Manzil", value: u.address });
  // ⚠️ Eng muhim qator: API kadastrni taxminan moslashtiradi, shuning uchun abonent
  // BOSHQA obyektniki bo'lishi mumkin (utilities.ts, TUZOQ 6).
  rows.push({
    label: "Kadastr mosligi",
    value: u.cadastreMatch
      ? "Mos"
      : `Mos emas${u.subscribers[0]?.cadastreCode ? ` (${u.subscribers[0].cadastreCode})` : ""}`,
  });
  rows.push({ label: "Joriy balans", value: sum(u.balance) });
  rows.push({
    label: "Oxirgi to'lov",
    value: payDate(u) ? `${payDate(u)} — ${sum(u.lastPaymentSum)}` : "—",
  });
  rows.push({
    label: "Sarf",
    // ⚠️ Gazdan farqli — birlik kVt·soat, m³ EMAS.
    value:
      u.consumedTotal && u.consumedTotal > 0
        ? `${u.consumedTotal.toLocaleString("uz-UZ")} kVt·soat`
        : "0 (sarf qayd etilmagan)",
  });
  return {
    found: true,
    short: u.cadastreMatch ? "Bor" : "Bor (kadastr mos emas)",
    hint: payDate(u) ? `to'lov: ${payDate(u)}` : `${u.codes.length} ta kod`,
    rows,
    matchedByOldCad: u.matchedByOldCad,
  };
}

/**
 * Ro'yxatdagi obyektlar uchun kommunal ma'lumot — SAQLANGAN xom javoblardan
 * (`ObjectStatusCheck.rawResponse`), tashqi API'ga chaqirmasdan.
 *
 * ⚠️ Faqat ixcham ("kommunal") ko'rinishda chaqiriladi: `rawResponse` og'ir JSON, uni
 * har bir ro'yxat so'rovida yuklash keraksiz.
 */
export async function listUtilityCells(propertyIds: string[]): Promise<Map<string, PropertyUtilityCells>> {
  const out = new Map<string, PropertyUtilityCells>();
  if (propertyIds.length === 0) return out;

  const checks = await prisma.objectStatusCheck.findMany({
    where: { propertyId: { in: propertyIds }, apiSource: { in: ["WATER", "GAS", "ELECTRIC"] } },
    select: { propertyId: true, apiSource: true, rawResponse: true, matchedByOldCad: true },
  });

  for (const id of propertyIds) {
    out.set(id, { WATER: EMPTY_CELL, GAS: EMPTY_CELL, ELECTRIC: EMPTY_CELL });
  }
  for (const c of checks) {
    const kind = c.apiSource as UtilityKind;
    const info = parseUtilityRaw(kind, c.rawResponse);
    const cell = toCell(kind, { ...info, matchedByOldCad: c.matchedByOldCad });
    const entry = out.get(c.propertyId);
    if (entry) entry[kind] = cell;
  }
  return out;
}

// Sahifa raqamli (offset) pagination — foydalanuvchi sahifalar bo'ylab yura olishi uchun.
// 80k qatorda ham filtr ustunlari indekslangani uchun COUNT va OFFSET maqbul;
// juda chuqur sahifalarda OFFSET sekinlashadi, lekin amalda filtrlab ishlanadi.
export async function listProperties(
  user: SessionUser,
  filters: PropertyFilters,
  requestedPage = 1,
): Promise<PropertyListResult> {
  const where = await buildWhere(user, filters);

  const total = await prisma.property.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), pageCount);

  const rows = await prisma.property.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
    select: {
      id: true,
      cadNumber: true,
      cadNumberOld: true,
      address: true,
      area: true,
      integrationCategoryCode: true,
      manualCategoryCode: true,
      isInefficient: true,
      syncStatus: true,
      lotNumber: true,
      lotStatus: true,
      vacantArea: true,
      removedFromBalance: true,
      removedAt: true,
      removedToStir: true,
      removedToName: true,
      region: { select: { name: true } },
      district: { select: { name: true } },
    },
  });

  return {
    page,
    pageCount,
    total,
    items: rows.map((r) => ({
      id: r.id,
      cadNumber: r.cadNumber,
      cadNumberOld: r.cadNumberOld,
      regionName: r.region.name,
      districtName: r.district?.name ?? null,
      address: r.address,
      area: r.area ? r.area.toString() : null,
      integrationCategoryCode: r.integrationCategoryCode,
      manualCategoryCode: r.manualCategoryCode,
      isInefficient: r.isInefficient,
      syncStatus: r.syncStatus,
      lotNumber: r.lotNumber,
      lotStatus: r.lotStatus,
      vacantArea: r.vacantArea ? r.vacantArea.toString() : null,
      removedFromBalance: r.removedFromBalance,
      removedAt: r.removedAt,
      removedToStir: r.removedToStir,
      removedToName: r.removedToName,
    })),
  };
}

export interface PropertyExportRow {
  cadNumber: string;
  cadNumberOld: string | null;
  regionName: string;
  districtName: string | null;
  sourceName: string;
  name: string | null;
  address: string | null;
  area: number | null;
  buildingArea: number | null;
  integrationCategoryCode: number | null;
  manualCategoryCode: number | null;
  isInefficient: boolean;
  syncStatus: string;
  lastSyncedAt: Date | null;
  lotNumber: string | null;
  lotStatus: string | null;
  paymentTermMonths: number | null;
  auctionGroupName: string | null;
  rentContractCount: number | null;
  rentTotalSum: number | null;
  rentTotalArea: number | null;
  rentMatchedByOldCad: boolean;
  removedFromBalance: boolean;
  removedAt: Date | null;
  removedToStir: string | null;
  removedToName: string | null;
}

// Eksport uchun keyset bo'yicha bo'lak-bo'lak o'qish — 80k qatorni
// bitta so'rovda xotiraga yuklamaslik uchun.
export async function* iteratePropertiesForExport(
  user: SessionUser,
  filters: PropertyFilters,
  batchSize = 1000,
): AsyncGenerator<PropertyExportRow[]> {
  const where = await buildWhere(user, filters);
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.property.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        cadNumber: true,
        cadNumberOld: true,
        name: true,
        address: true,
        area: true,
        buildingArea: true,
        integrationCategoryCode: true,
        manualCategoryCode: true,
        isInefficient: true,
        syncStatus: true,
        lastSyncedAt: true,
        lotNumber: true,
        lotStatus: true,
        paymentTermMonths: true,
        auctionGroupName: true,
        rentContractCount: true,
        rentTotalSum: true,
        rentTotalArea: true,
        rentMatchedByOldCad: true,
        removedFromBalance: true,
        removedAt: true,
        removedToStir: true,
        removedToName: true,
        region: { select: { name: true } },
        district: { select: { name: true } },
        source: { select: { name: true } },
      },
    });
    if (rows.length === 0) return;

    yield rows.map((r) => ({
      cadNumber: r.cadNumber,
      cadNumberOld: r.cadNumberOld,
      regionName: r.region.name,
      districtName: r.district?.name ?? null,
      sourceName: r.source.name,
      name: r.name,
      address: r.address,
      area: r.area ? Number(r.area) : null,
      buildingArea: r.buildingArea ? Number(r.buildingArea) : null,
      integrationCategoryCode: r.integrationCategoryCode,
      manualCategoryCode: r.manualCategoryCode,
      isInefficient: r.isInefficient,
      syncStatus: r.syncStatus,
      lastSyncedAt: r.lastSyncedAt,
      lotNumber: r.lotNumber,
      lotStatus: r.lotStatus,
      paymentTermMonths: r.paymentTermMonths,
      auctionGroupName: r.auctionGroupName,
      rentContractCount: r.rentContractCount,
      rentTotalSum: r.rentTotalSum ? Number(r.rentTotalSum) : null,
      rentTotalArea: r.rentTotalArea ? Number(r.rentTotalArea) : null,
      rentMatchedByOldCad: r.rentMatchedByOldCad,
      removedFromBalance: r.removedFromBalance,
      removedAt: r.removedAt,
      removedToStir: r.removedToStir,
      removedToName: r.removedToName,
    }));

    if (rows.length < batchSize) return;
    cursor = rows[rows.length - 1].id;
  }
}

// Obyekt tafsiloti (rol/hudud tekshiruvi bilan). Ruxsat yo'q bo'lsa null.
export async function getPropertyDetail(user: SessionUser, cadNumber: string) {
  const property = await prisma.property.findUnique({
    where: { cadNumber },
    include: {
      region: true,
      district: true,
      source: true,
      integrationCategory: true,
      manualCategory: true,
      statusChecks: { orderBy: { apiSource: "asc" } },
      rentContracts: { orderBy: [{ contractDate: "desc" }, { contractNumber: "asc" }] },
      auctionLots: { orderBy: [{ type: "asc" }, { auctionDate: "desc" }] },
      documents: { orderBy: { createdAt: "desc" } },
      assignments: {
        orderBy: { createdAt: "desc" },
        include: { category: true, document: true, assignedBy: { select: { fullName: true } } },
      },
      changeRequests: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          requestedBy: { select: { fullName: true } },
          moderator: { select: { fullName: true } },
          rahbar: { select: { fullName: true } },
          document: { select: { id: true, fileName: true } },
        },
      },
    },
  });
  if (!property) return null;
  // Obyekt sahifasi: ijrochi faqat o'z tashkilotining obyektini ocha oladi.
  if (user.role === "IJROCHI" && property.sourceId !== user.sourceId) return null;
  // Balansdan chiqarilgan obyekt — faqat admin uchun. ⚠️ Ro'yxatda ko'rinmasligi
  // yetarli emas: havolani bilgan/saqlab qo'ygan foydalanuvchi sahifani to'g'ridan-to'g'ri
  // ocha olardi (`buildWhere` faqat ro'yxatga ta'sir qiladi).
  if (property.removedFromBalance && !isAdmin(user.role)) return null;
  return property;
}
