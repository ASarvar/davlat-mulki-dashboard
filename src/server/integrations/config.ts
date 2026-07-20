import { env } from "@/lib/env";
import type { StatusApiSource } from "./types";

// Holat-API'lar konfiguratsiyasi (kodga hardcode QILINMAYDI — env'dan).
// impliesCategoryCode: agar bu tekshiruv ijobiy bo'lsa, qaysi INTEGRATSIYA
// kategoriyasini (1–4) bildiradi.
//
// ⚠️ Kategoriya-mapping biznes qoidasi — real API semantikasiga qarab TASDIQLANSIN.
export interface StatusApiConfig {
  source: StatusApiSource;
  baseUrl?: string;
  token?: string;
  label: string;
  impliesCategoryCode: number | null;
}

// Placeholder/sozlanmagan manzilni aniqlaymiz. MUHIM: placeholder host 404 qaytarsa,
// kod uni "topilmadi" deb qabul qilib, har bir obyektga soxta tekshiruv yozuvi yozardi
// va obyekt noto'g'ri "kategoriyasiz" bo'lib qolardi. Shuning uchun bunday API'lar
// umuman chaqirilmaydi — real manzil kiritilgach o'zi ishga tushadi.
function isConfigured(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return !new URL(url).hostname.startsWith("example.");
  } catch {
    return false;
  }
}

const ALL_STATUS_APIS: StatusApiConfig[] = [
  { source: "API3", baseUrl: env.API3_BASE_URL, token: env.API_STATUS_TOKEN, label: "Bo'lib to'lash bilan sotilgan", impliesCategoryCode: 1 },
  { source: "API4", baseUrl: env.API4_BASE_URL, token: env.API_STATUS_TOKEN, label: "Sotilgan (hujjat rasmiylashtirilmagan)", impliesCategoryCode: 2 },
  { source: "API5", baseUrl: env.API5_BASE_URL, token: env.API_STATUS_TOKEN, label: "Beg'araz foydalanish", impliesCategoryCode: 3 },
  { source: "API6", baseUrl: env.API6_BASE_URL, token: env.API_STATUS_TOKEN, label: "Savdoda turgan (xususiylashtirish/ijara)", impliesCategoryCode: 4 },
  { source: "API7", baseUrl: env.API7_BASE_URL, token: env.API_STATUS_TOKEN, label: "Nol qiymatli ijara", impliesCategoryCode: null },
  { source: "API8", baseUrl: env.API8_BASE_URL, token: env.API_STATUS_TOKEN, label: "Qo'shimcha holat tekshiruvi", impliesCategoryCode: null },
];

// Faqat haqiqatan sozlangan holat-API'lar. Bo'sh bo'lsa — status-check bosqichi
// tekshiruvsiz o'tadi (obyekt kategoriyasiz qoladi, qo'lda biriktirish kutiladi).
export const STATUS_APIS: StatusApiConfig[] = ALL_STATUS_APIS.filter((a) => isConfigured(a.baseUrl));

// API 1 — token TALAB QILMAYDI. Endpoint yo'li env orqali sozlanadi (API1_PATH),
// so'rov: GET {API1_BASE_URL}/{API1_PATH}?inn={STIR}
export const API1 = { baseUrl: env.API1_BASE_URL, path: env.API1_PATH };
// API 2 — token QUERY parametr sifatida uzatiladi (?num=...&token=...), headerda emas.
export const API2 = { baseUrl: env.API2_BASE_URL, path: env.API2_PATH, token: env.API2_TOKEN };
