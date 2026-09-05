/**
 * Koordinatalarni MAVJUD ma'lumotdan to'ldirish — tashqi API'ga BITTA ham so'rov yo'q.
 *
 * Manba: `ObjectStatusCheck.rawResponse` → `$.api4.lat/lng` (`apiSource = 'AUCTION'`).
 * Bu javoblar allaqachon saqlangan (CLAUDE.md: "xom javoblarni saqlashda davom eting" —
 * aynan shu holat uchun: mantiq o'zgarganda API'ni qayta chaqirmasdan qayta hisoblash).
 *
 * ⚠️ `found: true` sharti QO'YILMAYDI: koordinata API 4 ning `order` obyektida,
 * `found` esa API 3 lotiga bog'liq. Filtr qo'yilsa yozuvlarning bir qismi yo'qolardi.
 *
 * ⚠️ Idempotent: qayta ishga tushirilsa bir xil qiymat qayta yoziladi, zarar yo'q.
 *
 * Ishga tushirish:
 *   dev:     npx tsx prisma/backfill-coordinates-2026-09-05.ts
 *   docker:  docker compose run --rm migrate npx tsx prisma/backfill-coordinates-2026-09-05.ts
 */
import { prisma } from "../src/lib/prisma";
import { pickAuctionCoords, parseCoord, isInUzbekistan } from "../src/lib/geo";

const BATCH = 500;

async function main() {
  const started = Date.now();
  let cursor: string | undefined;
  let seen = 0;
  let written = 0;
  let noCoords = 0;
  let outOfBounds = 0;

  for (;;) {
    const rows = await prisma.objectStatusCheck.findMany({
      where: { apiSource: "AUCTION" },
      select: { id: true, propertyId: true, rawResponse: true },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;
    seen += rows.length;

    for (const r of rows) {
      const raw = r.rawResponse as { api4?: unknown } | null;
      const order = raw?.api4;
      const coords = pickAuctionCoords(order);

      if (!coords) {
        // Chegaradan tashqarida qolganini alohida sanaymiz — bu ma'lumot sifati signali.
        const o = (order ?? {}) as Record<string, unknown>;
        const lat = parseCoord(o.lat);
        const lng = parseCoord(o.lng);
        if (lat != null && lng != null && !isInUzbekistan(lat, lng)) outOfBounds++;
        else noCoords++;
        continue;
      }

      await prisma.property.update({
        where: { id: r.propertyId },
        data: { lat: coords.lat, lng: coords.lng, coordSource: "AUCTION", coordsAt: new Date() },
      });
      written++;
    }
    process.stdout.write(`\r  ko'rildi ${seen}, yozildi ${written}...`);
  }

  const total = await prisma.property.count({ where: { removedFromBalance: false } });
  const withCoords = await prisma.property.count({
    where: { removedFromBalance: false, lat: { not: null }, lng: { not: null } },
  });
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  console.log("\n──────────────────────────────────────────");
  console.log(`  AUCTION yozuvlari ko'rildi : ${seen}`);
  console.log(`  Koordinata yozildi         : ${written}`);
  console.log(`  Koordinatasiz javob        : ${noCoords}`);
  console.log(`  Chegaradan tashqari        : ${outOfBounds}   (0 bo'lishi kutiladi)`);
  console.log(`  Balansdagi obyektlar       : ${total}`);
  console.log(`  Shundan koordinatali       : ${withCoords}  (${((withCoords / total) * 100).toFixed(1)}%)`);
  console.log(`  Vaqt                       : ${secs}s`);

  const byRegion = await prisma.$queryRawUnsafe<{ name: string; n: number }[]>(`
    SELECT r.name, COUNT(*)::int AS n
    FROM "Property" p JOIN "Region" r ON r.id = p."regionId"
    WHERE p."removedFromBalance" = false AND p.lat IS NOT NULL
    GROUP BY r.name ORDER BY n DESC
  `);
  console.log(`  Hududlar bo'yicha          : ${byRegion.length} ta hududda`);
  for (const r of byRegion) console.log(`      ${r.name.padEnd(22)} ${r.n}`);
}

main()
  .catch((e) => {
    console.error("XATO:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
