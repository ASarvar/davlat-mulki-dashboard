// Queue nomlari va job payloadlari (import qilinganda hech narsaga ulanmaydi).

export const QUEUE = {
  SYNC_SOURCE: "sync-source", // API1: STIR -> kadastrlar (fan-out)
  PROPERTY_BASE: "property-base", // API2: kadastr -> asosiy ma'lumot
  STATUS_CHECK: "status-check", // API3-8: holat + fallback + klassifikatsiya
  DAILY_FULL_SYNC: "daily-full-sync", // pg-boss cron — har kuni tunda to'liq sync
  /**
   * Ijara imtiyozi: YATT ishchilar indeksini qayta qurish.
   * ⚠️ Uzoq ishlaydi (~76 000 yozuv, 150+ sahifa) — shuning uchun `boss.ts` da
   * unga ALOHIDA `expireInSeconds` beriladi, umumiy 120s uni yarmida uzardi.
   */
  IMTIYOZ_YATT_SYNC: "imtiyoz-yatt-sync",
  /**
   * Boshqaruv paneli ko'rsatkichlarining kunlik o'lchovi (`services/snapshots.ts`).
   * ⚠️ Jadvali **02:00** — kunlik to'liq sync (03:00) dan OLDIN. Sync o'rtasida
   * olingan snapshot yarim yangilangan holatni yozib, trendda soxta sakrash berardi.
   */
  DASHBOARD_SNAPSHOT: "dashboard-snapshot",
  /**
   * Auksion buyurtmalari reyestrini yuklab olish (`services/auctionOrders.ts`).
   * ⚠️ ENG UZOQ job: 14 akkaunt × ~1 364 sahifa. Jonli o'lchov (2026-09-07):
   * to'liq yuklash **16d 37s**, 68 196 buyurtma. ⚠️ SANA filtri vaqtni deyarli
   * tejamaydi (joriy yil **15d 3s**) — sahifalar baribir to'liq o'qiladi;
   * AKKAUNT filtri esa tejaydi (bitta viloyat **26s**). `boss.ts` da alohida
   * `expireInSeconds` beriladi — YATT indeksi bilan bir xil sabab.
   */
  AUCTION_ORDERS_SYNC: "auction-orders-sync",
} as const;

/**
 * Auksion reyestrini yangilash doirasi.
 *
 * ⚠️ Sana JOB ichida SATR bo'lib yuriladi (`Date` emas) — pg-boss payload'ni
 * JSON qilib saqlaydi.
 * ⚠️ `currentYear` bayrog'i aniq sanadan AFZAL: kunlik jadval bir marta
 * ro'yxatdan o'tadi, aniq sana yozilsa 1-yanvarda eski yil bilan qotib qolardi.
 */
export interface AuctionSyncJob {
  currentYear?: boolean;
  /** "YYYY-MM-DD" */
  from?: string;
  to?: string;
  /** Akkaunt nomlari (QR, AND …). Bo'sh = hammasi. */
  credentials?: string[];
  startedById?: string;
}

export interface SyncSourceJob {
  syncRunId: string;
  sourceId: string;
  stir: string;
  /** Manbaning hududi. `null` = respublika darajasi — hudud har bir kadastr prefiksidan aniqlanadi. */
  regionId: string | null;
  /**
   * Faqat shu hududga tegishli kadastrlarni olish (hudud bo'yicha sinxronizatsiya).
   * API 1 tashkilotning BARCHA kadastrlarini qaytaradi — hududsiz manbani bitta hudud
   * doirasida yangilash uchun natijani shu yerda filtrlaymiz.
   */
  filterRegionId?: string;
}

export interface PropertyBaseJob {
  syncRunId?: string;
  sourceId: string;
  regionId: string;
  cadNumber: string;
  /**
   * Tashkilot STIRi — yangi `cad_data` API'si uchun MAJBURIY parametr.
   * ⚠️ Ixtiyoriy qilib qoldirilgan: eski (deploydan oldin navbatga tushgan)
   * joblarda u yo'q, ishlov beruvchi bunday holatda `sourceId` orqali bazadan oladi.
   */
  stir?: string;
}

export interface StatusCheckJob {
  syncRunId?: string;
  propertyId: string;
  cadNumber: string;
  cadNumberOld: string | null;
  // Berilmasa (FULL_ALL/REGION/SINGLE zanjiri) — base/auction/rent `true`, ya'ni
  // xulq-atvor o'zgarmaydi. STATUS_REFRESH ulardan faqat kerakligini false qiladi:
  // false bo'lgan modul uchun tashqi API UMUMAN chaqirilmaydi, uning oldingi
  // hissasi bazadagi joriy qiymatlardan tiklanadi (`checkPropertyStatus.ts`).
  refreshBase?: boolean; // API2 — asosiy ma'lumot
  refreshAuction?: boolean; // API3/4 + API6 — auksion va ijara loti (birga)
  refreshRent?: boolean; // API5 — ijara shartnomalari
  /**
   * suv/gaz/elektr — kommunal abonent tekshiruvi.
   * ⚠️ Qolganlaridan FARQLI: standarti `false`. Umumiy sinxronizatsiyaga kirmaydi,
   * faqat qo'lda tanlanganda ishlaydi — sababi `checkPropertyStatus.ts` izohida.
   */
  refreshUtility?: boolean;
}

// Job natijasi — worker SyncRun hisoblagichlarini shunga qarab yangilaydi.
// "pending" = yakuniy emas (fan-out), hisoblanmaydi.
/**
 * Job natijasi. `"fail"` ni SABAB bilan qaytarish mumkin — sabab `SyncRun.failureSummary`
 * ga yoziladi ("qaysi API xato berdi" jadvali shundan quriladi). Sababsiz `"fail"` ham
 * ishlayveradi (xato "Noma'lum" guruhiga tushadi).
 */
export type JobOutcome = "success" | "fail" | "pending" | { outcome: "fail"; reason: string };
