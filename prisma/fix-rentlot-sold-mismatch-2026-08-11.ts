// Bir martalik: `hasRentLot=true` bo'lgan, lekin sotilgan (`integrationCategoryCode` 1
// yoki 2) obyektlarni tuzatadi. Sabab: `checkPropertyStatus.ts`da `hasRentLot`
// hisoblanganda `!isSold` sharti yo'q edi (hasPrivatizationLot'da bor edi) — shuning
// uchun sotib bo'lingan obyekt hali ham "Savdoda ijara"/"Auksion savdolarida"
// ustunlarida hisoblanardi. Kod tuzatildi (checkPropertyStatus.ts), bu skript esa
// keyingi to'liq sinxronizatsiyagacha mavjud noto'g'ri bayroqlarni darhol tozalaydi.
//
// Ishlatish:  npx tsx prisma/fix-rentlot-sold-mismatch-2026-08-11.ts
// Serverda:   docker compose run --rm migrate npx tsx prisma/fix-rentlot-sold-mismatch-2026-08-11.ts
//
// Idempotent: qayta ishga tushirilsa 0 ta yozuv o'zgaradi (shart endi hech kimga mos kelmaydi).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const bad = await prisma.property.findMany({
    where: { hasRentLot: true, integrationCategoryCode: { in: [1, 2] } },
    select: { cadNumber: true, integrationCategoryCode: true },
  });
  console.log(`Tuzatiladigan obyektlar: ${bad.length}`);
  for (const p of bad) console.log(`  ${p.cadNumber} (kat ${p.integrationCategoryCode})`);

  const res = await prisma.property.updateMany({
    where: { hasRentLot: true, integrationCategoryCode: { in: [1, 2] } },
    data: { hasRentLot: false },
  });
  console.log(`Tuzatildi: ${res.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
