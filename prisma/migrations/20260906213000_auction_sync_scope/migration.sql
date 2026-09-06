-- Auksion sinxronizatsiyasining DOIRASI: sana oralig'i va akkauntlar.
--
-- ⚠️ Qo'lda yozilgan: `prisma migrate dev` bu bazada ishlamaydi, chunki pg_trgm
-- GIN indekslari migratsiyadan TASHQARIDA qo'llanadi (`prisma/apply-indexes.ts`)
-- va Prisma ularni "drift" deb ko'rib, butun bazani reset qilishni taklif qiladi.
-- Loyihadagi mavjud naqsh shu — yangi migratsiyalarni ham shunday yozing.

ALTER TABLE "AuctionSyncRun"
  ADD COLUMN "filtered" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "scopeFrom" TIMESTAMP(3),
  ADD COLUMN "scopeTo" TIMESTAMP(3),
  ADD COLUMN "scopeCredentials" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
