import { env } from "@/lib/env";
import { httpJson, NotFoundError } from "./http";

// ─────────────────────────────────────────────────────────────────────────────
// API 5 — obyektning IJARA SHARTNOMALARI (Basic auth, POST + kadastr raqami)
//   contract_sum === 0  => "Tekin foydalanish"     (kategoriya 3)
//   contract_sum > 0    => "Ijara shartnomasi bor" (kategoriya 11)
// ─────────────────────────────────────────────────────────────────────────────

export interface RentContract {
  region_name?: string | null;
  district_name?: string | null;
  object_cadastre_number?: string | null;
  contract_number?: string | null;
  contract_date?: string | null;
  contract_sum?: string | number | null;
  rental_area?: string | number | null;
  owner_tin?: string | null;
  owner_name?: string | null;
  tenant_tin?: string | null;
  tenant_name?: string | null;
  doc_link?: string | null;
}

export interface Api5Response {
  success: boolean;
  title?: string;
  count?: number;
  data?: RentContract[] | null;
  message?: string;
}

export interface RentInfo {
  found: boolean;
  /** Shartnomalar soni (API'dagi count, bo'lmasa data uzunligi). */
  contractCount: number;
  /** Barcha shartnomalar summasi. 0 => tekin foydalanish. */
  totalSum: number;
  /** Barcha shartnomalar maydoni (kv.m). */
  totalArea: number;
  /** BARCHA shartnomalar — bittasi emas (bir kadastrda 18 tagacha uchradi). */
  contracts: RentContract[];
  /** Ma'lumot eski kadastr raqami orqali topilganmi. */
  matchedByOldCad: boolean;
  raw: unknown;
}

export const EMPTY_RENT: RentInfo = {
  found: false,
  contractCount: 0,
  totalSum: 0,
  totalArea: 0,
  contracts: [],
  matchedByOldCad: false,
  raw: null,
};

export function isRentApiConfigured(): boolean {
  return Boolean(env.API5_BASE_URL && env.API5_USERNAME && env.API5_PASSWORD);
}

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
};

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// API 5: kadastr raqami bo'yicha ijara shartnomalari ro'yxati.
export async function fetchRentContracts(cadNumber: string): Promise<RentInfo> {
  if (!env.API5_BASE_URL) throw new Error("API5_BASE_URL sozlanmagan");

  let res: Api5Response;
  try {
    res = await httpJson<Api5Response>({
      baseUrl: env.API5_BASE_URL,
      method: "POST",
      body: { [env.API5_PARAM]: cadNumber },
      basicAuth: { user: env.API5_USERNAME ?? "", password: env.API5_PASSWORD ?? "" },
      rateKey: "API5",
    });
  } catch (err) {
    if (err instanceof NotFoundError) return EMPTY_RENT;
    throw err;
  }

  const list = res.data ?? [];
  if (!res.success || list.length === 0) return EMPTY_RENT;

  return {
    found: true,
    contractCount: res.count ?? list.length,
    totalSum: list.reduce((acc, c) => acc + num(c.contract_sum), 0),
    totalArea: list.reduce((acc, c) => acc + num(c.rental_area), 0),
    contracts: list,
    matchedByOldCad: false, // chaqiruvchi (fallback) belgilaydi
    raw: res,
  };
}

// Bo'sh satrni null'ga aylantiruvchi eksport (processor uchun).
export const rentStr = str;
export const rentNum = num;
