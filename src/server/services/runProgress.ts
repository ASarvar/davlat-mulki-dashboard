import { prisma } from "@/lib/prisma";

// SyncRun progress hisoblagichlari + yakunlash (best-effort).
// Har bir "leaf" job (property-base fail yoki status-check success/fail) bir marta hisoblanadi.

/** Shuncha vaqt hech qanday o'sish bo'lmagan faol run — osilib qolgan deb yopiladi. */
export const STALE_RUN_HOURS = 6;

export async function incrementSuccess(syncRunId?: string): Promise<void> {
  if (!syncRunId) return;
  await prisma.syncRun.update({
    where: { id: syncRunId },
    data: { successCount: { increment: 1 }, progressAt: new Date() },
  });
}

/**
 * Xato hisoblagichi + QAYSI API yiqilgani.
 *
 * ⚠️ Xato sababi RUN'ning o'ziga yoziladi, `Property.lastSyncError` dan keyinchalik
 * hisoblab olinmaydi: `lastSyncError` faqat OXIRGI holatni saqlaydi, ya'ni keyingi
 * sinxronizatsiya o'sha obyektni yangilasa, eski run'ning xatosi izsiz yo'qolardi
 * (jonli ma'lumotda 33 ta xatolik keyinchalik 8 taga "kamayib" ko'ringan edi).
 */
export async function incrementFail(syncRunId?: string, errorMessage?: string): Promise<void> {
  if (!syncRunId) return;
  await prisma.syncRun.update({
    where: { id: syncRunId },
    data: { failCount: { increment: 1 }, progressAt: new Date() },
  });
  await recordFailureReason(syncRunId, errorMessage);
}

/**
 * `failureSummary` — `{ "API2: HTTP 500": 12, ... }` ko'rinishidagi sanoq.
 * Raw SQL: Prisma'da JSON ustunni atomik oshirib bo'lmaydi, `jsonb_set` esa buni
 * bitta so'rovda bajaradi — 50 ta parallel job bir-birining yozuvini yo'qotmaydi.
 */
async function recordFailureReason(syncRunId: string, errorMessage?: string): Promise<void> {
  const key = (errorMessage ?? "").trim();
  if (!key) return;
  // Xabar juda uzun bo'lsa kalitni qisqartiramiz (JSON cheksiz o'smasin).
  const short = key.slice(0, 200);
  await prisma.$executeRaw`
    UPDATE "SyncRun"
    SET "failureSummary" = jsonb_set(
      COALESCE("failureSummary", '{}'::jsonb),
      ARRAY[${short}],
      to_jsonb(COALESCE(("failureSummary" ->> ${short})::int, 0) + 1)
    )
    WHERE id = ${syncRunId}
  `;
}

/**
 * Bitta sync-source (tashkilot) jobi tugadi — muvaffaqiyatli yoki xato bilan.
 *
 * ⚠️ Barcha tashkilotlar ishlab bo'lingach birortasi ham obyekt navbatga qo'ymagan
 * bo'lsa (`totalCount = 0`), leaf job yo'q va `finalizeIfComplete()` hech qachon
 * chaqirilmaydi — run shu yerda yopiladi. Aks holda u abadiy faol qolib, keyingi
 * barcha sync'larni `assertNoActiveRun()` orqali bloklardi (29.09 hodisasi).
 */
export async function sourceFinished(syncRunId: string, errorMessage?: string): Promise<void> {
  const run = await prisma.syncRun.update({
    where: { id: syncRunId },
    data: {
      sourcesDone: { increment: 1 },
      ...(errorMessage ? { sourcesFailed: { increment: 1 } } : {}),
      progressAt: new Date(),
    },
    select: { sourcesDone: true, sourcesTotal: true, sourcesFailed: true, totalCount: true, status: true },
  });
  if (errorMessage) await recordFailureReason(syncRunId, errorMessage);

  if (run.sourcesDone < run.sourcesTotal) return;
  const active = run.status === "QUEUED" || run.status === "RUNNING";
  if (active && run.totalCount === 0) {
    await prisma.syncRun.updateMany({
      where: { id: syncRunId, status: { in: ["QUEUED", "RUNNING"] } },
      data: { status: run.sourcesFailed > 0 ? "FAILED" : "COMPLETED", finishedAt: new Date() },
    });
    return;
  }
  // Leaf joblar oxirgi tashkilot fan-out qilib ulgurmasidan tugagan bo'lishi mumkin.
  await finalizeIfComplete(syncRunId);
}

// total>0, barcha tashkilotlar fan-out qilib bo'lgan va success+fail>=total bo'lsa — yakunlaymiz.
// ⚠️ `sourcesDone >= sourcesTotal` sharti: busiz birinchi tashkilotning joblari tugashi bilan
// run yopilib, keyingi tashkilotlarning `totalCount` qo'shishi yopiq run'ga tushardi.
// (STATUS_REFRESH/SINGLE da fan-out yo'q — ikkala son 0, shart avtomatik bajariladi.)
export async function finalizeIfComplete(syncRunId?: string): Promise<void> {
  if (!syncRunId) return;
  const run = await prisma.syncRun.findUnique({
    where: { id: syncRunId },
    select: {
      totalCount: true,
      successCount: true,
      failCount: true,
      status: true,
      sourcesDone: true,
      sourcesTotal: true,
    },
  });
  if (!run || run.totalCount === 0 || run.sourcesDone < run.sourcesTotal) return;
  const done = run.successCount + run.failCount >= run.totalCount;
  const active = run.status === "QUEUED" || run.status === "RUNNING";
  if (done && active) {
    await prisma.syncRun.update({
      where: { id: syncRunId },
      data: { status: run.failCount > 0 ? "PARTIAL" : "COMPLETED", finishedAt: new Date() },
    });
  }
}

/**
 * `STALE_RUN_HOURS` davomida hech qanday o'sish bo'lmagan faol run'larni yopadi.
 *
 * Har bir yangi sync oldidan chaqiriladi (`assertNoActiveRun`) — jumladan kunlik 03:00
 * cron'idan. Sabab: worker sync o'rtasida to'xtasa yoki fan-out hech narsa bermasa,
 * bitta osilgan run keyingi BARCHA sync'larni jimgina bloklardi (jonli: 29.09 dan
 * 12 kun davomida birorta ham avtomatik sync o'tmagan). Ma'lumotga tegmaydi —
 * faqat run holati; sababi `failureSummary` va audit log'ga yoziladi.
 */
export async function closeStaleRuns(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_RUN_HOURS * 3600_000);
  const stale = await prisma.syncRun.findMany({
    where: { status: { in: ["QUEUED", "RUNNING"] } },
    select: { id: true, type: true, progressAt: true, startedAt: true, createdAt: true },
  });
  const ids = stale.filter((r) => (r.progressAt ?? r.startedAt ?? r.createdAt) < cutoff).map((r) => r.id);
  if (ids.length === 0) return 0;

  const reason = `SYNC: Osilib qoldi — ${STALE_RUN_HOURS} soat davomida o'sish bo'lmadi — avtomatik yopildi`;
  await prisma.syncRun.updateMany({
    where: { id: { in: ids }, status: { in: ["QUEUED", "RUNNING"] } },
    data: { status: "FAILED", finishedAt: new Date() },
  });
  for (const id of ids) await recordFailureReason(id, reason);
  await prisma.auditLog.create({
    data: { action: "CLOSE_STALE_SYNC", entityType: "SyncRun", metadata: { runIds: ids, hours: STALE_RUN_HOURS } },
  });
  console.warn(`[sync] ${ids.length} ta osilib qolgan run avtomatik yopildi: ${ids.join(", ")}`);
  return ids.length;
}
