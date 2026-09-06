/**
 * Auksion akkaunt kodi → viloyatning to'liq nomi.
 *
 * ⚠️ `.env.auction` dagi `name` maydoni QISQARTMA (QR, AND, TOSH-SH …) — u
 * so'rov yuborish uchun kalit, ekranda ko'rsatish uchun emas. Nomlar
 * `AuctionOrder.region` maydonidan olingan (68 196 yozuv bo'yicha eng ko'p
 * uchraydigan qiymat, 2026-09-07) — ya'ni auksion tizimining O'ZI yozgan nom.
 *
 * ⚠️ Bu `Region` jadvali EMAS: u yerda obyektlar monitoringining hududlari
 * turadi va ular auksion akkauntlariga bog'lanmagan. Ikkalasini birlashtirish
 * ikkita mustaqil quyi tizimni bir-biriga bog'lab qo'yardi.
 */
export const AUCTION_REGION_NAME: Record<string, string> = {
  QR: "Qoraqalpog'iston Respublikasi",
  AND: "Andijon viloyati",
  BUX: "Buxoro viloyati",
  JIZ: "Jizzax viloyati",
  QAS: "Qashqadaryo viloyati",
  NAV: "Navoiy viloyati",
  NAM: "Namangan viloyati",
  SAM: "Samarqand viloyati",
  SUR: "Surxondaryo viloyati",
  SIR: "Sirdaryo viloyati",
  "TOSH-V": "Toshkent viloyati",
  FAR: "Farg'ona viloyati",
  XOR: "Xorazm viloyati",
  "TOSH-SH": "Toshkent shahri",
};

/** Noma'lum kod bo'lsa kodning o'zi qaytadi — hech qachon bo'sh yorliq chiqmasin. */
export function auctionRegionName(code: string): string {
  return AUCTION_REGION_NAME[code] ?? code;
}
