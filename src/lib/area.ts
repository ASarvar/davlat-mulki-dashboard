/**
 * API 2 (UZKAD) javobidan maydonlarni o'qish — YAGONA joy.
 *
 * ⚠️ Ilgari bu mantiq ikki joyda alohida yozilgan edi (integratsiya parseri va obyekt
 * sahifasi), natijada ro'yxatdagi son bilan obyekt sahifasidagi son farq qilishi mumkin
 * edi. Yangi joyda maydon kerak bo'lsa SHU funksiyalarni chaqiring.
 */

/** Umumiy maydon olingan API 2 maydoni — yorliq shunga qarab o'zgaradi. */
export type AreaSource = "object_area_p" | "object_area" | "land_area" | "land_area_i";

/** "Binoning umumiy maydoni" zanjiri — tartib MUHIM (foydalanuvchi qoidasi). */
const TOTAL_AREA_CHAIN: AreaSource[] = ["object_area_p", "object_area", "land_area", "land_area_i"];

/**
 * Qiymat YER UCHASTKASI maydonidan olinganmi. Bunday holatda obyekt aslida bino emas,
 * shuning uchun UI'da "Binoning umumiy maydoni" emas, shunchaki "Umumiy maydoni" deyiladi.
 */
const LAND_SOURCES: ReadonlySet<AreaSource> = new Set<AreaSource>(["land_area", "land_area_i"]);

/** API 2 sonlari satr ham bo'lishi mumkin; 0 va bo'sh qiymat "yo'q" deb qaraladi. */
function positive(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * "Binoning umumiy maydoni" — zanjir bo'yicha (foydalanuvchi qoidasi, 2026-07-31):
 *   `object_area_p` → `object_area` → `land_area` → `land_area_i`
 *
 * ⚠️ **0 ham "qiymat yo'q"** hisoblanadi, `null` emas: jonli API bo'sh maydonni `0`
 * qilib qaytaradi. Shuning uchun oddiy `??` yetarli emas — `positive()` kerak.
 *
 * Qiymat bilan birga QAYSI maydondan olingani ham qaytadi — obyekt sahifasidagi
 * yorliq shunga bog'liq (`totalAreaLabel`).
 */
export function totalBuildingAreaWithSource(
  raw: Record<string, unknown> | null | undefined,
): { value: number; source: AreaSource } | null {
  if (!raw) return null;
  for (const source of TOTAL_AREA_CHAIN) {
    const value = positive(raw[source]);
    if (value != null) return { value, source };
  }
  return null;
}

/** Faqat son kerak bo'lganda (integratsiya parseri, backfill skripti). */
export function totalBuildingArea(raw: Record<string, unknown> | null | undefined): number | null {
  return totalBuildingAreaWithSource(raw)?.value ?? null;
}

/**
 * Obyekt sahifasidagi maydon yorlig'i. Qiymat yer uchastkasi maydonidan
 * (`land_area`/`land_area_i`) olingan bo'lsa "Binoning..." deyish noto'g'ri bo'lardi —
 * bunday obyekt aslida bino emas.
 */
export function totalAreaLabel(source: AreaSource | null | undefined): string {
  return source && LAND_SOURCES.has(source) ? "Umumiy maydoni" : "Binoning umumiy maydoni";
}

/**
 * "Foydali maydon" — `object_area_u`.
 * ⚠️ Bunga fallback zanjiri QO'LLANMAYDI (foydalanuvchi faqat umumiy maydon uchun
 * so'ragan). `vacantArea = foydali − ijarada` shu qiymatga tayanadi, shuning uchun
 * bu yerga fallback qo'shish dashboarddagi "bo'sh maydon" ustunlarini ham o'zgartiradi —
 * alohida qaror talab qiladi.
 */
export function usefulArea(raw: Record<string, unknown> | null | undefined): number | null {
  if (!raw) return null;
  return positive(raw.object_area_u);
}

/**
 * Yer uchastkasimi yoki bino — quyidagi 11 ta maydonning HAMMASI 0/bo'sh bo'lsa
 * YER (rost), aks holda BINO (yolg'on). Foydalanuvchi qoidasi, 2026-08-05.
 * `positive()` bilan bir xil "0 ham bo'sh" mezoni ishlatiladi.
 */
const LAND_CHECK_FIELDS = [
  "object_area",
  "object_area_l",
  "object_area_u",
  "object_area_legal",
  "object_area_bd",
  "object_area_nz",
  "object_area_p",
  "object_area_p_bd",
  "object_area_p_legal",
  "object_area_p_nz",
  "object_rooms",
] as const;

export function isLandOnly(raw: Record<string, unknown> | null | undefined): boolean {
  if (!raw) return false;
  return LAND_CHECK_FIELDS.every((f) => positive(raw[f]) == null);
}
