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
      // ⚠️ Auksion buyurtmalari ham shunday: 14 akkauntning ~3 400 sahifasi
      // ketma-ket yuklanadi (~20–25 daqiqa). 2 soat — katta zaxira bilan.
      expireInSeconds:
        name === QUEUE.IMTIYOZ_YATT_SYNC ? 3600 : name === QUEUE.AUCTION_ORDERS_SYNC ? 7200 : 120,
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
