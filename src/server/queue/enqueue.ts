import { prisma } from "@/lib/prisma";
import { enqueuePropertyBase, enqueueSyncSources, insertStatusCheckBulk } from "./dispatch";
import type { SyncSourceJob, StatusCheckJob } from "./jobs";

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

// Barcha manbalarni (yoki bitta soha bo'yicha barchasini) sinxronlash.
export async function triggerFullSync(userId?: string, sourceName?: string) {
  await assertNoActiveRun();
  const sources = await prisma.organizationSource.findMany({
    where: { isActive: true, ...(sourceName ? { name: sourceName } : {}) },
  });
  const run = await prisma.syncRun.create({
    data: { type: "FULL_ALL", status: "QUEUED", triggeredById: userId ?? null, sourceName: sourceName ?? null },
  });
  // ⚠️ `restrictedRegionId` (masalan Direksiya → Toshkent sh.) shu yerda `filterRegionId`
  // sifatida uzatiladi — REGION triggeridan farqli, bu FULL_ALL (va kunlik avtomatik
  // sync, ikkalasi ham shu funksiyani chaqiradi) uchun yagona joy, chunki bu yerda
  // hech qanday ad-hoc hudud filtri berilmaydi. `processSyncSource` prefiksdan aniqlagan
  // hududni shu bilan solishtirib, mos kelmasa obyektni butunlay o'tkazib yuboradi
  // (boshqa hududga yozmaydi) — `OrganizationSource.regionId`ni o'zgartirish EMAS,
  // chunki u "ko'r-ko'rona ishonch" branchiga tushirib, mos kelmagan kadastrni ham
  // shu hudud deb noto'g'ri yozib qo'yardi.
  await enqueueSyncSources(
    sources.map<SyncSourceJob>((s) => ({
      syncRunId: run.id,
      sourceId: s.id,
      stir: s.stir,
      regionId: s.regionId,
      filterRegionId: s.restrictedRegionId ?? undefined,
    })),
  );
  return run;
}

// Bitta hudud (ixtiyoriy: + bitta soha) manbalarini sinxronlash.
// ⚠️ Shu hududga biriktirilgan manbalardan tashqari, RESPUBLIKA darajasidagi
// (regionId = null) manbalar ham qo'shiladi — ularning obyektlari ham shu hududda
// bo'lishi mumkin. API 1 tashkilotning barcha kadastrlarini qaytargani uchun,
// fan-out bosqichida `filterRegionId` bo'yicha faqat shu hudud kadastrlari olinadi.
export async function triggerRegionSync(regionId: string, userId?: string, sourceName?: string) {
  await assertNoActiveRun();
  const sources = await prisma.organizationSource.findMany({
    where: {
      isActive: true,
      OR: [{ regionId }, { regionId: null }],
      ...(sourceName ? { name: sourceName } : {}),
    },
  });
  const run = await prisma.syncRun.create({
    data: {
      type: "REGION",
      status: "QUEUED",
      regionId,
      sourceName: sourceName ?? null,
      triggeredById: userId ?? null,
    },
  });
  await enqueueSyncSources(
    sources.map<SyncSourceJob>((s) => ({
      syncRunId: run.id,
      sourceId: s.id,
      stir: s.stir,
      regionId: s.regionId,
      filterRegionId: regionId,
    })),
  );
  return run;
}

export interface StatusRefreshInput {
  regionId?: string;
  sourceName?: string;
  refreshBase: boolean;
  refreshAuction: boolean;
  refreshRent: boolean;
  userId?: string;
}

// "Faqat holat yangilash" — API1 (kashfiyot) va ixtiyoriy ravishda API2 ni ham o'tkazib,
// MAVJUD obyektlarga to'g'ridan-to'g'ri holat-API tekshiruvini qo'yadi. Yangi kadastr
// QIDIRILMAYDI — faqat bazada bor obyektlar (hudud/soha doirasida) yangilanadi.
export async function triggerStatusRefresh(input: StatusRefreshInput) {
  const { regionId, sourceName, refreshBase, refreshAuction, refreshRent, userId } = input;
  if (!refreshBase && !refreshAuction && !refreshRent) {
    throw new Error("Kamida bitta modul tanlanishi kerak");
  }
  await assertNoActiveRun();

  const properties = await prisma.property.findMany({
    where: {
      ...(regionId ? { regionId } : {}),
      ...(sourceName ? { source: { name: sourceName } } : {}),
      // Balansdan chiqarilganlarni yangilashning ma'nosi yo'q — ular hisobotga
      // kirmaydi va tashqi API'larga behuda so'rov bo'lardi.
      removedFromBalance: false,
    },
    select: { id: true, cadNumber: true, cadNumberOld: true },
  });
  if (properties.length === 0) {
    throw new Error("Tanlangan doirada obyekt topilmadi");
  }

  const run = await prisma.syncRun.create({
    data: {
      type: "STATUS_REFRESH",
      status: "QUEUED",
      regionId: regionId ?? null,
      sourceName: sourceName ?? null,
      refreshBase,
      refreshAuction,
      refreshRent,
      totalCount: properties.length,
      triggeredById: userId ?? null,
    },
  });

  await insertStatusCheckBulk(
    properties.map<StatusCheckJob>((p) => ({
      syncRunId: run.id,
      propertyId: p.id,
      cadNumber: p.cadNumber,
      cadNumberOld: p.cadNumberOld,
      refreshBase,
      refreshAuction,
      refreshRent,
    })),
  );

  // Fan-out siz to'g'ridan-to'g'ri "RUNNING" — property-base bosqichi yo'q, shuning uchun
  // sync-source kabi alohida "totalCount oshirish" qadami kerak emas (yuqorida hisoblangan).
  await prisma.syncRun.update({ where: { id: run.id }, data: { status: "RUNNING", startedAt: new Date() } });

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
