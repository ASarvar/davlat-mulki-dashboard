import PgBoss from "pg-boss";
import { env } from "@/lib/env";
import { QUEUE } from "./jobs";

// pg-boss singleton (Postgres-native queue — Redis YO'Q).
// Lazy: birinchi getBoss() chaqirilganda ishga tushadi (build vaqtida emas).
const globalForBoss = globalThis as unknown as { bossStart?: Promise<PgBoss> };

async function createAndStart(): Promise<PgBoss> {
  const boss = new PgBoss({ connectionString: env.DATABASE_URL });
  boss.on("error", (e) => console.error("[pg-boss] error:", e));
  await boss.start();

  // v10: queue'lar oldindan yaratilishi shart. Retry — crash-resilience uchun
  // (biz odatda xatoni tashlamaymiz; bu faqat process qulasa ishlaydi).
  for (const name of Object.values(QUEUE)) {
    await boss.createQueue(name, {
      name,
      retryLimit: 2,
      retryDelay: 5,
      retryBackoff: true,
      // ⚠️ YATT indeksini qayta qurish butun respublika ro'yxatini (150+ sahifa,
      // ~76 000 yozuv) yuklaydi va odatda bir necha daqiqa oladi. Umumiy 120s
      // limitida job o'rtasida "expired" bo'lib, keyin qayta ishga tushardi —
      // ya'ni indeks hech qachon yakunlanmasdi.
      // ⚠️ Auksion buyurtmalari: 14 akkauntning ~1 364 sahifasi (per_page=50,
      // sahifalar 4 tadan parallel) — jonli o'lchov 2026-09-07: **71 yozuv/s**,
      // ya'ni 68 000 yozuv uchun **~16 daqiqa**. 30 daqiqa ≈ 2× zaxira.
      // (Sekinlikning asosiy sababi bizda emas: server sahifa chuqurlashgani sari
      // sekinlashadi — 2-sahifa 343 ms, 99-sahifa 2 303 ms, klassik OFFSET narxi.)
      //
      // ⚠️ Bundan KATTA qiymat qo'ymang: `expireInSeconds` ayni paytda "worker
      // o'lsa job qachon qayta uriniladi" degani ham. Dastlab 7200 (2 soat)
      // qo'yilgan edi va worker to'xtaganda job 2 soat davomida `active` bo'lib
      // osilib qoldi — qayta ishga tushirish ham, ekrandagi ko'rsatkich ham
      // bloklanardi (ishlab chiqishda aynan shu holat chiqdi).
      expireInSeconds:
        name === QUEUE.IMTIYOZ_YATT_SYNC
          ? 3600
          : name === QUEUE.AUCTION_ORDERS_SYNC || name === QUEUE.AUCTION_DETAILS_SYNC
            ? 1800
            : 120,
    });
  }
  return boss;
}

export function getBoss(): Promise<PgBoss> {
  if (!globalForBoss.bossStart) globalForBoss.bossStart = createAndStart();
  return globalForBoss.bossStart;
}

export async function stopBoss(): Promise<void> {
  if (!globalForBoss.bossStart) return;
  const boss = await globalForBoss.bossStart;
  await boss.stop({ graceful: true });
  globalForBoss.bossStart = undefined;
}
