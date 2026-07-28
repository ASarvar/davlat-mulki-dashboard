-- STATUS_REFRESH sinxronizatsiya turi: API1/2 (kashfiyot) siz, mavjud obyektlarga
-- to'g'ridan-to'g'ri holat-API'lar (3-6) qayta ishga tushiriladi. Soha (manba) kesimi
-- va qaysi modul(lar) yangilanishini belgilaydigan bayroqlar qo'shiladi.
--
-- Enum qayta yaratiladi (ALTER TYPE ADD VALUE tranzaksiya ichida ishonchsiz — loyihada
-- avval ham shu sabab bilan qochilgan, CLAUDE.md ga qarang).

ALTER TYPE "SyncRunType" RENAME TO "SyncRunType_old";

CREATE TYPE "SyncRunType" AS ENUM ('FULL_ALL', 'REGION', 'SINGLE', 'STATUS_REFRESH');

ALTER TABLE "SyncRun" ALTER COLUMN "type" TYPE "SyncRunType" USING ("type"::text)::"SyncRunType";

DROP TYPE "SyncRunType_old";

ALTER TABLE "SyncRun"
  ADD COLUMN "sourceName"     TEXT,
  ADD COLUMN "refreshBase"    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "refreshAuction" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "refreshRent"    BOOLEAN NOT NULL DEFAULT true;
