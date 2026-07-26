// pg_trgm GIN indekslarini idempotent qo'llash.
// Ishlatish: `npm run db:indexes` (migrate + seed'dan keyin bir marta / har build'da xavfsiz).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const sql = readFileSync(join(process.cwd(), "prisma", "sql", "pg_trgm.sql"), "utf8");
  // Har bir statementni alohida bajaramiz (CREATE INDEX transaction ichida bo'lmasligi mumkin).
  // ⚠️ Izoh qatorlari HAR BIR bo'lakdan olib tashlanadi, so'ng bo'shlari filtrlanadi.
  // Ilgari butun bo'lak `startsWith("--")` bo'yicha tashlanardi — natijada fayl boshidagi
  // izohlar bilan birga birinchi statement (CREATE EXTENSION pg_trgm) ham yo'qolib ketardi.
  // Toza bazada bu "gin_trgm_ops does not exist" xatosini bergan.
  const statements = sql
    .split(";")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
    console.log("✓", stmt.split("\n")[0].slice(0, 70));
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
