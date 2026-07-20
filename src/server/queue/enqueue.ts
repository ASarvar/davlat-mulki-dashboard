import { prisma } from "@/lib/prisma";
import { enqueuePropertyBase, enqueueSyncSources } from "./dispatch";
import type { SyncSourceJob } from "./jobs";

// UI/Server Action'lardan chaqiriladigan sync trigger'lar.
// Har biri SyncRun yaratadi va tegishli job(lar)ni navbatga qo'yadi.

// Dublikat qo'riqlash: worker o'chiq bo'lsa yoki sync tugamagan bo'lsa,
// tugmani qayta bosish o'nlab run va minglab job to'planishiga olib keladi
// (jonli testda 23 ta run / ~1350 job to'plangan edi).
// Shu sababli faol run bo'lsa yangisini boshlamaymiz.
async function assertNoActiveRun(): Promise<void> {
  const active = await prisma.syncRun.findFirst({
    where: { status: { in: ["QUEUED", "RUNNING"] } },
    select: { id: true, type: true, createdAt: true, totalCount: true, successCount: true, failCount: true },
    orderBy: { createdAt: "desc" },
  });
  if (!active) return;

  const done = active.successCount + active.failCount;
  throw new Error(
    `Sinxronizatsiya allaqachon ketmoqda (${active.type}, ${done}/${active.totalCount}, ` +
      `${active.createdAt.toLocaleTimeString("uz")}). Tugashini kuting yoki "Tozalash" tugmasidan foydalaning.`,
  );
}

// Barcha manbalarni (14 STIR) sinxronlash.
export async function triggerFullSync(userId?: string) {
  await assertNoActiveRun();
  const sources = await prisma.organizationSource.findMany({ where: { isActive: true } });
  const run = await prisma.syncRun.create({
    data: { type: "FULL_ALL", status: "QUEUED", triggeredById: userId ?? null },
  });
  await enqueueSyncSources(
    sources.map<SyncSourceJob>((s) => ({ syncRunId: run.id, sourceId: s.id, stir: s.stir, regionId: s.regionId })),
  );
  return run;
}

// Bitta hudud manbalarini sinxronlash.
export async function triggerRegionSync(regionId: string, userId?: string) {
  await assertNoActiveRun();
  const sources = await prisma.organizationSource.findMany({ where: { isActive: true, regionId } });
  const run = await prisma.syncRun.create({
    data: { type: "REGION", status: "QUEUED", regionId, triggeredById: userId ?? null },
  });
  await enqueueSyncSources(
    sources.map<SyncSourceJob>((s) => ({ syncRunId: run.id, sourceId: s.id, stir: s.stir, regionId: s.regionId })),
  );
  return run;
}

// Bitta kadastrni API orqali yangilash (mavjud obyekt uchun).
export async function triggerSingleSync(cadNumber: string, userId?: string) {
  const property = await prisma.property.findUnique({
    where: { cadNumber },
    select: { sourceId: true, regionId: true },
  });
  if (!property) throw new Error(`Obyekt topilmadi: ${cadNumber}`);

  const run = await prisma.syncRun.create({
    data: { type: "SINGLE", status: "QUEUED", regionId: property.regionId, triggeredById: userId ?? null, totalCount: 1 },
  });
  await enqueuePropertyBase({
    syncRunId: run.id,
    sourceId: property.sourceId,
    regionId: property.regionId,
    cadNumber,
  });
  return run;
}
