// Bir martalik: mavjud obyektlarga `Property.gasLastPaymentAt` ni to'ldiradi.
//
// Tashqi API'ga UMUMAN chaqirmaydi — qiymat `ObjectStatusCheck.rawResponse` da saqlangan
// gaz javobidan qayta o'qiladi (CLAUDE.md: "xom javoblarni saqlashda davom eting —
// mantiq o'zgarsa API'ni qayta chaqirmasdan qayta hisoblash mumkin").
//
// Ishlatish:  npx tsx prisma/backfill-gas-payment-2026-08-17.ts
// Serverda:   docker compose run --rm migrate npx tsx prisma/backfill-gas-payment-2026-08-17.ts
//
// Idempotent: qayta ishga tushirilsa bir xil qiymatlarni qayta yozadi, zarar yo'q.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { parseUtilityRaw } from "../src/server/integrations/utilities";

const prisma = new PrismaClient();

async function main() {
  const checks = await prisma.objectStatusCheck.findMany({
    where: { apiSource: "GAS", found: true },
    select: { propertyId: true, rawResponse: true },
  });
  console.log(`Gaz yozuvlari: ${checks.length}`);

  let filled = 0;
  let noDate = 0;
  for (const c of checks) {
    const info = parseUtilityRaw("GAS", c.rawResponse);
    if (!info.lastPaymentAt) {
      noDate++;
      continue;
    }
    await prisma.property.update({
      where: { id: c.propertyId },
      data: { gasLastPaymentAt: info.lastPaymentAt },
    });
    filled++;
  }

  console.log(`To'ldirildi: ${filled}, sanasi yo'q: ${noDate}`);

  const months = Number(process.env.UTILITY_RECENT_PAYMENT_MONTHS ?? 3);
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const recent = await prisma.property.count({ where: { gasLastPaymentAt: { gte: cutoff } } });
  console.log(`Oxirgi ${months} oyda to'lov bo'lgan obyektlar: ${recent}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
