/**
 * Tashqi xizmatlar holati (Soliq / TIEK).
 *
 * Tamoyil: HAQIQIY TRAFIK — asosiy signal. Har bir tekshiruv o'z natijasini shu yerga
 * yozib boradi, shuning uchun panel uchun QO'SHIMCHA SO'ROV UMUMAN KETMAYDI.
 *
 * ⚠️ Holat XOTIRADA va PROCESSGA XOS. Bu ataylab: u faqat diagnostika paneli uchun,
 * va aynan shu process qanday javob olayotganini ko'rsatishi kerak. Worker'ning YATT
 * sinxronlashi bu yerga tushmaydi — YATT holati `ImtiyozYattSync` jadvalidan
 * (`yattIndex.ts`) o'qiladi va uchala process uchun bir xil bo'ladi.
 *
 * Faol probe YO'Q (asl ilovadan farq): probe qo'shilsa, sahifa ochilgan har bir
 * brauzer daqiqasiga shlyuzga so'rov yuborardi. Trafik bo'lmasa holat `unknown`
 * bo'lib qoladi — bu "yotibdi" degani emas va panelda shunday yoziladi.
 */

export type ServiceStatus = "ok" | "degraded" | "down" | "unknown";

/** Ketma-ket shuncha xatodan keyin xizmat "down" hisoblanadi. */
const DOWN_AFTER_FAILURES = 2;

interface ServiceState {
  lastOkAt: number | null;
  lastFailAt: number | null;
  lastMessage: string | null;
  consecutiveFailures: number;
  lastObservedAt: number | null;
}

const newState = (): ServiceState => ({
  lastOkAt: null,
  lastFailAt: null,
  lastMessage: null,
  consecutiveFailures: 0,
  lastObservedAt: null,
});

export type ImtiyozService = "soliq" | "tiek";

// Dev'da modul qayta yuklanganda holat yo'qolmasin (HMR).
const g = globalThis as unknown as { imtiyozHealth?: Record<ImtiyozService, ServiceState> };
const services: Record<ImtiyozService, ServiceState> = (g.imtiyozHealth ??= {
  soliq: newState(),
  tiek: newState(),
});

/** Har bir HAQIQIY tashqi chaqiruvdan keyin chaqiriladi. */
export function recordServiceResult(name: ImtiyozService, ok: boolean, message?: string): void {
  const svc = services[name];
  const now = Date.now();
  svc.lastObservedAt = now;
  if (ok) {
    svc.lastOkAt = now;
    svc.consecutiveFailures = 0;
    svc.lastMessage = null;
  } else {
    svc.lastFailAt = now;
    svc.consecutiveFailures++;
    svc.lastMessage = message || "Noma'lum xatolik";
  }
}

function statusOf(svc: ServiceState): ServiceStatus {
  if (!svc.lastObservedAt) return "unknown";
  const lastWasFailure = svc.lastFailAt !== null && (svc.lastOkAt === null || svc.lastFailAt > svc.lastOkAt);
  if (!lastWasFailure) return "ok";
  return svc.consecutiveFailures >= DOWN_AFTER_FAILURES ? "down" : "degraded";
}

export interface ServiceSnapshot {
  status: ServiceStatus;
  lastOkAt: string | null;
  lastFailAt: string | null;
  lastObservedAt: string | null;
  consecutiveFailures: number;
  message: string | null;
}

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

export function getServiceSnapshots(): Record<ImtiyozService, ServiceSnapshot> {
  const out = {} as Record<ImtiyozService, ServiceSnapshot>;
  for (const name of Object.keys(services) as ImtiyozService[]) {
    const svc = services[name];
    out[name] = {
      status: statusOf(svc),
      lastOkAt: iso(svc.lastOkAt),
      lastFailAt: iso(svc.lastFailAt),
      lastObservedAt: iso(svc.lastObservedAt),
      consecutiveFailures: svc.consecutiveFailures,
      message: svc.lastMessage,
    };
  }
  return out;
}

/** Indeks shu muddatdan eski bo'lsa "eskirgan" (24 soatlik tsikl + zaxira). */
const YATT_STALE_MS = 26 * 60 * 60 * 1000;

export type YattStatus = "ok" | "syncing" | "incomplete" | "stale" | "unavailable";

export function yattStatus(s: {
  ready: boolean;
  syncing: boolean;
  failedPages: number;
  lastSyncedAt: Date | null;
}): YattStatus {
  if (s.syncing && !s.ready) return "syncing";
  if (!s.ready) return "unavailable";
  if (s.failedPages > 0) return "incomplete";
  if (s.lastSyncedAt && Date.now() - s.lastSyncedAt.getTime() > YATT_STALE_MS) return "stale";
  return "ok";
}
