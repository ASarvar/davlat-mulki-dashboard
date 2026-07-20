import { prisma } from "@/lib/prisma";

// SyncRun progress hisoblagichlari + yakunlash (best-effort).
// Har bir "leaf" job (property-base fail yoki status-check success/fail) bir marta hisoblanadi.

export async function incrementSuccess(syncRunId?: string): Promise<void> {
  if (!syncRunId) return;
  await prisma.syncRun.update({ where: { id: syncRunId }, data: { successCount: { increment: 1 } } });
}

export async function incrementFail(syncRunId?: string): Promise<void> {
  if (!syncRunId) return;
  await prisma.syncRun.update({ where: { id: syncRunId }, data: { failCount: { increment: 1 } } });
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
