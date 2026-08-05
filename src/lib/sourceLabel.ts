/** Soha nomi — respublika darajasidagi yorliq shunga qarab farqlanadi. */
export const SOHA_DIREKSIYA = "Direksiya";

/** Soha nomi — Yer/Bino ajratish shu ikkalasi uchun dashboard jadvalida ko'rsatiladi. */
export const SOHA_AKTIVLAR = "Davlat aktivlari agentligi";

/**
 * Dashboard jadvalida Yer/Bino ajratilgan ustun ko'rinishi FAQAT shu ikki soha
 * tanlanganda ishlaydi (Ijara markazi va "Hammasi" — o'zgarmagan ko'rinishda qoladi).
 * `stats.ts` (buildDashboardColumns varianti + qimmat qo'shimcha so'rov), dashboard
 * sahifasi va Excel eksporti UCHALASI ham shu bitta funksiyani chaqiradi.
 */
export function isLandSplitSoha(sohaName: string | undefined): boolean {
  return sohaName === SOHA_AKTIVLAR || sohaName === SOHA_DIREKSIYA;
}

/**
 * Tashkilotning ro'yxatlarda ko'rinadigan QISQA nomi (to'liq `orgName` emas).
 * Hududiy tashkilot uchun hudud nomi yetarli va qisqa; respublika darajasidagilar
 * (`OrganizationSource.regionId = null`) soha turiga qarab belgilanadi —
 * "Direksiya" → "Respublika", qolganlari → "Markaziy apparat" (foydalanuvchi talabi).
 *
 * ⚠️ Bu qoida ilgari 5 joyda (obyektlar filtri, manbalar jadvali, foydalanuvchilar
 * sahifasi va tanlagichi) alohida yozilgan edi — bittasi o'zgarsa qolganlari eskirib
 * qolardi. Yangi joyda kerak bo'lsa SHU funksiyani chaqiring, qoidani takrorlamang.
 */
export function sourceScopeLabel(sohaName: string, regionName: string | null | undefined): string {
  if (regionName) return regionName;
  return sohaName === SOHA_DIREKSIYA ? "Respublika" : "Markaziy apparat";
}
