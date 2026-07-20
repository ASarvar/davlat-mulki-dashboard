import type { StatusApiCall, StatusCheckResult } from "./types";

export interface FallbackResult extends StatusCheckResult {
  matchedByOldCad: boolean; // natija eski kadastr orqali olindimi
  usedCadNumber: string | null; // qaysi kadastr bilan topildi
}

// Fallback mexanizmi (talab #3):
// 1) Avval YANGI kadastr bilan tekshiramiz.
// 2) Agar topilmasa (404/bo'sh/xato) VA eski kadastr mavjud bo'lsa,
//    ESKI kadastr bilan qayta tekshiramiz.
// Natijaning izini (matchedByOldCad) saqlaymiz — ObjectStatusCheck'ga yoziladi.
export async function callWithCadFallback(
  call: StatusApiCall,
  cadNumber: string,
  cadNumberOld: string | null,
): Promise<FallbackResult> {
  // 1-urinish: yangi kadastr
  const primary = await safeCall(call, cadNumber);
  if (primary.found) {
    return { ...primary, matchedByOldCad: false, usedCadNumber: cadNumber };
  }

  // 2-urinish (fallback): eski kadastr
  if (cadNumberOld && cadNumberOld !== cadNumber) {
    const fallback = await safeCall(call, cadNumberOld);
    if (fallback.found) {
      return { ...fallback, matchedByOldCad: true, usedCadNumber: cadNumberOld };
    }
  }

  return { found: false, status: null, impliesCategoryCode: null, raw: null, matchedByOldCad: false, usedCadNumber: null };
}

// Kutilmagan xatoni "topilmadi" ga aylantirmaymiz — retry http darajasida bo'lgan,
// bu yerda xato yuqoriga chiqadi (job "failed" bo'lib qayta navbatga tushadi).
// Faqat toza natijani qaytaramiz.
async function safeCall(call: StatusApiCall, cad: string): Promise<StatusCheckResult> {
  return call(cad);
}
