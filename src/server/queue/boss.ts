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
      expireInSeconds: 120,
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
