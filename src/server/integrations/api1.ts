import { API1 } from "./config";
import { httpJson } from "./http";

// API 1 ning HAQIQIY javob shakli.
// Muvaffaqiyatli javob: code === 1.
export interface Api1Response {
  response_id: number;
  code: number;
  message: string;
  pinfl: string | null;
  inn: string; // so'ralgan STIR (echo)
  cadastr_count: number;
  cadastr_list: string[] | null;
}

export class Api1Error extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
    this.name = "Api1Error";
  }
}

const API1_SUCCESS_CODE = 1;

// API 1: hududiy boshqarma STIR'i (inn) orqali barcha kadastr raqamlarini oladi.
// Token TALAB QILINMAYDI.
export async function fetchCadastresByStir(stir: string): Promise<string[]> {
  if (!API1.baseUrl) throw new Error("API1_BASE_URL sozlanmagan");

  const res = await httpJson<Api1Response>({
    baseUrl: API1.baseUrl,
    path: API1.path,
    // Parametr nomi `num` (jonli API'da tasdiqlangan). Javobda u `inn` bo'lib qaytadi.
    query: { num: stir },
    rateKey: "API1",
  });

  // code !== 1 => xato/ma'lumot yo'q. Xabarni yuqoriga uzatamiz (job log'ida ko'rinadi).
  if (res.code !== API1_SUCCESS_CODE) {
    throw new Api1Error(res.code, `API1 (STIR ${stir}): [${res.code}] ${res.message ?? "noma'lum xato"}`);
  }

  const list = res.cadastr_list ?? [];
  // Kadastr raqamlari `10:11:01:01:01:5030/03` ko'rinishida — trim + dublikatlarni olib tashlaymiz.
  const cadastres = [...new Set(list.map((c) => String(c).trim()).filter(Boolean))];

  // Ma'lumot butunligi signali: API o'zi bergan son bilan solishtiramiz.
  if (typeof res.cadastr_count === "number" && res.cadastr_count !== cadastres.length) {
    console.warn(
      `[API1] STIR ${stir}: cadastr_count=${res.cadastr_count}, lekin ro'yxatda ${cadastres.length} ta noyob kadastr`,
    );
  }

  return cadastres;
}
