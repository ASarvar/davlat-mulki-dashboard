// pg-boss worker entrypoint. Alohida process: `npm run worker`.
import "dotenv/config";
import PgBoss from "pg-boss";
import { getBoss, stopBoss } from "./boss";
import { QUEUE, type JobOutcome, type PropertyBaseJob, type StatusCheckJob, type SyncSourceJob } from "./jobs";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { processSyncSource } from "./processors/syncSource";
import { processPropertyBase } from "./processors/syncPropertyBase";
import { processStatusCheck } from "./processors/checkPropertyStatus";
import { incrementSuccess, incrementFail, finalizeIfComplete } from "@/server/services/runProgress";
import { triggerFullSync } from "./enqueue";

const leafOpts: PgBoss.WorkOptions = {
  batchSize: env.WORKER_CONCURRENCY,
  pollingIntervalSeconds: env.WORKER_POLL_SECONDS,
};

const msg = (err: unknown) => (err instanceof Error ? err.message : String(err));

// Leaf handler: outcome/exception'ga qarab SyncRun hisoblagichlarini yangilaydi.
// Batch ichida HECH QACHON throw qilmaymiz (aks holda butun batch fail bo'ladi) —
// har bir job'ni alohida ushlaymiz. Xato http.ts darajasida allaqachon retry qilingan.
function leafHandler<T extends { syncRunId?: string }>(
  process: (data: T) => Promise<JobOutcome>,
  onFatal: (data: T, err: unknown) => Promise<void>,
): PgBoss.WorkHandler<T> {
  return async (jobs: PgBoss.Job<T>[]) => {
    await Promise.allSettled(
      jobs.map(async (job) => {
        const runId = job.data.syncRunId;
        try {
          const outcome = await process(job.data);
          if (outcome === "success") await incrementSuccess(runId);
          else if (outcome === "fail") await incrementFail(runId);
          if (outcome !== "pending") await finalizeIfComplete(runId);
        } catch (err) {
          console.error(`[${job.name}] xato:`, msg(err));
          try {
            await onFatal(job.data, err);
          } catch (e) {
            console.error("onFatal xato:", msg(e));
          }
          await incrementFail(runId);
          await finalizeIfComplete(runId);
        }
      }),
    );
  };
}

async function main() {
  const boss = await getBoss();

  // sync-source: fan-out (hisoblanmaydi, xato bo'lsa faqat log).
  // batchSize 14 ta manbani bir zumda qamrab oladi — kichik qiymatda bitta hudud
  // jobi boshqalar orqasida uzoq kutib qolardi.
  await boss.work<SyncSourceJob>(
    QUEUE.SYNC_SOURCE,
    { batchSize: 14, pollingIntervalSeconds: env.WORKER_POLL_SECONDS },
    async (jobs: PgBoss.Job<SyncSourceJob>[]) => {
      await Promise.allSettled(
        jobs.map(async (job) => {
          try {
            await processSyncSource(job.data);
          } catch (err) {
            console.error(`[sync-source] stir=${job.data.stir}:`, msg(err));
          }
        }),
      );
    },
  );

  // property-base
  await boss.work<PropertyBaseJob>(
    QUEUE.PROPERTY_BASE,
    leafOpts,
    leafHandler<PropertyBaseJob>(processPropertyBase, async (data, err) => {
      await prisma.property.updateMany({
        where: { cadNumber: data.cadNumber },
        data: { syncStatus: "FAILED", lastSyncError: msg(err) },
      });
    }),
  );

  // status-check
  await boss.work<StatusCheckJob>(
    QUEUE.STATUS_CHECK,
    leafOpts,
    leafHandler<StatusCheckJob>(processStatusCheck, async (data, err) => {
      await prisma.property
        .update({ where: { id: data.propertyId }, data: { syncStatus: "FAILED", lastSyncError: msg(err) } })
        .catch(() => {});
    }),
  );

  // Kunlik avtomatik to'liq sinxronizatsiya — kadastr ro'yxati/asosiy ma'lumot kamdan-kam
  // o'zgaradi, shuning uchun kuniga bir marta (03:00, Toshkent) yetarli. `.schedule()`
  // idempotent — worker qayta ishga tushganda bir xil jadval qayta yozilaveradi, xato bermaydi.
  // Faqat WORKER process chaqiradi (Next.js web process'da emas) — ishga tushirish shu yerda.
  await boss.work(QUEUE.DAILY_FULL_SYNC, async () => {
    try {
      await triggerFullSync();
      console.log("[daily-full-sync] navbatga qo'yildi");
    } catch (err) {
      // Odatiy sabab: shu payt boshqa sync allaqachon ketayotgan edi — bu xato emas,
      // ertangi jadval o'zi qayta urinadi.
      console.warn("[daily-full-sync] o'tkazib yuborildi:", msg(err));
    }
  });
  await boss.schedule(QUEUE.DAILY_FULL_SYNC, "0 3 * * *", {}, { tz: "Asia/Tashkent" });

  console.log(
    `🚀 Worker (pg-boss) ishga tushdi. batchSize=${env.WORKER_CONCURRENCY}, poll=${env.WORKER_POLL_SECONDS}s. Queue'lar: ${Object.values(QUEUE).join(", ")}`,
  );
}

main().catch((e) => {
  console.error("Worker ishga tushmadi:", e);
  process.exit(1);
});

const shutdown = async () => {
  console.log("⏳ Worker to'xtatilmoqda...");
  await stopBoss().catch(() => {});
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
