/**
 * Grafik va xarita palitrasi.
 *
 * ⚠️ TS konstanta, CSS o'zgaruvchisi EMAS — ataylab. Recharts ranglarni JS string
 * sifatida kutadi (legenda/tooltip kvadratchalari `var(--x)` bilan buziladi), Leaflet
 * `circleMarker({ color })` hisoblangan qiymat kutadi, klaster rangi esa kod ichida
 * tanlanadi. Shu sabab brend hex'lari `globals.css` dan TAKRORLANADI.
 *
 * ⚠️ IKKALASINI BIRGA O'ZGARTIRING: `globals.css` → `:root` va shu fayl
 * (`basePath.ts` ↔ `next.config.mjs` naqshi).
 */
export const BRAND = {
  navy: "#07102b",
  navyMid: "#0d1e45",
  cobalt: "#1a3a7c",
  gold: "#c8a96e",
  goldLight: "#e8d5a8",
  goldLighter: "#f7f1e4",
} as const;

/** Neytral kulranglar — o'q, to'r va yordamchi matn uchun. */
export const NEUTRAL = {
  grid: "#eef2f7",
  axis: "#94a3b8",
  text: "#334155",
  muted: "#64748b",
} as const;

/**
 * Kategoriya ranglari — SEMANTIK guruhlar, kamalak emas:
 *   yashil  = yakuniy holat (sotilgan)
 *   kobalt  = savdoda
 *   moviy   = foydalanilmoqda (ijara/tekin)
 *   kulrang = chetlangan (yaroqsiz/chekka)
 *   OLTIN   = bo'sh turgan — ekranda oltin qancha ko'p bo'lsa, muammo shuncha katta
 *
 * ⚠️ Kod 8 mavjud emas (`categories.ts` da izohga olingan), shuning uchun rang
 * xaritasi `1..12` sikli bilan QURILMAYDI — `CATEGORIES` massivi ustidan yuriladi.
 * ⚠️ 11 va 12 oltinlari yaqin — donut'da rangga TAYANMANG, to'g'ridan-to'g'ri yorliq qo'ying.
 */
export const CATEGORY_COLOR: Record<number, string> = {
  1: "#2e7d5b",
  2: "#57a586",
  3: BRAND.cobalt,
  4: "#3b5fa8",
  5: "#4a90a4",
  6: "#2c6e8a",
  7: "#8095cb",
  9: "#94a3b8",
  10: "#b6c0cd",
  11: BRAND.gold,
  12: BRAND.goldLight,
};

/** Registrda yo'q kod uchun zaxira rang — grafik rangsiz qolmasin. */
export const FALLBACK_COLOR = "#cbd5e1";

export function categoryColor(code: number): string {
  return CATEGORY_COLOR[code] ?? FALLBACK_COLOR;
}
