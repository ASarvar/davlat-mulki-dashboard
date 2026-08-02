// Bir martalik: `Property.area` (binoning umumiy maydoni) ni saqlangan `rawApi2` dan
// yangi zanjir bo'yicha qayta hisoblaydi:
//   `object_area_p` → `object_area` → `land_area` → `land_area_i`
// Tashqi API'ga MUROJAAT QILMAYDI (xom javob bazada saqlanadi) — bir necha soniya.
//
// Ishlatish:  npx tsx prisma/fix-total-area-2026-07-31.ts
// Serverda:   docker compose run --rm migrate npx tsx prisma/fix-total-area-2026-07-31.ts
//
// Idempotent: qayta ishga tushirilsa faqat farqli qatorlarni yangilaydi.
import { PrismaClient, Prisma } from "@prisma/client";
import { totalBuildingArea } from "../src/lib/area";

const prisma = new PrismaClient();
const BATCH = 500;

async function main() {
  const rows = await prisma.property.findMany({
    where: { NOT: { rawApi2: { equals: Prisma.DbNull } } },
    select: { id: true, cadNumber: true, area: true, rawApi2: true },
  });
  console.log(`rawApi2 bor obyektlar: ${rows.length}`);

  const updates: { id: string; area: number }[] = [];
  let unchanged = 0;
  let stillEmpty = 0;

  for (const r of rows) {
    const next = totalBuildingArea(r.rawApi2 as Record<string, unknown> | null);
    if (next == null) {
      stillEmpty++;
      continue;
    }
    const current = r.area != null ? Number(r.area) : null;
    if (current !== null && Math.abs(current - next) < 0.005) {
      unchanged++;
      continue;
    }
    updates.push({ id: r.id, area: next });
  }

  console.log(`O'zgarmaydi: ${unchanged}`);
  console.log(`Zanjirdagi hammasi 0 (bo'sh qoladi): ${stillEmpty}`);
  console.log(`Yangilanadi: ${updates.length}\n`);

  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH);
    await prisma.$transaction(
      chunk.map((u) =>
        prisma.property.update({ where: { id: u.id }, data: { area: new Prisma.Decimal(u.area) } }),
      ),
    );
    console.log(`  ${Math.min(i + BATCH, updates.length)} / ${updates.length}`);
  }

  console.log(`\n✓ ${updates.length} ta obyektning "Binoning umumiy maydoni" yangilandi.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
