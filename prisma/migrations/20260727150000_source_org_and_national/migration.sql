-- Manba modelini kengaytirish:
--   1. `orgName` — to'liq rasmiy tashkilot nomi (`name` endi FAQAT soha/guruh nomi).
--   2. `regionId` ixtiyoriy — respublika darajasidagi manbalar (Agentlik, Direksiya)
--      hech qanday hududga biriktirilmaydi.
--   3. STIR global unikal — `(regionId, stir)` juftligi yaroqsiz: regionId NULL bo'lganda
--      Postgres NULL'larni farqli deb hisoblaydi va dublikatni o'tkazib yuborardi.
--   4. `Region.cadastrePrefix` — hududsiz manbaning obyektlarini kadastr raqamidan
--      to'g'ri hududga joylashtirish uchun.

-- ─────────────────── 1. Region.cadastrePrefix ───────────────────
ALTER TABLE "Region" ADD COLUMN "cadastrePrefix" TEXT;

-- Jonli ma'lumotda tasdiqlangan mapping (2419 obyekt, 100% mos).
UPDATE "Region" SET "cadastrePrefix" = '10' WHERE "code" = 'TAS_CITY';
UPDATE "Region" SET "cadastrePrefix" = '11' WHERE "code" = 'TAS';
UPDATE "Region" SET "cadastrePrefix" = '12' WHERE "code" = 'SIR';
UPDATE "Region" SET "cadastrePrefix" = '13' WHERE "code" = 'JIZ';
UPDATE "Region" SET "cadastrePrefix" = '14' WHERE "code" = 'SAM';
UPDATE "Region" SET "cadastrePrefix" = '15' WHERE "code" = 'FAR';
UPDATE "Region" SET "cadastrePrefix" = '16' WHERE "code" = 'NAM';
UPDATE "Region" SET "cadastrePrefix" = '17' WHERE "code" = 'AND';
UPDATE "Region" SET "cadastrePrefix" = '18' WHERE "code" = 'QAS';
UPDATE "Region" SET "cadastrePrefix" = '19' WHERE "code" = 'SUR';
UPDATE "Region" SET "cadastrePrefix" = '20' WHERE "code" = 'BUX';
UPDATE "Region" SET "cadastrePrefix" = '21' WHERE "code" = 'NAV';
UPDATE "Region" SET "cadastrePrefix" = '22' WHERE "code" = 'XOR';
UPDATE "Region" SET "cadastrePrefix" = '23' WHERE "code" = 'QQR';

CREATE UNIQUE INDEX "Region_cadastrePrefix_key" ON "Region"("cadastrePrefix");

-- ─────────────────── 2. OrganizationSource ───────────────────
ALTER TABLE "OrganizationSource" ADD COLUMN "orgName" TEXT;

-- Mavjud 14 manbaning rasmiy nomlarini tiklaymiz (foydalanuvchi UI'da ularni "Ijara
-- markazi" deb qayta nomlaganida uzun rasmiy nom yo'qolgan edi). `name` tegilmaydi.
UPDATE "OrganizationSource" s SET "orgName" =
  'Davlat obyektlaridan foydalanish markazi ' || r."name" || ' hududiy boshqarmasi'
FROM "Region" r WHERE r.id = s."regionId" AND s."orgName" IS NULL;

-- regionId ixtiyoriy bo'ladi
ALTER TABLE "OrganizationSource" ALTER COLUMN "regionId" DROP NOT NULL;

-- (regionId, stir) -> global unique(stir).
-- Bazada dublikat STIR yo'qligi oldindan tekshirilgan.
DROP INDEX IF EXISTS "OrganizationSource_regionId_stir_key";
CREATE UNIQUE INDEX "OrganizationSource_stir_key" ON "OrganizationSource"("stir");
CREATE INDEX "OrganizationSource_name_idx" ON "OrganizationSource"("name");
