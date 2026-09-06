// pg-boss worker entrypoint. Alohida process: `npm run worker`.
import "dotenv/config";
import PgBoss from "pg-boss";
import { getBoss, stopBoss } from "./boss";
import {
  QUEUE,
  type AuctionSyncJob,
  type JobOutcome,
  type PropertyBaseJob,
  type StatusCheckJob,
  type SyncSourceJob,
} from "./jobs";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { processSyncSource } from "./processors/syncSource";
import { processPropertyBase } from "./processors/syncPropertyBase";
import { processStatusCheck } from "./processors/checkPropertyStatus";
import { incrementSuccess, incrementFail, finalizeIfComplete } from "@/server/services/runProgress";
import { triggerFullSync } from "./enqueue";
import { isYattIndexFresh, syncYattIndex } from "@/server/services/imtiyoz/yattIndex";
import { takeDashboardSnapshot } from "@/server/services/snapshots";
import { imtiyozConfigured } from "@/server/integrations/imtiyoz";
import { auctionConfigured } from "@/server/integrations/auctionOrders";
import { syncAuctionOrders, currentYearStart } from "@/server/services/auctionOrders";

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
          // Sabab bilan qaytgan fail — sababni run'ga yozamiz (jobs.ts izohiga qarang).
          else if (typeof outcome === "object") await incrementFail(runId, outcome.reason);
          if (outcome !== "pending") await finalizeIfComplete(runId);
        } catch (err) {
          console.error(`[${job.name}] xato:`, msg(err));
          try {
            await onFatal(job.data, err);
          } catch (e) {
            console.error("onFatal xato:", msg(e));
          }
          // Xato xabari run'ga ham yoziladi — Property.lastSyncError keyingi
          // sinxronizatsiyada ustidan yozilib ketadi (runProgress.ts izohiga qarang).
          await incrementFail(runId, msg(err));
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

  // ── Boshqaruv paneli: kunlik snapshot ──
  //
  // ⚠️ Soat **02:00** — kunlik to'liq sync (03:00) dan BIR SOAT OLDIN. Sync
  // o'rtasida olingan o'lchov yarim yangilangan holatni yozib, trendda mavjud
  // bo'lmagan sakrashni ko'rsatardi. `takeDashboardSnapshot()` faol run bo'lsa
  // xato tashlaydi — bu yerda uni jim o'tkazib yuboramiz (ertaga qayta olinadi).
  //
  // ⚠️ O'lchov TARIXI — uni keyin backfill qilib bo'lmaydi. Shuning uchun job
  // o'tkazib yuborilgani ALBATTA log'ga yoziladi: sababsiz bo'shliq qolmasin.
  await boss.work(QUEUE.DASHBOARD_SNAPSHOT, async () => {
    try {
      const r = await takeDashboardSnapshot();
      console.log(`[dashboard-snapshot] ${r.day}: ${r.rows} qator (eskirgan: ${r.removed})`);
    } catch (err) {
      console.warn("[dashboard-snapshot] o'tkazib yuborildi:", msg(err));
    }
  });
  await boss.schedule(QUEUE.DASHBOARD_SNAPSHOT, "0 2 * * *", {}, { tz: "Asia/Tashkent" });

  // ── Ijara imtiyozi: YATT ishchilar indeksi ──
  //
  // ⚠️ Jadval har 6 SOATDA ishga tushadi, lekin indeks yangi bo'lsa ishlov beruvchi
  // uni O'TKAZIB YUBORADI. Bu asl ilovadagi adaptiv rejalashtirishning cron'dagi
  // ko'rinishi: muvaffaqiyatli to'liq sinxronlashdan keyin ~22 soat tinch turadi,
  // to'liqsiz bo'lsa esa keyingi 6 soatlik urinishda darhol qayta uriniladi
  // (yetishmayotgan sahifalar tufayli tadbirkorlar noto'g'ri "xodimsiz" ko'rinmasin).
  //
  // `force: true` — web'dan qo'lda ishga tushirilganda yangilik tekshiruvi o'tkazilmaydi.
  await boss.work<{ force?: boolean }>(QUEUE.IMTIYOZ_YATT_SYNC, async ([job]) => {
    if (!imtiyozConfigured()) {
      console.warn("[imtiyoz-yatt] o'tkazib yuborildi: IMTIYOZ_* env sozlanmagan");
      return;
    }
    if (!job?.data?.force && (await isYattIndexFresh())) {
      console.log("[imtiyoz-yatt] indeks yangi — o'tkazib yuborildi");
      return;
    }
    await syncYattIndex();
  });
  await boss.schedule(QUEUE.IMTIYOZ_YATT_SYNC, "0 */6 * * *", {}, { tz: "Asia/Tashkent" });

  // Worker ishga tushganda indeks umuman yo'q bo'lsa darhol qurishni boshlaymiz —
  // aks holda birinchi jadvalgacha (6 soatgacha) barcha YATT tekshiruvlari
  // "aniqlanmadi" bo'lib turardi.
  if (imtiyozConfigured() && !(await isYattIndexFresh())) {
    await boss.send(QUEUE.IMTIYOZ_YATT_SYNC, {});
    console.log("[imtiyoz-yatt] indeks eskirgan/yo'q — dastlabki sinxronlash navbatga qo'yildi");
  }

  // ── Auksion buyurtmalari reyestri ──
  //
  // ⚠️ Kunlik, soat **04:00** — to'liq sync (03:00) TUGAGANDAN keyin. Ikkalasi
  // bir vaqtda ishlasa shlyuzga ikki oqim ketardi va `result_code` xatolari
  // boshlanardi (kommunal API'lardagi saboq).
  //
  // ⚠️ Bu job obyektlar sinxronizatsiyasidan MUSTAQIL: `SyncRun` yaratmaydi,
  // `assertNoActiveRun()` ni tekshirmaydi va kategoriyaga ta'sir qilmaydi.
  // Uning yiqilishi obyektlar monitoringiga hech qanday zarar bermaydi.
  await boss.work<AuctionSyncJob>(QUEUE.AUCTION_ORDERS_SYNC, async ([job]) => {
    if (!auctionConfigured()) {
      console.warn("[auction-orders] o'tkazib yuborildi: AUCTION_ORDERS_* env sozlanmagan");
      return;
    }
    const d = job?.data ?? {};
    // ⚠️ `currentYear` — kunlik cron shu bayroq bilan keladi. Sanani JOB ichiga
    // yozib qo'ymaymiz: jadval bir marta ro'yxatdan o'tadi va yil almashganda
    // (1-yanvar) eski sana bilan qotib qolardi.
    const from = d.currentYear ? currentYearStart() : d.from ? new Date(d.from) : undefined;
    // ⚠️ Progress `AuctionSyncRun` jadvaliga yoziladi (ekranda jonli ko'rinadi) —
    // konsol logi faqat yakuniy xulosa.
    const r = await syncAuctionOrders({
      from,
      to: d.to ? new Date(d.to) : undefined,
      credentials: d.credentials,
      startedById: d.startedById,
    });
    const failed = r.perCredential.filter((c) => c.error);
    const mins = Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 60000);
    console.log(
      `[auction-orders] ${r.saved} yozuv, ${mins} daqiqa` +
        (r.filtered ? `, sana oralig'idan tashqari ${r.filtered} ta` : "") +
        (r.skipped ? `, order_id siz ${r.skipped} ta o'tkazildi` : "") +
        (failed.length ? `, XATO akkauntlar: ${failed.map((c) => c.name).join(", ")}` : ""),
    );
  });
  // ⚠️ Kunlik jadval FAQAT JORIY YILNI yangilaydi (foydalanuvchi qarori,
  // 2026-09-07): tugagan auksionlar o'zgarmaydi, ya'ni 2019–2025 yozuvlarini
  // har kecha qayta yozish keraksiz. To'liq yangilash kerak bo'lsa —
  // /dashboard/auksion sahifasidan sanasiz ishga tushiriladi.
  await boss.schedule(
    QUEUE.AUCTION_ORDERS_SYNC,
    "0 4 * * *",
    { currentYear: true },
    { tz: "Asia/Tashkent" },
  );

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
