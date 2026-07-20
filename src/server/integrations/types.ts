// Tashqi API integratsiyalari uchun umumiy tiplar.

// API 2 dan keladigan obyektning asosiy ma'lumotlari.
// MUHIM: cadNumberOld (eski kadastr) — fallback uchun majburiy saqlanadi.
export interface PropertyBaseData {
  cadNumber: string;
  cadNumberOld: string | null;
  name?: string | null;
  address?: string | null;
  area?: number | null; // yer uchastkasi maydoni (land_area)
  buildingArea?: number | null; // obyekt/bino maydoni (object_area)
  // Qo'shimcha ma'lumotlar — hozircha rawApi2 ichida saqlanadi,
  // ustun sifatida qo'shilsa shu maydonlardan foydalaniladi.
  region?: string | null;
  district?: string | null;
  holderName?: string | null; // balansdagi tashkilot (subjects[0].name)
  holderInn?: string | null; // uning STIR'i (subjects[0].inn)
  raw: unknown;
}

// API 3–8 (holat tekshiruvi) natijasi.
export interface StatusCheckResult {
  found: boolean; // ma'lumot topildimi (404/bo'sh => false)
  status?: string | null; // API qaytargan holat matni
  // Agar bu tekshiruv 1–4 integratsiya kategoriyasini bildirsa — kod.
  impliesCategoryCode?: number | null;
  raw?: unknown;
}

// Bitta holat-API mijozi: kadastr (yangi yoki eski) bo'yicha tekshiradi.
export type StatusApiCall = (cadNumber: string) => Promise<StatusCheckResult>;

// API manba identifikatori (ObjectStatusCheck.apiSource bilan mos).
export type StatusApiSource = "API3" | "API4" | "API5" | "API6" | "API7" | "API8";
