import { prisma } from "@/lib/prisma";

// SyncRun progress hisoblagichlari + yakunlash (best-effort).
// Har bir "leaf" job (property-base fail yoki status-check success/fail) bir marta hisoblanadi.

export async function incrementSuccess(syncRunId?: string): Promise<void> {
  if (!syncRunId) return;
  await prisma.syncRun.update({ where: { id: syncRunId }, data: { successCount: { increment: 1 } } });
}

/**
 * Xato hisoblagichi + QAYSI API yiqilgani.
 *
 * ⚠️ Xato sababi RUN'ning o'ziga yoziladi, `Property.lastSyncError` dan keyinchalik
 * hisoblab olinmaydi: `lastSyncError` faqat OXIRGI holatni saqlaydi, ya'ni keyingi
 * sinxronizatsiya o'sha obyektni yangilasa, eski run'ning xatosi izsiz yo'qolardi
 * (jonli ma'lumotda 33 ta xatolik keyinchalik 8 taga "kamayib" ko'ringan edi).
 *
 * `failureSummary` — `{ "API2: HTTP 500": 12, ... }` ko'rinishidagi sanoq.
 * Raw SQL: Prisma'da JSON ustunni atomik oshirib bo'lmaydi, `jsonb_set` esa buni
 * bitta so'rovda bajaradi — 50 ta parallel job bir-birining yozuvini yo'qotmaydi.
 */
export async function incrementFail(syncRunId?: string, errorMessage?: string): Promise<void> {
  if (!syncRunId) return;
  await prisma.syncRun.update({ where: { id: syncRunId }, data: { failCount: { increment: 1 } } });

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

// total>0 va success+fail>=total bo'lsa — run'ni yakunlaymiz.
// Eslatma: fan-out completion best-effort (source'lar ketma-ket total qo'shadi).
export async function finalizeIfComplete(syncRunId?: string): Promise<void> {
  if (!syncRunId) return;
  const run = await prisma.syncRun.findUnique({
    where: { id: syncRunId },
    select: { totalCount: true, successCount: true, failCount: true, status: true },
  });
  if (!run || run.totalCount === 0) return;
  const done = run.successCount + run.failCount >= run.totalCount;
  const active = run.status === "QUEUED" || run.status === "RUNNING";
  if (done && active) {
    await prisma.syncRun.update({
      where: { id: syncRunId },
      data: { status: run.failCount > 0 ? "PARTIAL" : "COMPLETED", finishedAt: new Date() },
    });
  }
}
