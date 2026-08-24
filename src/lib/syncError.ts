/**
 * Sinxronizatsiya xatolarini O'QILADIGAN ko'rinishga aylantiradi.
 *
 * Xom xabar `http.ts` → `labeled()` dan `"<RATE_KEY>: <xabar>"` shaklida keladi,
 * masalan `"API2: HTTP 500"`. Bu ikkalasi ham foydalanuvchi uchun tushunarsiz:
 * "API2" qaysi ma'lumot ekanini, "HTTP 500" esa nima bo'lganini aytmaydi
 * (foydalanuvchi shuni aytdi, 2026-08-24). Shu yerda ikkalasi ham o'zbekchaga
 * o'giriladi.
 *
 * ⚠️ Client komponentlarda ham ishlatiladi (`/dashboard/sync`), shuning uchun bu fayl
 * server-only narsalarni (`@/lib/env`, prisma, integrations) IMPORT QILMAYDI —
 * faqat sof satr mantiqi.
 */

/** `rateKey` → foydalanuvchi ko'radigan nom. Kalitlar `integrations/*.ts` bilan bir xil. */
const API_LABEL: Record<string, string> = {
  API1: "API 1 — STIR bo'yicha kadastrlar ro'yxati",
  API2: "API 2 — kadastr asosiy ma'lumoti",
  API3: "API 3 — auksion (obyekt)",
  API4: "API 4 — auksion (lot tafsiloti)",
  API5: "API 5 — ijara shartnomalari",
  API6: "API 6 — ijara loti",
  UTIL_WATER: "Suv (Suvsoz)",
  UTIL_GAS: "Gaz (Hududgaz)",
  UTIL_ELECTRIC: "Elektr (HET)",
  UTIL_ELECTRIC_DETAIL: "Elektr tafsiloti (HET 2-bosqich)",
};

export interface SyncErrorInfo {
  /** Xom prefiks ("API2") — guruhlash kaliti. Prefiks bo'lmasa `null`. */
  key: string | null;
  /** Qaysi API — o'zbekcha to'liq nom. */
  apiLabel: string;
  /** Xato NIMA ekani — o'zbekcha tushuntirish. */
  reason: string;
  /** Muammo bizning tomondami yoki tashqi API tomonidami. */
  blame: "external" | "network" | "config" | "data" | "unknown";
  /** Xom xabar — admin uchun texnik tafsilot. */
  raw: string;
}

const PREFIX_RE = /^([A-Z0-9_]+):\s*/;

/**
 * Xato sababini aniqlaydi. Tartib MUHIM — aniqroq naqshlar yuqorida turadi
 * (masalan "Avtorizatsiya rad etildi (HTTP 403)" umumiy HTTP qoidasidan oldin).
 */
function explain(message: string): Pick<SyncErrorInfo, "reason" | "blame"> {
  const m = message.toLowerCase();

  if (/avtorizatsiya rad etildi/.test(m)) {
    return {
      reason: "Login yoki parol noto'g'ri — API kirish ma'lumotlarini tekshirish kerak",
      blame: "config",
    };
  }
  if (/sozlanmagan/.test(m)) {
    return { reason: "API manzili sozlanmagan (.env faylida yo'q)", blame: "config" };
  }
  if (/rate-limit|throttl|so'rovlar chegarasi/.test(m)) {
    return {
      reason: "So'rovlar chegarasiga yetildi (rate-limit) — API bir vaqtda ko'p so'rovni qabul qilmadi",
      blame: "external",
    };
  }
  if (/kadastr raqami topilmadi|topilmadi \(404\)/.test(m)) {
    return { reason: "Bu kadastr raqami tashqi bazada topilmadi", blame: "data" };
  }
  if (/abort|timeout|vaqt tugadi/.test(m)) {
    return {
      reason: "Javob kutish vaqti tugadi — API juda sekin javob berdi yoki umuman javob bermadi",
      blame: "external",
    };
  }
  if (/fetch failed|econnrefused|enotfound|ehostunreach|etimedout|socket|network/.test(m)) {
    return {
      reason: "Serverga umuman ulanib bo'lmadi — tarmoq uzilgan yoki API manzili ochiq emas (VPN/ichki tarmoqni tekshiring)",
      blame: "network",
    };
  }

  const http = message.match(/HTTP (\d{3})/);
  if (http) {
    const code = Number(http[1]);
    if (code >= 500) {
      return {
        reason: `Tashqi API serverida ichki xato (HTTP ${code}) — muammo API tomonida, bizning tizimda emas`,
        blame: "external",
      };
    }
    if (code === 429) {
      return { reason: "So'rovlar chegarasiga yetildi (HTTP 429)", blame: "external" };
    }
    return { reason: `API so'rovni qabul qilmadi (HTTP ${code})`, blame: "external" };
  }

  if (/vaqtinchalik xato \(body\)/.test(m)) {
    return { reason: "API vaqtinchalik xato qaytardi va qayta urinishlar ham yordam bermadi", blame: "external" };
  }

  return { reason: message, blame: "unknown" };
}

export function describeSyncError(raw: string | null | undefined): SyncErrorInfo | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const key = trimmed.match(PREFIX_RE)?.[1] ?? null;
  const rest = key ? trimmed.replace(PREFIX_RE, "") : trimmed;

  return {
    key,
    // ⚠️ Prefiks bor, lekin xaritada yo'q bo'lsa (masalan yangi API qo'shilgan, lekin
    // bu yerga yozilmagan) — prefiksning o'zi ko'rsatiladi, "Noma'lum" emas.
    apiLabel: key ? (API_LABEL[key] ?? key) : "Qaysi API ekani aniqlanmadi",
    ...explain(rest),
    raw: trimmed,
  };
}

/** Muammo kimning tomonidan — qisqa yorliq (UI ranglari uchun ham ishlatiladi). */
export const BLAME_LABEL: Record<SyncErrorInfo["blame"], string> = {
  external: "Tashqi API tomonida",
  network: "Tarmoq / ulanish",
  config: "Sozlama",
  data: "Ma'lumot",
  unknown: "Aniqlanmadi",
};
