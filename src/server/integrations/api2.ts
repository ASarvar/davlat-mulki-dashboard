import { API2 } from "./config";
import { httpJson, NotFoundError } from "./http";
import type { PropertyBaseData } from "./types";

// API 2 ning HAQIQIY javob shakli (UZKAD). To'liq javob rawApi2'ga saqlanadi,
// bu yerda faqat bizga kerakli maydonlar tiplangan.
export interface Api2Response {
  code: number;
  message: string;
  data_source?: string;
  response_id?: number;

  cad_number?: string;
  cad_number_old?: string | null; // ⚠️ topilmasa "" (bo'sh satr) keladi, null emas
  name?: string | null;

  region?: string | null;
  district?: string | null;
  address?: string | null;
  short_address?: string | null;

  // Maydonlar: yer va obyekt alohida
  land_area?: number | string | null;
  object_area?: number | string | null;

  subjects?: { name?: string | null; inn?: string | null; type?: number }[];
  [k: string]: unknown;
}

export type Api2Result = { ok: true; data: PropertyBaseData } | { ok: false; reason: string };

const API2_SUCCESS_CODE = 1;

// API 2 rate-limitga urilganda code=90000 "Message throttled out" qaytaradi.
// Bu VAQTINCHALIK xato — uni "topilmadi" deb yozib qo'ysak, obyekt ma'lumotsiz qoladi.
// Shuning uchun xato tashlaymiz: http.ts retry/backoff qiladi, job qayta uriniladi.
const API2_THROTTLED_CODE = 90000;

export class Api2ThrottledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Api2ThrottledError";
  }
}

// Bo'sh satrni null'ga aylantiradi — cad_number_old uchun KRITIK:
// aks holda fallback API 3–8 ga bo'sh kadastr bilan murojaat qilardi.
function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// API 2: kadastr raqami bo'yicha obyektning asosiy ma'lumotlari.
// So'rov: GET {API2_BASE_URL}/{API2_PATH}?num={kadastr}&token={API2_TOKEN}
// (token query parametr sifatida ketadi — headerda emas; tokensiz endpoint 404 beradi)
export async function fetchPropertyBase(cadNumber: string): Promise<Api2Result> {
  if (!API2.baseUrl) throw new Error("API2_BASE_URL sozlanmagan");

  let res: Api2Response;
  try {
    res = await httpJson<Api2Response>({
      baseUrl: API2.baseUrl,
      path: API2.path,
      query: { num: cadNumber, token: API2.token },
      rateKey: "API2",
      // Throttle => http.ts backoff bilan qayta uriniladi (fail deb yozilmaydi).
      shouldRetry: (d) => {
        const r = d as Api2Response | null;
        return r?.code === API2_THROTTLED_CODE || /throttl/i.test(r?.message ?? "");
      },
    });
  } catch (err) {
    if (err instanceof NotFoundError) return { ok: false, reason: "API2: obyekt topilmadi (404)" };
    throw err; // tarmoq/5xx — job xato bo'lib qayta urinadi
  }

  // Rate-limit => qayta urinish uchun xato tashlaymiz (fail deb yozmaymiz).
  if (res.code === API2_THROTTLED_CODE || /throttl/i.test(res.message ?? "")) {
    throw new Api2ThrottledError(`API2 rate-limit: [${res.code}] ${res.message ?? "throttled"}`);
  }

  if (res.code !== API2_SUCCESS_CODE) {
    return { ok: false, reason: `API2: [${res.code}] ${res.message ?? "noma'lum javob"}` };
  }

  // Egasi (balansdagi tashkilot) — subjects massivining birinchisi.
  const holder = res.subjects?.[0];

  return {
    ok: true,
    data: {
      cadNumber: str(res.cad_number) ?? cadNumber,
      cadNumberOld: str(res.cad_number_old), // "" => null
      name: str(res.name),
      address: str(res.address) ?? str(res.short_address),
      // area = yer uchastkasi maydoni, buildingArea = obyekt (bino) maydoni
      area: num(res.land_area),
      buildingArea: num(res.object_area),
      region: str(res.region),
      district: str(res.district),
      holderName: str(holder?.name),
      holderInn: str(holder?.inn),
      raw: res,
    },
  };
}
