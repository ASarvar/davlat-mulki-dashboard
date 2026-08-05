// Bir martalik: `Property.isLand` ni saqlangan `rawApi2` dan hisoblaydi (barcha
// obyektlar uchun — dashboard jadvalida faqat Davlat aktivlari agentligi va
// Direksiya uchun ko'rsatiladi, lekin hisoblash hammasiga bir xil).
// Tashqi API'ga MUROJAAT QILMAYDI (xom javob bazada saqlanadi) — bir necha soniya.
//
// Ishlatish:  npx tsx prisma/fix-land-classification-2026-08-05.ts
// Serverda:   docker compose run --rm migrate npx tsx prisma/fix-land-classification-2026-08-05.ts
//
// Idempotent: qayta ishga tushirilsa faqat farqli qatorlarni yangilaydi.
import { PrismaClient, Prisma } from "@prisma/client";
import { isLandOnly } from "../src/lib/area";

const prisma = new PrismaClient();
const BATCH = 500;

async function main() {
  const rows = await prisma.property.findMany({
    where: { NOT: { rawApi2: { equals: Prisma.DbNull } } },
    select: { id: true, isLand: true, rawApi2: true },
  });
  console.log(`rawApi2 bor obyektlar: ${rows.length}`);

  const updates: { id: string; isLand: boolean }[] = [];
  let unchanged = 0;

  for (const r of rows) {
    const next = isLandOnly(r.rawApi2 as Record<string, unknown> | null);
    if (next === r.isLand) {
      unchanged++;
      continue;
    }
    updates.push({ id: r.id, isLand: next });
  }

  console.log(`O'zgarmaydi: ${unchanged}`);
  console.log(`Yangilanadi: ${updates.length}\n`);

  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH);
    await prisma.$transaction(
      chunk.map((u) => prisma.property.update({ where: { id: u.id }, data: { isLand: u.isLand } })),
    );
    console.log(`  ${Math.min(i + BATCH, updates.length)} / ${updates.length}`);
  }

  const landCount = await prisma.property.count({ where: { isLand: true } });
  console.log(`\n✓ ${updates.length} ta obyektning Yer/Bino belgisi yangilandi. Jami YER: ${landCount}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
