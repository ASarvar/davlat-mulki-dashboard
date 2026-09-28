/**
 * "Balansga olingan sana" — kadastrdagi HUQUQ ro'yxatdan o'tgan sana (2026-09-28).
 *
 * Manba: `cad_data` javobidagi `land.legal[].date` va `outer[].legal[].date`
 * (masalan "Doimiy foydalanish" huquqi, 2026-08-24). Bir nechta yozuv bo'lsa ENG
 * OXIRGISI olinadi — joriy egasining huquqi.
 *
 * ⚠️ `Property.createdAt` EMAS: u tizim obyektni birinchi marta KO'RGAN kun va
 * sinxronizatsiyaga bog'liq. Jonli o'lchov: sentyabrda "yaratilgan" 241 obyektdan
 * 185 tasining huquqi ancha oldin ro'yxatdan o'tgan (yangi manba qo'shilgani uchun
 * endi topilgan) — KPI uchun yolg'on raqam berardi.
 *
 * ⚠️ Tashkilotlar orasida o'tkazilganda huquq QAYTA ro'yxatdan o'tadi va sana
 * yangilanadi — bu qabul qiluvchi tashkilot uchun haqiqatan "balansga olish".
 *
 * ⚠️ Eski API 2 shaklida (`land`/`outer` yo'q) sana yo'q → `null`.
 * ⚠️ Mantiq migratsiyadagi SQL bilan AYNAN bir xil
 * (`20260928120000_property_balance_date`): noto'g'ri sana tashlab yuboriladi, qolganlarining eng kattasi.
 */
export function balanceRegDate(raw: unknown): Date | null {
  if (!isObj(raw)) return null;
  const legals: unknown[] = [];
  const land = raw.land;
  if (isObj(land) && Array.isArray(land.legal)) legals.push(...land.legal);
  if (Array.isArray(raw.outer)) {
    for (const o of raw.outer) if (isObj(o) && Array.isArray(o.legal)) legals.push(...o.legal);
  }

  let max: Date | null = null;
  for (const l of legals) {
    const d = isObj(l) ? parseIsoDay(l.date) : null;
    if (d && (!max || d > max)) max = d;
  }
  return max;
}

/**
 * `"YYYY-MM-DD..."` → UTC yarim tun. Mavjud bo'lmagan sana (`2026-02-30`) — `null`
 * (`Date.UTC` uni jimgina 2-martga aylantirardi; SQL `::date` esa xato beradi).
 */
export function parseIsoDay(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date : null;
}

/** `Date` (UTC yarim tun) → `"YYYY-MM-DD"`. */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** `Date` (UTC yarim tun) → `"28.09.2026"` — server va brauzerda bir xil (locale'ga bog'liq emas). */
export function dmy(d: Date): string {
  const [y, m, day] = isoDay(d).split("-");
  return `${day}.${m}.${y}`;
}

/** `"YYYY-MM"` → oyning birinchi va oxirgi kuni (`"YYYY-MM-DD"`). Noto'g'ri qiymat — `null`. */
export function monthRange(ym: string | undefined): { from: string; to: string } | null {
  const m = ym ? /^(\d{4})-(\d{2})$/.exec(ym) : null;
  if (!m) return null;
  const [y, mo] = [Number(m[1]), Number(m[2])];
  if (mo < 1 || mo > 12) return null;
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return { from: `${m[1]}-${m[2]}-01`, to: `${m[1]}-${m[2]}-${String(last).padStart(2, "0")}` };
}

/** Joriy oy (`"YYYY-MM"`) — Toshkent vaqti bo'yicha (server UTC'da ishlaydi). */
export function currentMonthTashkent(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit" })
    .format(now)
    .slice(0, 7);
}

const MONTHS_UZ = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
];

/** `"2026-09"` → `"Sentyabr 2026"`. */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTHS_UZ[Number(m) - 1] ?? m} ${y}`;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
