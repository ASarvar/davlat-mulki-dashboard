-- Ikki bosqichli tasdiqlash + RAHBARIYAT roli + rasm ilovalari.
--
--  1. Role: NAZORATCHI → IJROCHI (nomi o'zgardi), yangi RAHBARIYAT roli.
--  2. ChangeRequestStatus: PENDING → PENDING_MODERATOR, yangi PENDING_RAHBARIYAT.
--  3. CategoryChangeRequest: reviewed* → moderator*, yangi rahbar* uchligi.
--  4. Document.parentId — asosiy PDF'ga ilova qilingan rasmlar (kaskad o'chadi).
--
-- Enum'lar qayta yaratiladi (ALTER TYPE ADD VALUE tranzaksiya ichida ishonchsiz).

-- ─────────────────────────── 1. Role ───────────────────────────
ALTER TYPE "Role" RENAME TO "Role_old";

CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'RAHBARIYAT', 'MODERATOR', 'IJROCHI', 'VIEWER');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role"
  USING (CASE "role"::text WHEN 'NAZORATCHI' THEN 'IJROCHI' ELSE "role"::text END)::"Role";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'VIEWER';

DROP TYPE "Role_old";

-- ──────────────────── 2. ChangeRequestStatus ────────────────────
ALTER TYPE "ChangeRequestStatus" RENAME TO "ChangeRequestStatus_old";

CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING_MODERATOR', 'PENDING_RAHBARIYAT', 'APPROVED', 'REJECTED');

ALTER TABLE "CategoryChangeRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CategoryChangeRequest"
  ALTER COLUMN "status" TYPE "ChangeRequestStatus"
  USING (CASE "status"::text WHEN 'PENDING' THEN 'PENDING_MODERATOR' ELSE "status"::text END)::"ChangeRequestStatus";
ALTER TABLE "CategoryChangeRequest" ALTER COLUMN "status" SET DEFAULT 'PENDING_MODERATOR';

DROP TYPE "ChangeRequestStatus_old";

-- ───────────────── 3. CategoryChangeRequest maydonlari ─────────────────
-- Mavjud "reviewed*" yozuvlari moderator qarorlari edi — shuning uchun nom almashtiriladi.
ALTER TABLE "CategoryChangeRequest" RENAME COLUMN "reviewedById" TO "moderatorId";
ALTER TABLE "CategoryChangeRequest" RENAME COLUMN "reviewNote"   TO "moderatorNote";
ALTER TABLE "CategoryChangeRequest" RENAME COLUMN "reviewedAt"   TO "moderatorAt";

ALTER TABLE "CategoryChangeRequest"
  RENAME CONSTRAINT "CategoryChangeRequest_reviewedById_fkey" TO "CategoryChangeRequest_moderatorId_fkey";

ALTER TABLE "CategoryChangeRequest"
  ADD COLUMN "rahbarId"   TEXT,
  ADD COLUMN "rahbarNote" TEXT,
  ADD COLUMN "rahbarAt"   TIMESTAMP(3);

ALTER TABLE "CategoryChangeRequest"
  ADD CONSTRAINT "CategoryChangeRequest_rahbarId_fkey"
  FOREIGN KEY ("rahbarId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ───────────────── 4. Document — rasm ilovalari ─────────────────
ALTER TABLE "Document" ADD COLUMN "parentId" TEXT;

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Document_parentId_idx" ON "Document"("parentId");
