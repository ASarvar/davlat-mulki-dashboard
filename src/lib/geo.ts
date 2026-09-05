/**
 * Koordinata bilan ishlashning YAGONA joyi (`lib/area.ts` naqshi).
 *
 * ⚠️ Validatsiya SHU YERDA: `pickAuctionCoords()` dan o'tmagan qiymat bazaga
 * umuman yetib bormaydi. Aks holda API'ning `0`/`null`/matn qiymatlari xaritada
 * Afrika sohilidagi nuqta bo'lib chiqardi.
 */

/** O'zbekiston chegaralari (kenglik/uzunlik) — zaxira bilan biroz kengaytirilgan. */
const LAT_MIN = 37;
const LAT_MAX = 46;
const LNG_MIN = 55;
const LNG_MAX = 74;

/** Son yoki satrni koordinataga aylantiradi. `0` ham YAROQSIZ (API bo'sh qiymatni shunday beradi). */
export function parseCoord(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}

export function isInUzbekistan(lat: number, lng: number): boolean {
  return lat >= LAT_MIN && lat <= LAT_MAX && lng >= LNG_MIN && lng <= LNG_MAX;
}

export interface Coords {
  lat: number;
  lng: number;
}

/**
 * API 4 (`order`) javobidan koordinata. Chegaradan tashqarida bo'lsa `null` —
 * "koordinata yo'q" deb qaraladi, tasodifiy nuqta xaritaga tushmaydi.
 */
export function pickAuctionCoords(raw: unknown): Coords | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const lat = parseCoord(o.lat);
  const lng = parseCoord(o.lng);
  if (lat == null || lng == null) return null;
  if (!isInUzbekistan(lat, lng)) return null;
  return { lat, lng };
}

/**
 * Hudud markazlari — "Hududlar" rejimidagi pufakchalar uchun.
 *
 * ⚠️ Kalit — `Region.cadastrePrefix` ("10".."23"), `Region.code` EMAS: `code`
 * "TAS"/"SAM" ko'rinishidagi qisqartma, prefiks esa kadastr raqamidan keladi,
 * unique va 2419 ta jonli obyektda tasdiqlangan.
 * ⚠️ Yangi hudud qo'shilib, bu yerda markazi bo'lmasa pufakcha JIMGINA
 * yo'qolmasin — chaqiruvchi zaxira sifatida o'sha hududdagi nuqtalar
 * o'rtachasini ishlatadi.
 */
export const REGION_CENTER: Record<string, Coords> = {
  "10": { lat: 41.2995, lng: 69.2401 }, // Toshkent sh.
  "11": { lat: 41.0, lng: 69.6 }, // Toshkent v.
  "12": { lat: 40.4897, lng: 68.7842 }, // Sirdaryo
  "13": { lat: 40.1158, lng: 67.842 }, // Jizzax
  "14": { lat: 39.627, lng: 66.975 }, // Samarqand
  "15": { lat: 40.3864, lng: 71.7864 }, // Farg'ona
  "16": { lat: 40.9983, lng: 71.6726 }, // Namangan
  "17": { lat: 40.7821, lng: 72.3442 }, // Andijon
  "18": { lat: 38.8606, lng: 65.7891 }, // Qashqadaryo
  "19": { lat: 37.9409, lng: 67.5709 }, // Surxondaryo
  "20": { lat: 39.7747, lng: 64.4286 }, // Buxoro
  "21": { lat: 40.1039, lng: 65.3733 }, // Navoiy
  "22": { lat: 41.55, lng: 60.6333 }, // Xorazm
  "23": { lat: 42.4531, lng: 59.6103 }, // Qoraqalpog'iston R.
};

/** Xaritaning boshlang'ich markazi — butun mamlakat ko'rinsin. */
export const UZ_CENTER: Coords = { lat: 41.4, lng: 64.2 };
export const UZ_ZOOM = 6;
