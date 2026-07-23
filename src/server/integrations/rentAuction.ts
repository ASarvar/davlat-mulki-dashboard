import { env } from "@/lib/env";
import { httpJson, NotFoundError } from "./http";

// ─────────────────────────────────────────────────────────────────────────────
// API 6 — obyektning FAOL IJARA LOTI (savdoda ijara).
// Basic auth, POST body { cad_number }. DIQQAT: API 5 da parametr `cadastre_number`,
// bu yerda `cad_number` — bir xil serverda bo'lsa ham nomlari boshqacha.
//
// Topilsa => obyekt ijara savdosida turibdi => kategoriya 4 "Savdoda ijara".
// Bu API 4 dagi `group_name` ga tayangan eski qoidani almashtiradi: real ma'lumotda
// `group_name` har doim "Davlat aktivlari" edi, ya'ni ijara savdosi hech qachon aniqlanmagan.
// ─────────────────────────────────────────────────────────────────────────────

export interface RentLot {
  order_id?: string | number | null;
  lot_number?: string | number | null;
  auction_date?: string | null;
  lot_place_date?: string | null;
  name?: string | null;
  cadastre_number?: string | null;
  rent_area?: string | number | null;
  start_price?: string | number | null;
  order_status?: string | null;
  lot_status?: string | null;
  district_name?: string | null;
  region_title?: string | null;
}

export interface Api6Response {
  success: boolean;
  count?: number;
  data?: RentLot[] | null;
  message?: string;
}

/** Bitta lot (obyekt bo'lib-bo'lib bir nechta lotga chiqarilishi mumkin). */
export interface ParsedRentLot {
  lotNumber: string | null;
  orderId: number | null;
  lotStatus: string | null;
  orderStatus: string | null;
  /** Shu lotga qo'yilgan ijara maydoni (kv.m) */
  rentArea: number | null;
  startPrice: number | null;
  auctionDate: Date | null;
  name: string | null;
}

export interface RentLotInfo {
  found: boolean;
  /** BARCHA faol ijara lotlari — bitta emas (real ma'lumotda 13 tagacha uchradi). */
  lots: ParsedRentLot[];
  /** Barcha lotlar maydoni yig'indisi */
  totalArea: number;
  /** Eski kadastr orqali topilganmi (chaqiruvchi belgilaydi). */
  matchedByOldCad: boolean;
  raw: unknown;
}

export const EMPTY_RENT_LOT: RentLotInfo = {
  found: false,
  lots: [],
  totalArea: 0,
  matchedByOldCad: false,
  raw: null,
};

export function isRentAuctionConfigured(): boolean {
  return Boolean(env.API6_BASE_URL && env.API6_USERNAME && env.API6_PASSWORD);
}

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 && s !== "0" ? s : null;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const date = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

// API 6: kadastr -> faol ijara loti (bo'lmasa found=false).
export async function fetchActiveRentLot(cadNumber: string): Promise<RentLotInfo> {
  if (!env.API6_BASE_URL) throw new Error("API6_BASE_URL sozlanmagan");

  let res: Api6Response;
  try {
    res = await httpJson<Api6Response>({
      baseUrl: env.API6_BASE_URL,
      method: "POST",
      body: { [env.API6_PARAM]: cadNumber },
      basicAuth: { user: env.API6_USERNAME ?? "", password: env.API6_PASSWORD ?? "" },
      rateKey: "API6",
    });
  } catch (err) {
    if (err instanceof NotFoundError) return EMPTY_RENT_LOT;
    throw err;
  }

  const list = res.data ?? [];
  if (!res.success || list.length === 0) return EMPTY_RENT_LOT;

  const lots: ParsedRentLot[] = list.map((lot) => ({
    lotNumber: str(lot.lot_number),
    orderId: num(lot.order_id) != null ? Math.trunc(num(lot.order_id)!) : null,
    lotStatus: str(lot.lot_status),
    orderStatus: str(lot.order_status),
    rentArea: num(lot.rent_area),
    startPrice: num(lot.start_price),
    auctionDate: date(lot.auction_date),
    name: str(lot.name),
  }));

  return {
    found: true,
    lots,
    totalArea: lots.reduce((s, l) => s + (l.rentArea ?? 0), 0),
    matchedByOldCad: false,
    raw: res,
  };
}
