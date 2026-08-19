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
// ⚠️ TUZOQ 3 — "abonent bor" va "sarflayapti" bir xil narsa emas. Suv faqat balansni
// beradi. Gaz sarf/to'lov tarixini beradi (`interraction[]`, 12 oy). ELEKTR esa IKKI
// BOSQICHLI: 1-bosqich (`het_data`) faqat abonent KODINI beradi (nom ham yo'q),
// tafsilot 2-bosqichdan (`het_data_detail`) keladi — API 3 -> API 4 zanjiri kabi.
//
// ⚠️ TUZOQ 5 — SANA FORMATLARI bir xil emas: gaz `"DD.MM.YYYY"`, elektr `"YYYY-MM-DD"`.
// Ikki alohida parser bor (`parseDotDate` / `parseIsoDate`); birini ikkinchisining
// ma'lumotiga qo'llash jimgina `null` beradi.
//
// ⚠️ TUZOQ 6 — elektr 1-bosqichi kadastrni TAXMINAN moslashtiradi. Jonli sinovda
// `20:08:41:01:01:0019` so'rovi `KADASTR_CODE = 20:08:09:01:01:0024` bo'lgan JISMONIY
// SHAXS abonentini qaytardi. Shuning uchun 2-bosqichdagi `cadastreMatch` bayrog'i
// haqiqiy moslikni soxtasidan ajratadi — "abonent bor" o'z-o'zicha dalil emas.
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

/**
 * Elektrning 2-BOSQICH (`het_data_detail`) natijasi — bitta abonent.
 *
 * 1-bosqich uchta INDEKS BO'YICHA TEKISLANGAN massiv qaytaradi
 * (`soato[]`, `customerCode[]`, `customerType[]`), har bir indeks = bitta abonent;
 * tafsilot esa har bir abonent uchun alohida so'raladi.
 */
export interface ElectricSubscriber {
  /** `CUSTOMER_CODE` (1-bosqichdagi `customerCode` bilan bir xil, `licshet` parametri). */
  code: string | null;
  /** Tafsilotdagi `CUSTOMER_TYPE` — masalan "HOUSEHOLD" (1-bosqichda qisqartma: "P"). */
  customerType: string | null;
  soato: string | null;
  /** `FIO` — 1-bosqich abonent nomini UMUMAN bermaydi, faqat shu yerdan keladi. */
  name: string | null;
  address: string | null;
  /** Abonentning O'Z kadastri (`KADASTR_CODE`) — so'ralganidan farq qilishi mumkin. */
  cadastreCode: string | null;
  /** `cadastreCode` so'ralgan kadastr bilan mos keldimi. */
  cadastreMatch: boolean;
  /** `INN` — yuridik shaxs bo'lsa tashkilot STIRi bilan solishtirish mumkin. */
  inn: string | null;
  contractNumber: string | null;
  contractDate: string | null;
  /** `TARIF_PRICE` — 1 kVt·soat narxi (so'm). */
  tariffPrice: number | null;
  meterType: string | null;
  meterNo: string | null;
  /** `LAST_POK` — hisoblagichning oxirgi ko'rsatkichi va uning sanasi. */
  lastReading: number | null;
  lastReadingDate: string | null;
  /** `BALANCE_CUSTOMER` — manfiy = qarz. */
  balance: number | null;
  /** `SALDO_PERIOD.CURRENT_EE_KWH` yig'indisi (kVt·soat) — GAZDAN FARQLI, m³ EMAS. */
  consumedKwh: number;
  /** Oxirgi `ELECTRIC_CONSUMING_MONTHS` oyda sarf > 0. */
  consuming: boolean;
  /** Oxirgi `ELECTRIC_CONSUMING_MONTHS` oyda hisoblangan summa > 0. */
  billed: boolean;
  /** Nechta oylik davr qaytdi (jonli javobda 11 ta edi, 12 emas). */
  months: number;
  lastPaymentSum: number | null;
  lastPaymentDate: string | null;
  lastPaymentAt: Date | null;
}

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
  /**
   * FAQAT ELEKTR (2-bosqich): har bir abonent kodi bo'yicha to'liq tafsilot.
   * 1-bosqich (`het_data`) faqat kodlarni beradi — bu massiv `het_data_detail`
   * chaqiruvlaridan to'ladi. Tafsilot olinmagan bo'lsa (eski yozuvlar yoki
   * `ELECTRIC_DETAIL_API_BASE_URL` sozlanmagan) — BO'SH massiv.
   */
  subscribers: ElectricSubscriber[];
  /**
   * FAQAT ELEKTR: abonentlardan KAMIDA BITTASINING `KADASTR_CODE` si so'ralgan
   * kadastr bilan mos keldimi.
   *
   * ⚠️ Qamrov sifatining asosiy o'lchovi — pastdagi `parseElectricDetail` izohiga qarang.
   */
  cadastreMatch: boolean;
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
  subscribers: [],
  cadastreMatch: false,
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

/**
 * ⚠️ ELEKTR sanalari — `"YYYY-MM-DD"` (ISO), gazning `"DD.MM.YYYY"` sidan BOSHQACHA.
 * Bitta modul ichida ikki xil format bor, shuning uchun ikki alohida parser: gaz
 * sanasini shu funksiyaga (yoki aksincha) berish jimgina `null` qaytaradi.
 */
function parseIsoDate(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (date.getUTCMonth() !== Number(mo) - 1 || date.getUTCDate() !== Number(d)) return null;
  return date;
}

/** Parallel massivdagi sonlar (bo'lmasa bo'sh massiv). */
function numArray(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => num(x) ?? 0);
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

// ── ELEKTR (HET) — IKKI BOSQICHLI ──
// 1-bosqich `het_data?cad_number=` : topilgan va topilmagan javob TUZILMASI BIR XIL,
//   farq faqat massivlarning bo'sh-to'laligida. Abonent nomi ham, sarf ham YO'Q.
// 2-bosqich `het_data_detail?customer_type=&soato=&licshet=` : har bir abonent uchun
//   FIO, manzil, balans, oylik sarf va to'lov tarixi.

/** 1-bosqich javobidan abonent kalitlari (uchta massiv indeks bo'yicha tekislangan). */
export interface ElectricKey {
  code: string;
  soato: string | null;
  customerType: string | null;
}

export function electricKeys(listRaw: unknown): ElectricKey[] {
  const d = listRaw as {
    abonent?: { soato?: unknown; customerCode?: unknown; customerType?: unknown } | null;
  } | null;
  const ab = d?.abonent;
  if (!ab) return [];
  const codes = Array.isArray(ab.customerCode) ? ab.customerCode : [];
  const soatos = Array.isArray(ab.soato) ? ab.soato : [];
  const types = Array.isArray(ab.customerType) ? ab.customerType : [];
  return codes
    .map((c, i) => ({ code: str(c), soato: str(soatos[i]), customerType: str(types[i]) }))
    .filter((k): k is ElectricKey => k.code !== null);
}

/**
 * Tafsilot javobining o'ramini ochadi.
 *
 * ⚠️ O'ram nomi ABONENT TURIGA bog'liq: jonli sinovda uy xo'jaligi uchun
 * `houseHoldResponse` keldi (`CUSTOMER_TYPE: "HOUSEHOLD"`). Yuridik shaxs uchun
 * o'ram nomi boshqacha bo'lishi kutiladi, lekin jonli KO'RILMAGAN — shuning uchun
 * nom bo'yicha qattiq bog'lanmaymiz: ildizdagi abonentga o'xshagan birinchi obyekt
 * olinadi (`CUSTOMER_CODE`/`FIO` bor bo'lsa). O'ramsiz kelsa ham ishlaydi.
 */
function unwrapElectricDetail(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const root = data as Record<string, unknown>;
  const looksLikeSubscriber = (o: unknown): o is Record<string, unknown> =>
    Boolean(o) &&
    typeof o === "object" &&
    !Array.isArray(o) &&
    ("CUSTOMER_CODE" in (o as object) || "FIO" in (o as object));

  if (looksLikeSubscriber(root)) return root;
  for (const v of Object.values(root)) {
    if (looksLikeSubscriber(v)) return v;
  }
  return null;
}

/**
 * Bitta tafsilot javobini `ElectricSubscriber` ga aylantiradi.
 *
 * ⚠️ `KADASTR_CODE` — eng muhim maydon. Jonli sinovda `20:08:41:01:01:0019` bo'yicha
 * so'ralgan abonentning o'z kadastri `20:08:09:01:01:0024` bo'lib chiqdi, ya'ni elektr
 * API'si kadastrni TAXMINAN moslashtiradi va qaytargan abonent BOSHQA obyektning uy
 * xo'jaligi bo'lishi mumkin (FIO — jismoniy shaxs, manzil — qishloqdagi uy).
 * Shu sababli "abonent bor" o'z-o'zicha dalil emas; `cadastreMatch` bilan birga o'qiladi.
 */
function parseElectricDetail(detailRaw: unknown, queriedCad: string | null): ElectricSubscriber | null {
  const ab = unwrapElectricDetail(detailRaw);
  if (!ab) return null;

  // Oylik davrlar YANGIDAN ESKIGA (jonli javobda 2026-07-01 dan 2025-09-01 gacha),
  // gazdagi `interraction` bilan bir xil tartib — "oxirgi N oy" = boshidagi N ta.
  const sp = (ab.SALDO_PERIOD ?? null) as Record<string, unknown> | null;
  const kwh = numArray(sp?.CURRENT_EE_KWH);
  const sums = numArray(sp?.CURRENT_EE_SUM);
  const n = env.ELECTRIC_CONSUMING_MONTHS;

  const cadastreCode = str(ab.KADASTR_CODE);
  return {
    code: str(ab.CUSTOMER_CODE),
    customerType: str(ab.CUSTOMER_TYPE),
    soato: str(ab.SOATO),
    name: str(ab.FIO),
    address: str(ab.ADRESS),
    cadastreCode,
    cadastreMatch: Boolean(cadastreCode && queriedCad && cadastreCode === queriedCad),
    inn: str(ab.INN),
    contractNumber: str(ab.CONTRACT_NUMBER),
    contractDate: str(ab.CONTRACT_DATE),
    tariffPrice: num(ab.TARIF_PRICE),
    meterType: str(ab.METER_TYPE),
    meterNo: str(ab.METER_NO),
    lastReading: num(ab.LAST_POK),
    lastReadingDate: str(ab.LAST_POK_DATE),
    balance: num(ab.BALANCE_CUSTOMER),
    consumedKwh: kwh.reduce((s, v) => s + v, 0),
    consuming: kwh.slice(0, n).some((v) => v > 0),
    billed: sums.slice(0, n).some((v) => v > 0),
    months: kwh.length,
    lastPaymentSum: num(ab.LAST_PAYMENT),
    lastPaymentDate: str(ab.LAST_PAYMENT_DATE),
    lastPaymentAt: parseIsoDate(ab.LAST_PAYMENT_DATE),
  };
}

/**
 * Elektr uchun SAQLANADIGAN xom javob o'rami.
 *
 * ⚠️ `cad` shu yerda saqlanishi SHART: `parseUtilityRaw()` ko'rsatish paytida kadastrni
 * bilmaydi, shuning uchun usiz `cadastreMatch` ni qayta hisoblab bo'lmasdi (ro'yxat va
 * obyekt sahifasi aynan saqlangan xomdan o'qiydi).
 */
interface ElectricRawEnvelope {
  cad: string | null;
  list: unknown;
  details: unknown[];
}

function isEnvelope(data: unknown): data is ElectricRawEnvelope {
  return Boolean(data) && typeof data === "object" && "list" in (data as object) && "details" in (data as object);
}

/**
 * ⚠️ IKKI XIL xom javobni ham o'qiydi:
 *  - ESKI (2-bosqich qo'shilgunga qadar saqlangan 2448 yozuv): 1-bosqichning o'zi,
 *    `{ abonent: { customerCode: [...] } }` — tafsilotsiz, faqat kodlar.
 *  - YANGI: `{ cad, list, details[] }` o'rami.
 * Eski yozuvlar migratsiyasiz o'qilaveradi; tafsilot keyingi kommunal sinxronizatsiyada to'ladi.
 */
function parseElectric(data: unknown): UtilityInfo {
  const envelope = isEnvelope(data);
  const listRaw = envelope ? (data as ElectricRawEnvelope).list : data;
  const queriedCad = envelope ? (data as ElectricRawEnvelope).cad : null;

  const keys = electricKeys(listRaw);
  if (keys.length === 0) return { ...EMPTY_UTILITY, raw: data };

  const codes = keys.map((k) => k.code);
  const details = envelope ? (data as ElectricRawEnvelope).details : [];
  const subscribers = details
    .map((d) => parseElectricDetail(d, queriedCad))
    .filter((s): s is ElectricSubscriber => s !== null);

  // Tafsilot yo'q (eski yozuv yoki 2-bosqich sozlanmagan) — avvalgi xulq saqlanadi.
  if (subscribers.length === 0) {
    return {
      ...EMPTY_UTILITY,
      found: true,
      subscriberCode: codes[0] ?? null,
      codes,
      summary: `${codes.length} ta abonent kodi`,
      raw: data,
    };
  }

  // "Asosiy" abonent: avval kadastri MOS kelgani, keyin sarfi bori, aks holda birinchisi.
  // (Bitta kadastrda bir nechta abonent bo'lishi mumkin — jonli ma'lumotda 2 tagachasi bor.)
  const primary =
    subscribers.find((s) => s.cadastreMatch) ?? subscribers.find((s) => s.consuming) ?? subscribers[0];

  const cadastreMatch = subscribers.some((s) => s.cadastreMatch);
  const consuming = subscribers.some((s) => s.consuming);
  const billed = subscribers.some((s) => s.billed);
  // Jami sarf — BARCHA abonentlar bo'yicha (kadastri mos kelmaganlari ham qo'shiladi,
  // shuning uchun `cadastreMatch` bilan birga o'qilishi kerak).
  const consumedKwh = subscribers.reduce((s, x) => s + x.consumedKwh, 0);
  // Oxirgi to'lov — abonentlar ichidagi ENG YANGISI ("yaqinda to'lov" mezoni uchun).
  const lastPaid = subscribers
    .filter((s) => s.lastPaymentAt != null)
    .sort((a, b) => b.lastPaymentAt!.getTime() - a.lastPaymentAt!.getTime())[0];

  const summary = consuming
    ? `Sarf bor (${consumedKwh.toLocaleString("uz-UZ")} kVt·soat)`
    : billed
      ? "Hisob faol, sarf qayd etilmagan"
      : "Abonent bor, harakat yo'q";

  return {
    ...EMPTY_UTILITY,
    found: true,
    subscriberName: primary.name,
    subscriberCode: primary.code ?? codes[0] ?? null,
    balance: primary.balance,
    address: primary.address,
    consumedTotal: consumedKwh,
    consuming,
    billed,
    lastPaymentDate: lastPaid?.lastPaymentDate ?? null,
    lastPaymentAt: lastPaid?.lastPaymentAt ?? null,
    lastPaymentSum: lastPaid?.lastPaymentSum ?? null,
    codes,
    subscribers,
    cadastreMatch,
    summary: cadastreMatch ? summary : `${summary} — kadastr mos emas`,
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

/**
 * Oxirgi to'lov sanasini BIR XIL ko'rinishda beradi.
 *
 * ⚠️ Kerak, chunki vendorlar sanani ikki xil formatda qaytaradi (gaz `"DD.MM.YYYY"`,
 * elektr `"YYYY-MM-DD"`) va ikkalasi ro'yxatda BITTA ustunda yonma-yon chiqadi.
 * Parslangan `Date` bo'lsa o'shandan, aks holda xom satr o'z holicha ko'rsatiladi.
 */
export function formatLastPayment(u: Pick<UtilityInfo, "lastPaymentAt" | "lastPaymentDate">): string | null {
  if (u.lastPaymentAt) return u.lastPaymentAt.toLocaleDateString("uz");
  return u.lastPaymentDate;
}

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

// ── ELEKTR 2-BOSQICH: tafsilot chaqiruvi ──

export function isElectricDetailConfigured(): boolean {
  return Boolean(env.ELECTRIC_DETAIL_API_BASE_URL && env.UTILITY_API_USER && env.UTILITY_API_PASSWORD);
}

/**
 * Saqlashdan OLDIN shaxsiy ma'lumotlarni olib tashlaydi.
 *
 * ⚠️ Tafsilot javobi FUQARONING shaxsiy hujjat ma'lumotlarini o'z ichiga oladi
 * (`PASSPORT_NUMBER`, `PINFL`, telefon raqamlari) — bu obyekt monitoringi uchun
 * UMUMAN kerak emas va hech qaysi hisob-kitobga kirmaydi, lekin xom javob bazada
 * uzoq muddat saqlanadi. Shuning uchun shu uch-to'rt maydon yozishdan oldin
 * o'chiriladi. `INN` QOLDIRILADI — u yuridik shaxsni tashkilot STIRi bilan
 * solishtirish imkonini beradi (analitik qiymati bor).
 */
const PII_FIELDS = ["PASSPORT_NUMBER", "PINFL", "PHONE_MOBILE", "PHONE_MOBILE_D"] as const;

// Eksport qilingan — bu maxfiylik kafolati, shuning uchun alohida sinovdan o'tkaziladi.
export function redactElectricDetail(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const root = { ...(raw as Record<string, unknown>) };
  for (const [key, value] of Object.entries(root)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const inner = { ...(value as Record<string, unknown>) };
    for (const f of PII_FIELDS) if (f in inner) delete inner[f];
    root[key] = inner;
  }
  // O'ramsiz kelgan holat (ildizning o'zi abonent).
  for (const f of PII_FIELDS) if (f in root) delete root[f];
  return root;
}

/** Bitta abonentning tafsiloti. Xato bo'lsa `null` — qolganlari baribir olinadi. */
async function fetchElectricDetail(key: ElectricKey): Promise<unknown | null> {
  try {
    const data = await httpJson<unknown>({
      baseUrl: env.ELECTRIC_DETAIL_API_BASE_URL!,
      // ⚠️ Parametr nomlari jonli tasdiqlangan (2026-08-19) — `cad_number` EMAS.
      query: {
        customer_type: key.customerType ?? "",
        soato: key.soato ?? "",
        licshet: key.code,
      },
      basicAuth: { user: env.UTILITY_API_USER ?? "", password: env.UTILITY_API_PASSWORD ?? "" },
      rateKey: "UTIL_ELECTRIC_DETAIL",
    });
    return redactElectricDetail(data);
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    // Bitta abonentning tafsiloti kelmasa butun kommunal tekshiruv yiqilmasin —
    // 1-bosqich natijasi (abonent kodi) baribir saqlanadi.
    console.error(`[utility] elektr tafsiloti olinmadi (licshet=${key.code}):`, err);
    return null;
  }
}

/**
 * 1-bosqich natijasini tafsilotlar bilan boyitadi va YANGI o'ramni qaytaradi.
 *
 * `matchedCad` — 1-bosqichda AYNAN qaysi kadastr ishlagani (eski kadastr fallback
 * bo'lgan bo'lsa — eskisi). `cadastreMatch` shu bilan solishtiriladi.
 */
async function enrichElectric(base: UtilityInfo, matchedCad: string): Promise<UtilityInfo> {
  if (!base.found || !isElectricDetailConfigured()) return base;

  const keys = electricKeys(base.raw);
  if (keys.length === 0) return base;

  const details = await Promise.all(keys.map(fetchElectricDetail));
  const envelope: ElectricRawEnvelope = {
    cad: matchedCad,
    list: base.raw,
    details: details.filter((d) => d !== null),
  };
  // Xomdan QAYTA o'qiymiz — ko'rsatish paytidagi `parseUtilityRaw()` bilan bir xil
  // yo'l (lib/area.ts dagi "parser yagona joyda" printsipi).
  return { ...parseElectric(envelope), matchedByOldCad: base.matchedByOldCad };
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
      const info = await checkUtility(ep, cadNumber, cadNumberOld);
      // Elektr — YAGONA ikki bosqichli xizmat: 1-bosqich faqat abonent kodini beradi,
      // qolgan hamma narsa (ism/sarf/to'lov) tafsilot chaqiruvidan keladi.
      results[ep.kind] =
        ep.kind === "ELECTRIC"
          ? await enrichElectric(info, info.matchedByOldCad && cadNumberOld ? cadNumberOld : cadNumber)
          : info;
    }),
  );
  return results;
}
