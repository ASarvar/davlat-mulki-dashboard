import { env } from "@/lib/env";
import { httpJson, NotFoundError } from "./http";

// ─────────────────────────────────────────────────────────────────────────────
// KOMMUNAL XIZMATLAR — suv (Suvsoz), gaz (Hududgaz), elektr (HET).
// Uchalasi ham: GET {BASE_URL}?cad_number={KADASTR}, Basic auth (API 3/4 kabi).
//
// ⚠️ TUZOQ 1 — "topilmadi" HTTP 404 EMAS. Uchalasi ham HTTP 200 qaytaradi va
// "abonent yo'q"ni body ichida bildiradi (API 2 ning `code: 90000` tuzog'i kabi).
// Shuning uchun `NotFoundError` yo'liga TAYANIB BO'LMAYDI — har bir vendor uchun
// alohida `found` prediktati yozilgan.
//
// ⚠️ TUZOQ 2 — uchala javob tuzilmasi butunlay boshqacha (uch xil vendor):
//   suv    topildi:   { pid, fio, saldo, ltf, saldo_sst, description }
//          topilmadi: { debug: null, err_code: -425, err_msg: "Item not found", dump: null }
//   gaz    topildi:   { abonent: { customer_code, name, current_balance, interraction: [12 oy] } }
//          topilmadi: { abonent: null, result_code: 73, result_message: "Абонент не найден" }
//   elektr topildi:   { transactionId, abonent: { soato: [], customerType: [], customerCode: [...] } }
//          topilmadi: AYNAN o'sha tuzilma, massivlar BO'SH
//
// ⚠️ TUZOQ 3 — faqat GAZ sarf/to'lov haqida ma'lumot beradi (`interraction[]`, 12 oylik
// tarix). Suv faqat balansni, elektr esa faqat abonent KODINI beradi (nom ham yo'q).
// Ya'ni "abonent bor" va "sarflayapti" bir xil narsa emas.
//
// ⚠️ TUZOQ 4 — qamrov JUDA PAST. To'liq sinxronizatsiya (2423 obyekt, 14 hudud):
// elektr 73 (3.0%), gaz 21 (0.9%), suv 15 (0.6%), kamida bittasi 101 (4.2%).
// Qamrov hududlar bo'ylab tarqalgan va Toshkent shahri eng PAST ko'rsatkichga ega
// (204 obyektdan 1 ta) — dastlabki kichik namuna bergan "hammasi Toshkentda" degan
// xulosa noto'g'ri bo'lib chiqdi.
//
// ⚠️ Shu sababli "topilmadi" ni "foydalanmayapti" deb TALQIN QILMANG — API "abonent yo'q"
// va "qamrovga kirmagan" holatini farqlay olmaydi. `utilityCheckedAt` orqali
// "tekshirilmagan" holati alohida saqlanadi va dashboardda alohida ustunda ko'rsatiladi.
// ─────────────────────────────────────────────────────────────────────────────

export type UtilityKind = "WATER" | "GAS" | "ELECTRIC";

export interface UtilityInfo {
  found: boolean;
  /** Abonent nomi — suv: `fio`, gaz: `abonent.name`. Elektrda YO'Q (API bermaydi). */
  subscriberName: string | null;
  /** Abonent kodi — gaz: `customer_code`, elektr: birinchi `customerCode`. Suvda `pid`. */
  subscriberCode: string | null;
  /** Balans — suv: `saldo`, gaz: `current_balance`. Elektrda YO'Q. */
  balance: number | null;
  /** FAQAT GAZ: oxirgi 12 oydagi jami sarf (m³). Boshqalarda har doim `null`. */
  consumedTotal: number | null;
  /**
   * FAQAT GAZ: oxirgi `GAS_CONSUMING_MONTHS` oyda `gas_consume > 0` — ya'ni HISOBLAGICH
   * ko'rsatgan haqiqiy sarf. ⚠️ Bu QAT'IY mezon: hisoblagichi yo'q abonentda hamisha
   * `false` bo'ladi (pastdagi `billed` izohiga qarang).
   */
  consuming: boolean;
  /**
   * FAQAT GAZ: oxirgi `GAS_CONSUMING_MONTHS` oyda `accrual > 0` — hisob FAOL, to'lov
   * hisoblanmoqda.
   *
   * Hisoblagichi yo'q abonentda (`meter_number`/`reading_value` NULL) `gas_consume` 12 oy
   * davomida 0 bo'ladi, lekin `accrual` har oyda 19 800–22 000 so'm — gaz norma bo'yicha
   * hisoblanadi. Aynan shu holatni ushlash uchun alohida bayroq.
   *
   * ⚠️ Amalda bu holat KAM: to'liq ma'lumotda (2423 obyekt) 21 ta gaz abonentidan 19 tasida
   * `billed` va `consuming` BIR XIL. Ya'ni bu bayroq `consuming` ni deyarli takrorlaydi.
   * Dastlab 3 obyektlik namunaga qarab "ancha kengroq" deb baholangan edi — to'liq
   * ma'lumot buni tasdiqlamadi. Baribir alohida saqlanadi: farq mavjud va hisoblagichsiz
   * obyektlar ulushi vaqt o'tishi bilan o'zgarishi mumkin.
   */
  billed: boolean;
  /** FAQAT GAZ: abonent manzili (ko'pincha kvartirani ko'rsatadi). */
  address: string | null;
  /** FAQAT GAZ: oxirgi to'lov sanasi, xom ko'rinishda (`"DD.MM.YYYY"`) — ko'rsatish uchun. */
  lastPaymentDate: string | null;
  /** FAQAT GAZ: o'sha sana `Date` sifatida (saralash/filtr uchun). Parslanmasa `null`. */
  lastPaymentAt: Date | null;
  /** FAQAT GAZ: oxirgi to'lov summasi (so'm). */
  lastPaymentSum: number | null;
  /** FAQAT SUV: `saldo_sst` — balans holati ("Предоплата" / qarz). */
  balanceStatus: string | null;
  /** FAQAT ELEKTR: barcha abonent kodlari (bitta kadastrda bir nechta bo'lishi mumkin). */
  codes: string[];
  /** Obyekt sahifasi/`ObjectStatusCheck.status` uchun qisqa matn. */
  summary: string | null;
  /** Natija ESKI kadastr raqami orqali topilganmi. */
  matchedByOldCad: boolean;
  raw: unknown;
}

export const EMPTY_UTILITY: UtilityInfo = {
  found: false,
  subscriberName: null,
  subscriberCode: null,
  balance: null,
  consumedTotal: null,
  consuming: false,
  billed: false,
  address: null,
  lastPaymentDate: null,
  lastPaymentAt: null,
  lastPaymentSum: null,
  balanceStatus: null,
  codes: [],
  summary: null,
  matchedByOldCad: false,
  raw: null,
};

interface UtilityEndpoint {
  kind: UtilityKind;
  label: string;
  baseUrl: string | undefined;
  parse: (data: unknown) => UtilityInfo;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
};

/**
 * Gaz API sanasi — `"DD.MM.YYYY"`, ISO EMAS (API 4 dagi `auction_date` bilan bir xil
 * tuzoq: `new Date("11.06.2026")` brauzer/Node'da kun va oyni almashtirib yuboradi
 * yoki `Invalid Date` beradi). Shuning uchun qo'lda parslanadi.
 */
function parseDotDate(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  // Oshib ketgan sana (masalan 31.02) boshqa oyga sirg'alib ketmasin.
  if (date.getUTCMonth() !== Number(mo) - 1 || date.getUTCDate() !== Number(d)) return null;
  return date;
}

// ── SUV (Suvsoz) ──
// Topilmaganda `err_code: -425`. Ishonchli belgi — `pid` ning mavjudligi (topilgan
// javobda `err_code` maydoni UMUMAN bo'lmaydi), shuning uchun shunga qaraymiz.
function parseWater(data: unknown): UtilityInfo {
  const d = data as Record<string, unknown> | null;
  const pid = str(d?.pid);
  if (!d || !pid) return { ...EMPTY_UTILITY, raw: data };

  const fio = str(d.fio);
  return {
    ...EMPTY_UTILITY,
    found: true,
    subscriberName: fio,
    subscriberCode: pid,
    balance: num(d.saldo),
    balanceStatus: str(d.saldo_sst),
    summary: fio ? `Abonent: ${fio}` : "Abonent bor",
    raw: data,
  };
}

// ── GAZ (Hududgaz) ──
// Topilmaganda `abonent: null` + `result_code: 73`. Topilganda 12 oylik `interraction`
// tarixi ham keladi — YAGONA haqiqiy sarf manbai.
interface GasPeriod {
  period?: string | null;
  /** Hisoblagich ko'rsatgan sarf (m³). Hisoblagich yo'q bo'lsa doim 0. */
  gas_consume?: number | string | null;
  /** Shu oyga hisoblangan to'lov (so'm). Hisoblagichsiz abonentda ham > 0 bo'ladi. */
  accrual?: number | string | null;
}

function parseGas(data: unknown): UtilityInfo {
  const d = data as { abonent?: Record<string, unknown> | null } | null;
  const ab = d?.abonent;
  if (!ab) return { ...EMPTY_UTILITY, raw: data };

  const periods = Array.isArray(ab.interraction) ? (ab.interraction as GasPeriod[]) : [];
  // Javobda oylar YANGIDAN ESKIGA tartibda keladi (08.2026, 07.2026, ...), shuning
  // uchun "oxirgi N oy" = massivning boshidagi N ta element.
  const recent = periods.slice(0, env.GAS_CONSUMING_MONTHS);
  const consuming = recent.some((p) => (num(p.gas_consume) ?? 0) > 0);
  const billed = recent.some((p) => (num(p.accrual) ?? 0) > 0);
  const consumedTotal = periods.reduce((s, p) => s + (num(p.gas_consume) ?? 0), 0);

  const name = str(ab.name);
  return {
    ...EMPTY_UTILITY,
    found: true,
    subscriberName: name,
    subscriberCode: str(ab.customer_code),
    balance: num(ab.current_balance),
    consumedTotal,
    consuming,
    billed,
    address: str(ab.address),
    lastPaymentDate: str(ab.last_payment_date),
    lastPaymentAt: parseDotDate(ab.last_payment_date),
    lastPaymentSum: num(ab.last_payment_sum),
    summary: consuming
      ? `Hisoblagich bo'yicha sarf bor (${env.GAS_CONSUMING_MONTHS} oyda ${consumedTotal} m³)`
      : billed
        ? "Hisob faol (to'lov hisoblanmoqda, hisoblagich yo'q)"
        : "Abonent bor, harakat yo'q",
    raw: data,
  };
}

// ── ELEKTR (HET) ──
// Topilgan va topilmagan javob TUZILMASI BIR XIL — farq faqat massivlarning
// bo'sh-to'laligida. Abonent nomi ham, sarf ham berilmaydi.
function parseElectric(data: unknown): UtilityInfo {
  const d = data as { abonent?: { customerCode?: unknown } | null } | null;
  const codes = Array.isArray(d?.abonent?.customerCode) ? (d!.abonent!.customerCode as unknown[]) : [];
  if (codes.length === 0) return { ...EMPTY_UTILITY, raw: data };

  const list = codes.map((c) => str(c)).filter((c): c is string => c !== null);
  return {
    ...EMPTY_UTILITY,
    found: true,
    subscriberCode: list[0] ?? null,
    codes: list,
    summary: `${codes.length} ta abonent kodi`,
    raw: data,
  };
}

const ENDPOINTS: UtilityEndpoint[] = [
  { kind: "WATER", label: "Suv (Suvsoz)", baseUrl: env.WATER_API_BASE_URL, parse: parseWater },
  { kind: "GAS", label: "Gaz (Hududgaz)", baseUrl: env.GAS_API_BASE_URL, parse: parseGas },
  { kind: "ELECTRIC", label: "Elektr (HET)", baseUrl: env.ELECTRIC_API_BASE_URL, parse: parseElectric },
];

/** Sozlangan kommunal endpoint'lar. Bo'sh bo'lsa modul umuman ishlamaydi. */
export const UTILITY_ENDPOINTS: UtilityEndpoint[] = ENDPOINTS.filter((e) => Boolean(e.baseUrl));

/** UI yorliqlari — o'zbekcha. Kod ichida "WATER"/"GAS"/"ELECTRIC" qoladi (API bilan mos). */
export const UTILITY_LABEL: Record<UtilityKind, string> = {
  WATER: "Suv",
  GAS: "Gaz",
  ELECTRIC: "Elektr",
};

/**
 * `ObjectStatusCheck.rawResponse` da SAQLANGAN javobni qayta o'qiydi — API'ga
 * chaqirmasdan. Ro'yxat ham, obyekt sahifasi ham SHU funksiyani ishlatadi, ya'ni
 * ko'rsatiladigan qiymatlar sinxronizatsiya paytida hisoblanganlar bilan bir xil
 * mantiqdan chiqadi (`lib/area.ts` bilan bir xil printsip — parser YAGONA joyda).
 */
export function parseUtilityRaw(kind: UtilityKind, raw: unknown): UtilityInfo {
  if (raw === null || raw === undefined) return EMPTY_UTILITY;
  const ep = ENDPOINTS.find((e) => e.kind === kind);
  return ep ? ep.parse(raw) : EMPTY_UTILITY;
}

export function isUtilityConfigured(): boolean {
  return UTILITY_ENDPOINTS.length > 0 && Boolean(env.UTILITY_API_USER && env.UTILITY_API_PASSWORD);
}

/** Bitta xizmatni bitta kadastr bilan tekshiradi. */
async function fetchUtility(ep: UtilityEndpoint, cadNumber: string): Promise<UtilityInfo> {
  try {
    const data = await httpJson<unknown>({
      baseUrl: ep.baseUrl!,
      query: { [env.UTILITY_API_PARAM]: cadNumber },
      basicAuth: { user: env.UTILITY_API_USER ?? "", password: env.UTILITY_API_PASSWORD ?? "" },
      rateKey: `UTIL_${ep.kind}`,
    });
    return ep.parse(data);
  } catch (err) {
    // 404 bu API'larda kutilmaydi (ular 200 + body bilan javob beradi), lekin
    // proxy/gateway darajasida bo'lishi mumkin — "abonent yo'q" deb qabul qilamiz.
    if (err instanceof NotFoundError) return EMPTY_UTILITY;
    throw err;
  }
}

/**
 * Bitta xizmat, ESKI KADASTR FALLBACK bilan — qolgan API'lardagi bilan bir xil naqsh.
 * Fallback amalda kerak: jonli o'lchovda Buxorodagi gaz abonenti FAQAT eski kadastr
 * orqali topilgan.
 */
export async function checkUtility(
  ep: UtilityEndpoint,
  cadNumber: string,
  cadNumberOld: string | null,
): Promise<UtilityInfo> {
  const primary = await fetchUtility(ep, cadNumber);
  if (primary.found) return primary;

  if (cadNumberOld && cadNumberOld !== cadNumber) {
    const fallback = await fetchUtility(ep, cadNumberOld);
    if (fallback.found) return { ...fallback, matchedByOldCad: true };
  }
  return { ...EMPTY_UTILITY, raw: primary.raw };
}

export interface UtilityResults {
  WATER: UtilityInfo;
  GAS: UtilityInfo;
  ELECTRIC: UtilityInfo;
}

/** Uchala xizmatni parallel tekshiradi (sozlanmagani `EMPTY_UTILITY` bo'lib qoladi). */
export async function checkAllUtilities(
  cadNumber: string,
  cadNumberOld: string | null,
): Promise<UtilityResults> {
  const results: UtilityResults = {
    WATER: EMPTY_UTILITY,
    GAS: EMPTY_UTILITY,
    ELECTRIC: EMPTY_UTILITY,
  };
  await Promise.all(
    UTILITY_ENDPOINTS.map(async (ep) => {
      results[ep.kind] = await checkUtility(ep, cadNumber, cadNumberOld);
    }),
  );
  return results;
}
