import { prisma } from "@/lib/prisma";
import { getBoss } from "@/server/queue/boss";
import { QUEUE } from "@/server/queue/jobs";
import { describeSyncError, type SyncErrorInfo } from "@/lib/syncError";

export interface CleanupResult {
  runsClosed: number;
  jobsPurged: number;
}

// Navbatda kutayotgan joblar soni (UI'da ko'rsatish uchun).
export async function getPendingJobCounts(): Promise<Record<string, number>> {
  const boss = await getBoss();
  const entries = await Promise.all(
    Object.values(QUEUE).map(async (name) => [name, await boss.getQueueSize(name)] as const),
  );
  return Object.fromEntries(entries);
}

export interface QueueHealth {
  pending: number;
  active: number;
  oldestPendingSec: number | null;
  /** Joblar navbatda turibdi, lekin hech kim ularni olmayapti => worker o'chiq. */
  workerLikelyDown: boolean;
}

// Worker ishlayaptimi? pg-boss'da "kim ulangan" degan ro'yxat yo'q, shuning uchun
// bilvosita aniqlaymiz: kutayotgan job bor, active job yo'q va eng eskisi ancha
// vaqtdan beri turibdi => uni oladigan process yo'q.
const STALE_AFTER_SEC = 25;

export async function getQueueHealth(): Promise<QueueHealth> {
  // start_after <= now() — retry backoff uchun ataylab kechiktirilgan joblarni
  // "osilib qolgan" deb hisoblamaymiz (aks holda yolg'on ogohlantirish chiqadi).
  const rows = await prisma.$queryRawUnsafe<{ pending: bigint; active: bigint; oldest: Date | null }[]>(
    `SELECT
       COUNT(*) FILTER (WHERE state IN ('created','retry') AND start_after <= now()) AS pending,
       COUNT(*) FILTER (WHERE state = 'active')                                      AS active,
       MIN(created_on) FILTER (WHERE state IN ('created','retry') AND start_after <= now()) AS oldest
     FROM pgboss.job`,
  );
  const r = rows[0];
  const pending = Number(r?.pending ?? 0);
  const active = Number(r?.active ?? 0);
  const oldestPendingSec = r?.oldest ? Math.round((Date.now() - new Date(r.oldest).getTime()) / 1000) : null;

  return {
    pending,
    active,
    oldestPendingSec,
    workerLikelyDown: pending > 0 && active === 0 && (oldestPendingSec ?? 0) > STALE_AFTER_SEC,
  };
}

// "Tozalash": osilib qolgan run'larni yopadi va navbatdagi joblarni o'chiradi.
// Ma'lumotlarni (Property/Document) O'CHIRMAYDI — faqat navbat va run holati.
export async function cleanupStuckSyncs(actorId: string): Promise<CleanupResult> {
  const boss = await getBoss();

  let jobsPurged = 0;
  for (const name of Object.values(QUEUE)) {
    jobsPurged += await boss.getQueueSize(name);
    await boss.purgeQueue(name); // faqat kutayotgan joblar o'chadi
  }

  const { count: runsClosed } = await prisma.syncRun.updateMany({
    where: { status: { in: ["QUEUED", "RUNNING"] } },
    data: { status: "FAILED", finishedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: actorId,
      action: "CLEANUP_SYNC",
      entityType: "SyncRun",
      metadata: { runsClosed, jobsPurged },
    },
  });

  return { runsClosed, jobsPurged };
}

export interface SyncFailureBucket {
  /** Qaysi API — o'zbekcha to'liq nom (`describeSyncError`dan). */
  apiLabel: string;
  /** Xato NIMA ekani — o'zbekcha tushuntirish. */
  reason: string;
  blame: SyncErrorInfo["blame"];
  count: number;
  /** Xom xabar — admin uchun texnik tafsilot (tooltip'da). */
  sampleMessage: string;
}

/**
 * Bitta sync run'da QAYSI tashqi API va NIMA sababdan xato berganini ko'rsatadi.
 *
 * Manba — `SyncRun.failureSummary` (`{ "API2: HTTP 500": 12, ... }`), ya'ni run
 * yakunlangandan keyin ham o'zgarmaydigan yozuv. ⚠️ Ilgari bu `Property.lastSyncError`
 * dan vaqt oralig'i bo'yicha hisoblanardi va keyingi sinxronizatsiya obyektni
 * yangilashi bilan sonlar "kamayib" ketardi (33 ta xato → 8 ta sabab).
 */
export function syncFailureBreakdown(run: { failureSummary: unknown }): SyncFailureBucket[] {
  const summary = run.failureSummary;
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return [];

  // Guruhlash kaliti — API + sabab JUFTLIGI: bitta API ikki xil sababdan yiqilishi
  // mumkin (masalan API2 ba'zi obyektda 500, boshqasida "topilmadi"), va ularni
  // bitta qatorga qo'shib yuborish aynan "xato nimada?" degan savolni yopib qo'yardi.
  const buckets = new Map<string, SyncFailureBucket>();
  for (const [message, rawCount] of Object.entries(summary as Record<string, unknown>)) {
    const count = Number(rawCount);
    if (!Number.isFinite(count) || count <= 0) continue;
    const info = describeSyncError(message);
    if (!info) continue;

    const key = `${info.key ?? "?"}|${info.reason}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += count;
    } else {
      buckets.set(key, {
        apiLabel: info.apiLabel,
        reason: info.reason,
        blame: info.blame,
        count,
        sampleMessage: info.raw,
      });
    }
  }

  return [...buckets.values()].sort((a, z) => z.count - a.count);
}
