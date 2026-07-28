// Queue nomlari va job payloadlari (import qilinganda hech narsaga ulanmaydi).

export const QUEUE = {
  SYNC_SOURCE: "sync-source", // API1: STIR -> kadastrlar (fan-out)
  PROPERTY_BASE: "property-base", // API2: kadastr -> asosiy ma'lumot
  STATUS_CHECK: "status-check", // API3-8: holat + fallback + klassifikatsiya
  DAILY_FULL_SYNC: "daily-full-sync", // pg-boss cron — har kuni tunda to'liq sync
} as const;

export interface SyncSourceJob {
  syncRunId: string;
  sourceId: string;
  stir: string;
  regionId: string;
}

export interface PropertyBaseJob {
  syncRunId?: string;
  sourceId: string;
  regionId: string;
  cadNumber: string;
}

export interface StatusCheckJob {
  syncRunId?: string;
  propertyId: string;
  cadNumber: string;
  cadNumberOld: string | null;
  // Uchalasi ham berilmasa (FULL_ALL/REGION/SINGLE zanjiri) — hammasi true,
  // xulq-atvor o'zgarmaydi. STATUS_REFRESH ulardan faqat kerakligini false qiladi:
  // false bo'lgan modul uchun tashqi API UMUMAN chaqirilmaydi, uning oldingi
  // hissasi bazadagi joriy qiymatlardan tiklanadi (`checkPropertyStatus.ts`).
  refreshBase?: boolean; // API2 — asosiy ma'lumot
  refreshAuction?: boolean; // API3/4 + API6 — auksion va ijara loti (birga)
  refreshRent?: boolean; // API5 — ijara shartnomalari
}

// Job natijasi — worker SyncRun hisoblagichlarini shunga qarab yangilaydi.
// "pending" = yakuniy emas (fan-out), hisoblanmaydi.
export type JobOutcome = "success" | "fail" | "pending";
