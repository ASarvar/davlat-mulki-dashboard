/**
 * Kadastr javobidan maydonlarni o'qish — YAGONA joy.
 *
 * ⚠️ Ilgari bu mantiq ikki joyda alohida yozilgan edi (integratsiya parseri va obyekt
 * sahifasi), natijada ro'yxatdagi son bilan obyekt sahifasidagi son farq qilishi mumkin
 * edi. Yangi joyda maydon kerak bo'lsa SHU funksiyalarni chaqiring.
 *
 * ⚠️ **IKKI SHAKL qo'llab-quvvatlanadi** (2026-09-06):
 *   - ESKI (API 2 / UZKAD) — yassi: `object_area_p`, `object_area_u`, `land_area`…
 *   - YANGI (`cad_data`)   — ichma-ich: `object.object_pl_obfull`, `land.area`…
 *
 * To'liq qayta sinxronizatsiyadan keyin ham eski shakl YO'QOLMAYDI: yangi API
 * obyektlarning ~2.5% iga `404`/`400` qaytaradi va ularning `rawApi2` si eski
 * holicha qoladi. Shuning uchun shakl aniqlash vaqtinchalik emas, DOIMIY.
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

/** Yangi (`cad_data`) shaklining ichki bloklari. */
interface NewShape {
  object?: Record<string, unknown>;
  land?: Record<string, unknown>;
}

/**
 * Javob YANGI shakldami. Belgisi — `object`/`land` ning OBYEKT bo'lishi:
 * eski shaklda bu nomlar umuman yo'q (u yerda `object_area*` / `land_area*` yassi sonlar).
 */
function asNewShape(raw: Record<string, unknown> | null | undefined): NewShape | null {
  if (!raw) return null;
  const obj = raw.object;
  const land = raw.land;
  const isObj = (v: unknown) => typeof v === "object" && v !== null && !Array.isArray(v);
  if (!isObj(obj) && !isObj(land)) return null;
  return {
    object: isObj(obj) ? (obj as Record<string, unknown>) : undefined,
    land: isObj(land) ? (land as Record<string, unknown>) : undefined,
  };
}

/**
 * Yangi shaklni ESKI maydon nomlariga o'giradi — shundan keyin quyidagi butun
 * mantiq (zanjir, yorliq, foydali maydon) ikkala shakl uchun ham o'zgarishsiz ishlaydi.
 *
 * Moslik jonli ma'lumotda tekshirilgan (117 obyekt): umumiy maydon 100%, tuman kodi
 * 100%, eski kadastr 100% mos keldi.
 *
 * ⚠️ `land.area_z`/`area_b` MAPPING QILINMAYDI — ularning ma'nosi jonli javobda
 * hujjatlashtirilmagan, xuddi eski shakldagi `_i`/`_b`/`_z` suffikslari kabi.
 * Taxmin qilib zanjirga qo'shish maydon qiymatini jimgina o'zgartirib yuborardi.
 */
function normalize(raw: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  const n = asNewShape(raw);
  if (!n) return raw; // eski shakl — o'z holicha

  const o = n.object ?? {};
  const l = n.land ?? {};
  return {
    // Umumiy maydon zanjiri: bino → inshoot → yer
    object_area_p: o.object_pl_obfull,
    object_area: o.pl_obzd,
    land_area: l.area,
    land_area_i: l.area_u,
    // Foydali maydon
    object_area_u: o.object_pl_polezfull ?? o.pl_polezzd,
    // Yer/bino mezoni uchun
    object_rooms: o.rooms,
  };
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
  const flat = normalize(raw);
  if (!flat) return null;
  for (const source of TOTAL_AREA_CHAIN) {
    const value = positive(flat[source]);
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
  const flat = normalize(raw);
  return flat ? positive(flat.object_area_u) : null;
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

/** O'sha mezonning YANGI shakldagi ko'rinishi — `object` blokining barcha maydonlari. */
const NEW_LAND_CHECK_FIELDS = [
  "object_pl_obfull",
  "object_pl_polezfull",
  "pl_obzd",
  "pl_polezzd",
  "pl_obsoor",
  "pl_polezsoor",
  "rooms",
] as const;

export function isLandOnly(raw: Record<string, unknown> | null | undefined): boolean {
  if (!raw) return false;

  // ⚠️ Yangi shaklda `normalize()` dan O'TKAZILMAYDI: u zanjir uchun kerakli
  // maydonlarnigina beradi, bu yerda esa `object` blokining BUTUNLAY bo'shligi
  // tekshiriladi — inshoot maydonlari (`pl_obsoor`) ham hisobga olinishi shart,
  // aks holda inshooti bor uchastka "yer" deb belgilanib qolardi.
  const n = asNewShape(raw);
  if (n) {
    const o = n.object ?? {};
    return NEW_LAND_CHECK_FIELDS.every((f) => positive(o[f]) == null);
  }
  return LAND_CHECK_FIELDS.every((f) => positive(raw[f]) == null);
}
