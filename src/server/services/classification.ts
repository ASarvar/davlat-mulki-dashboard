import type { FallbackResult } from "@/server/integrations/withCadFallback";
import type { StatusApiSource } from "@/server/integrations/types";

export interface StatusResultBySource extends FallbackResult {
  source: StatusApiSource;
}

// Samaradorlik hisobidan CHIQARILADIGAN kodlar (excludeInefficient=true).
// 9–10 (bo'sh turgan) va kategoriyasizlar => SAMARASIZ.
// Bu ro'yxat Category jadvali bilan mos (seed) — tezkorlik uchun konstanta.
// 1–10 chiqariladi; 11–12 (bo'sh turgan) va kategoriyasizlar => SAMARASIZ.
export const EXCLUDED_CATEGORY_CODES: ReadonlySet<number> = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

export const CAT_INSTALLMENT_SOLD = 1; // Sotilgan (bo'lib to'lash sharti bilan)
export const CAT_SOLD = 2; // Sotilgan
export const CAT_ON_AUCTION = 3; // Savdoda xususiylashtirish
export const CAT_ON_AUCTION_RENT = 4; // Savdoda ijara
export const CAT_FREE_USE = 5; // Tekin foydalanish (ijara shartnomasi summasi 0)
export const CAT_HAS_RENT = 6; // Ijara shartnomasi bor
export const CAT_PRE_AUCTION = 7; // Savdoga chiqarish jarayonida (qo'lda ham, API 3 ham)
export const CAT_VACANT = 11; // Bo'sh turgan — hech qanday integratsiya kategoriyasi topilmasa
export const CAT_HAS_VACANT_AREA = 12; // Bo'sh turgan maydoni mavjud

/** API 4 dagi `group_name` shu bo'lsa — savdo IJARA uchun, aks holda xususiylashtirish. */
export const AUCTION_GROUP_RENT = "Davlat mulkini ijaraga berish";

/**
 * API 3 `status_name` — savdoga tayyorgarlik bosqichlari (kirillcha keladi).
 * Bu holatda lot hali yaratilmagan, shuning uchun obyekt 7-kategoriyaga tushadi.
 */
export const PRE_AUCTION_STATUSES: ReadonlySet<string> = new Set([
  "Экспертиза",
  "Баҳолашда",
  "Хатловда",
]);

// Auksion (API 3+4) natijasidan integratsiya kategoriyasini aniqlaydi.
//   order_statuses_id === 6 => SOTILGAN
//     - order.term_payment === 1 => 1 (bo'lib to'lash sharti bilan sotilgan)
//     - aks holda                => 2 (sotilgan)
//   DIQQAT: mezon `term_payment`, details'dagi "tulov_muddati" EMAS —
//   u bo'lib to'lash bo'lsa ham "" bo'lishi mumkin (foydalanuvchi aniqlagan).
//   Sotilmagan, lekin HAQIQIY lot mavjud => 4 (savdoda turgan)
//
// MUHIM: API 3 obyektni "topdim" (success=true) desa ham, lot_number/order_id null
// bo'lishi mumkin — masalan status_name="Муаммоли". Bunday obyekt savdoda EMAS,
// shuning uchun unga kategoriya bermaymiz (qo'lda ko'rib chiqiladi).
export function deriveAuctionCategory(a: {
  found: boolean;
  isSold: boolean;
  termPayment: number | null;
  lotNumber: string | null;
  groupName: string | null;
  /** API 3 dagi xom `status_name` (lot yaratilgunga qadar shu yagona signal). */
  assetStatus?: string | null;
  /** API 6 da faol ijara loti topilganmi — "Savdoda ijara"ning ASOSIY mezoni. */
  hasRentLot?: boolean;
}): number | null {
  if (a.isSold) {
    return a.termPayment === 1 ? CAT_INSTALLMENT_SOLD : CAT_SOLD;
  }
  // Ijara savdosi (API 6) — API 3/4 bu lotni umuman ko'rmasligi mumkin,
  // shuning uchun `found` shartidan oldin tekshiriladi.
  if (a.hasRentLot) return CAT_ON_AUCTION_RENT;

  if (!a.found) return null;
  // Savdoda turgan (xususiylashtirish). `group_name` real ma'lumotda hech qachon
  // "ijaraga berish" bo'lmagan — ijara endi API 6 orqali aniqlanadi.
  if (a.lotNumber) {
    return a.groupName === AUCTION_GROUP_RENT ? CAT_ON_AUCTION_RENT : CAT_ON_AUCTION;
  }
  // Lot yo'q, lekin savdoga tayyorgarlik bosqichida (ekspertiza/baholash/xatlov).
  if (a.assetStatus && PRE_AUCTION_STATUSES.has(a.assetStatus.trim())) return CAT_PRE_AUCTION;
  return null;
}

// API 5 (ijara shartnomalari) natijasidan kategoriya.
//   shartnoma bor + jami summa 0  => 3  (Tekin foydalanish)
//   shartnoma bor + summa > 0     => 11 (Ijara shartnomasi bor)
export function deriveRentCategory(r: { found: boolean; totalSum: number }): number | null {
  if (!r.found) return null;
  return r.totalSum === 0 ? CAT_FREE_USE : CAT_HAS_RENT;
}

// API 3–8 natijalaridan integratsiya kategoriyasini (1–4) aniqlaydi.
// Bir nechta tekshiruv ijobiy bo'lsa — eng kichik kod (eng yuqori ustuvorlik) tanlanadi.
export function deriveIntegrationCategory(results: StatusResultBySource[]): number | null {
  const codes = results
    .filter((r) => r.found && r.impliesCategoryCode != null)
    .map((r) => r.impliesCategoryCode as number);
  if (codes.length === 0) return null;
  return Math.min(...codes);
}

// Obyekt samarasiz foydalanilayotganmi?
// Ustuvorlik: integratsiya (1–4) > qo'lda (5–10). 1–8 => samarali (chiqariladi),
// 9–10 yoki kategoriyasiz => SAMARASIZ.
export function computeIsInefficient(
  integrationCategoryCode: number | null,
  manualCategoryCode: number | null,
): boolean {
  const effective = integrationCategoryCode ?? manualCategoryCode;
  if (effective == null) return true; // hali kategoriyalanmagan => samarasiz nomzod
  return !EXCLUDED_CATEGORY_CODES.has(effective);
}
