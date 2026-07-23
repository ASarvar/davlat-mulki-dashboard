import { env } from "@/lib/env";
import { httpJson, NotFoundError } from "./http";

// ─────────────────────────────────────────────────────────────────────────────
// API 3 + API 4 — auksion zanjiri (ikkalasi ham BASIC AUTH, bir xil user/parol)
//   API 3: kadastr -> lot ma'lumoti + order_id   (POST)
//   API 4: order_id -> to'liq auksion/order ma'lumoti
// ─────────────────────────────────────────────────────────────────────────────

export interface Api3Response {
  success: boolean;
  data?: {
    lot_number?: number | string | null;
    status_id?: number | null;
    status_name?: string | null;
    order_id?: number | string | null;
    cad_number?: string | null;
    region_code?: number | null;
    owner_inn?: number | string | null;
  } | null;
  message?: string;
}

export interface Api4Detail {
  key?: string;
  title?: string;
  value?: string | null;
}

export interface Api4Order {
  order_id?: number | null;
  order_statuses_id?: number | null;
  order_status?: string | null;
  /** 1 => bo'lib to'lash sharti bilan. Bu ASOSIY mezon (details.tulov_muddati emas). */
  term_payment?: number | null;
  term_month?: number | null;
  lot_number?: string | number | null;
  lot_status?: string | null;
  lot_statuses_id?: number | null;
  name?: string | null;
  sold_price?: number | null;
  start_price?: number | null;
  auction_date?: string | null;
  winner_name?: string | null;
  details?: Api4Detail[] | null;
  [k: string]: unknown;
}

export interface Api4Response {
  result?: {
    result_code?: number;
    result_msg?: string;
    order?: Api4Order | null;
  } | null;
  httpcode?: number;
  group_name?: string;
}

// Auksion tekshiruvi natijasi (bitta obyekt uchun).
export interface AuctionInfo {
  found: boolean;
  lotNumber: string | null;
  lotStatus: string | null;
  orderId: number | null;
  orderStatusId: number | null;
  orderStatus: string | null;
  /** order.term_payment — 1 bo'lsa BO'LIB TO'LASH (asosiy mezon). */
  termPayment: number | null;
  /** Oylar soni (term_month yoki details "tulov_muddati") — faqat ko'rsatish uchun. */
  paymentTermMonths: number | null;
  /** Sotilganmi (order_statuses_id === 6). */
  isSold: boolean;
  /** API 4 javobidagi group_name — savdo ijara uchunmi yoki xususiylashtirishmi. */
  groupName: string | null;
  /** API 3 dagi xom `status_name` (kirillcha): "Савдода", "Экспертиза", "Муаммоли" ... */
  assetStatus: string | null;
  /** API 4 `start_price` — faqat order topilganda mavjud. */
  startPrice: number | null;
  /** API 4 `auction_date` (jonli javobda `DD.MM.YYYY HH:mm:ss`). */
  auctionDate: Date | null;
  /** API 4 `details["hudud_kvm_2"]` — binolar/inshootlar egallagan maydon (kv.m). */
  area: number | null;
  raw: unknown;
}

/** API 4 da bu qiymat "sotilgan" degani (foydalanuvchi tomonidan tasdiqlangan). */
export const ORDER_STATUS_SOLD = 6;

export const EMPTY_AUCTION: AuctionInfo = {
  found: false,
  lotNumber: null,
  lotStatus: null,
  orderId: null,
  orderStatusId: null,
  orderStatus: null,
  termPayment: null,
  paymentTermMonths: null,
  isSold: false,
  groupName: null,
  assetStatus: null,
  startPrice: null,
  auctionDate: null,
  area: null,
  raw: null,
};

export function isAuctionConfigured(): boolean {
  return Boolean(env.API3_BASE_URL && env.AUCTION_API_USER && env.AUCTION_API_PASSWORD);
}

function basic() {
  return { user: env.AUCTION_API_USER ?? "", password: env.AUCTION_API_PASSWORD ?? "" };
}

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
};

/**
 * Lot raqami uchun: API `0` yoki `"0"` qaytarishi mumkin — bu lot YO'Q degani.
 * `str()` ni to'g'ridan-to'g'ri ishlatsak "0" satri "lot bor" deb qabul qilinardi
 * va obyekt noto'g'ri "savdoda" kategoriyasiga tushardi.
 */
const lotStr = (v: unknown): string | null => {
  const s = str(v);
  return s && s !== "0" ? s : null;
};

const int = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

/** `start_price` kabi ba'zi sonli maydonlar vergulni kasr ajratkich sifatida ishlatishi mumkin. */
const numLoose = (v: unknown): number | null => {
  const s = str(v);
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

// Son: guruh ajratkich sifatida bo'sh joy ("1 434"), kasr ajratkich vergul yoki nuqta.
const AMOUNT_RE = "\\d+(?:[ \\u00A0]\\d{3})*(?:[.,]\\d+)?";

/**
 * `hudud_kvm_2` jonli javobda ko'pincha toza son emas, erkin matn: "Huquqiy hujjatga
 * asosan 1048,93 (Amalda 1112,23)" yoki "Umumiy maydoni: 47,0 kv.m." Ikkita raqam
 * bo'lsa "amalda" (haqiqiy o'lchangan) qiymati ustuvor — foydalanuvchi tasdiqlagan.
 */
const parseAreaText = (v: unknown): number | null => {
  const s = str(v);
  if (!s) return null;
  const amaldaMatch = s.match(new RegExp(`amalda\\D*?(${AMOUNT_RE})`, "i"));
  const raw = amaldaMatch?.[1] ?? s.match(new RegExp(AMOUNT_RE))?.[0];
  if (!raw) return null;
  const n = Number(raw.replace(/[  ]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** API 4 `auction_date` jonli javobda ISO emas — "DD.MM.YYYY HH:mm:ss". */
const parseApi4Date = (v: unknown): Date | null => {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh = "00", mi = "00", ss = "00"] = m;
  const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`);
  return Number.isNaN(d.getTime()) ? null : d;
};

// details[] ichidan kalit bo'yicha qiymat olish.
function detailValue(order: Api4Order, key: string): string | null {
  const d = order.details?.find((x) => x.key === key);
  return str(d?.value);
}

// ─── API 3: kadastr -> lot/order ───
// Jonli tasdiqlangan: POST + JSON body { cad_number: "..." } + Basic auth.
export async function fetchAuctionAssetByCadastre(cadNumber: string): Promise<Api3Response["data"] | null> {
  if (!env.API3_BASE_URL) throw new Error("API3_BASE_URL sozlanmagan");

  try {
    const res = await httpJson<Api3Response>({
      baseUrl: env.API3_BASE_URL,
      method: "POST",
      body: { [env.API3_PARAM]: cadNumber },
      basicAuth: basic(),
      rateKey: "API3",
    });
    if (!res.success || !res.data) return null;
    return res.data;
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    throw err;
  }
}

// ─── API 4: order_id -> to'liq ma'lumot ───
// Jonli tasdiqlangan: GET {API4_BASE_URL}?order={order_id}  (POST EMAS).
// Javob `result` o'ramida keladi. DIQQAT: parametr o'qilmasa API `result`siz
// {"result_msg":"Xatolik yuz berdi","result_code":0} qaytaradi — ya'ni result_code=0
// o'zi muvaffaqiyat kafolati emas, `order` mavjudligini ham tekshiramiz.
export async function fetchAuctionOrder(
  orderId: number | string,
): Promise<{ order: Api4Order; groupName: string | null } | null> {
  if (!env.API4_BASE_URL) throw new Error("API4_BASE_URL sozlanmagan");

  try {
    const res = await httpJson<Api4Response>({
      baseUrl: env.API4_BASE_URL,
      query: { [env.API4_PARAM]: String(orderId) },
      basicAuth: basic(),
      rateKey: "API4",
    });
    // result_code 27 = "buyurtma aniqlanmadi"; 0 + order mavjud => muvaffaqiyat
    if (!res.result || (res.result.result_code ?? -1) !== 0 || !res.result.order) return null;
    // group_name javobning YUQORI darajasida (result ichida emas) — savdo turini
    // (ijara / xususiylashtirish) shu maydon aniqlaydi.
    return { order: res.result.order, groupName: str(res.group_name) };
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    throw err;
  }
}

// ─── Zanjir: kadastr -> API 3 -> order_id -> API 4 ───
export async function checkAuction(cadNumber: string): Promise<AuctionInfo> {
  const asset = await fetchAuctionAssetByCadastre(cadNumber);
  if (!asset) return EMPTY_AUCTION;

  const orderId = int(asset.order_id);
  // API 3 topildi, lekin order_id yo'q — faqat lot ma'lumotini qaytaramiz.
  if (orderId === null) {
    return {
      ...EMPTY_AUCTION,
      found: true,
      lotNumber: lotStr(asset.lot_number),
      lotStatus: str(asset.status_name),
      assetStatus: str(asset.status_name),
      raw: { api3: asset },
    };
  }

  const fetched = await fetchAuctionOrder(orderId);
  if (!fetched) {
    return {
      ...EMPTY_AUCTION,
      found: true,
      lotNumber: lotStr(asset.lot_number),
      lotStatus: str(asset.status_name),
      assetStatus: str(asset.status_name),
      orderId,
      raw: { api3: asset },
    };
  }

  const { order, groupName } = fetched;
  const orderStatusId = int(order.order_statuses_id);
  // Oylar: avval term_month, bo'lmasa details "tulov_muddati" (ko'rsatish uchun).
  const months = int(order.term_month) ?? int(detailValue(order, "tulov_muddati"));

  return {
    found: true,
    // Havola API 4 dagi lot raqamiga quriladi; yo'q bo'lsa API 3 dagisi.
    lotNumber: lotStr(order.lot_number) ?? lotStr(asset.lot_number),
    lotStatus: str(order.lot_status) ?? str(asset.status_name),
    orderId: int(order.order_id) ?? orderId,
    orderStatusId,
    orderStatus: str(order.order_status),
    termPayment: int(order.term_payment),
    paymentTermMonths: months && months > 0 ? months : null,
    isSold: orderStatusId === ORDER_STATUS_SOLD,
    groupName,
    assetStatus: str(asset.status_name),
    startPrice: numLoose(order.start_price),
    auctionDate: parseApi4Date(order.auction_date),
    area: parseAreaText(detailValue(order, "hudud_kvm_2")),
    // group_name'ni ham saqlaymiz — keyinchalik API'siz qayta hisoblash uchun kerak.
    raw: { api3: asset, api4: order, group_name: groupName },
  };
}

/** e-auksion.uz dagi lot sahifasi manzili. */
export function lotUrl(lotNumber: string): string {
  return `https://e-auksion.uz/lot-view?lot_id=${encodeURIComponent(lotNumber)}`;
}
