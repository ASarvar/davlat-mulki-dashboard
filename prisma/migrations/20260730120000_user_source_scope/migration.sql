-- Foydalanuvchi doirasi HUDUD dan TASHKILOT ga o'tkaziladi.
--
--   User.regionId   → User.sourceId    (IJROCHI uchun aynan bitta tashkilot)
--   User.allRegions → User.allSources  (MODERATOR uchun "hamma tashkilot")
--   UserRegion      → UserSource       (MODERATOR ↔ tashkilot, ko'p-ko'p)
--
-- ⚠️ MA'LUMOT KO'CHIRILMAYDI (foydalanuvchi qarori). Sabab: hudud va tashkilot
-- bir-biriga bo'ysunmaydigan ikki o'lchov — respublika darajasidagi tashkilotlarning
-- (Direksiya, Agentlik markaziy) obyektlari kadastr prefiksi orqali BARCHA hududlarga
-- tarqaladi. "Hududdagi barcha tashkilotlar" deb ko'chirsak, o'sha respublika
-- tashkilotlarining obyektlari yo'qolardi; ularni ham qo'shsak, doira 14 hududga
-- kengayib ketardi. Ta'sirlanadigan foydalanuvchi atigi 4 ta bo'lgani uchun ular
-- Foydalanuvchilar sahifasidan QO'LDA qayta biriktiriladi.
--
-- ⚠️ Migratsiyadan keyin IJROCHI/MODERATOR foydalanuvchilar tashkilotsiz qoladi va
-- hech qanday obyekt ko'rmaydi — ularni darhol biriktirish kerak.

-- ─────────────────── 1. Yangi bog'lanish jadvali ───────────────────
CREATE TABLE "UserSource" (
    "userId"   TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "UserSource_pkey" PRIMARY KEY ("userId", "sourceId")
);

CREATE INDEX "UserSource_sourceId_idx" ON "UserSource"("sourceId");

ALTER TABLE "UserSource"
  ADD CONSTRAINT "UserSource_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserSource"
  ADD CONSTRAINT "UserSource_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "OrganizationSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────── 2. User ustunlari ───────────────────
ALTER TABLE "User" ADD COLUMN "sourceId"   TEXT;
ALTER TABLE "User" ADD COLUMN "allSources" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User"
  ADD CONSTRAINT "User_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "OrganizationSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_sourceId_idx" ON "User"("sourceId");

-- ─────────────────── 3. Eski hudud doirasi ───────────────────
DROP TABLE "UserRegion";

DROP INDEX IF EXISTS "User_regionId_idx";
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_regionId_fkey";
ALTER TABLE "User" DROP COLUMN "regionId";
ALTER TABLE "User" DROP COLUMN "allRegions";
