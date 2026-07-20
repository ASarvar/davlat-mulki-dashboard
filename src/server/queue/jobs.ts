// Queue nomlari va job payloadlari (import qilinganda hech narsaga ulanmaydi).

export const QUEUE = {
  SYNC_SOURCE: "sync-source", // API1: STIR -> kadastrlar (fan-out)
  PROPERTY_BASE: "property-base", // API2: kadastr -> asosiy ma'lumot
  STATUS_CHECK: "status-check", // API3-8: holat + fallback + klassifikatsiya
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
}

// Job natijasi — worker SyncRun hisoblagichlarini shunga qarab yangilaydi.
// "pending" = yakuniy emas (fan-out), hisoblanmaydi.
export type JobOutcome = "success" | "fail" | "pending";
