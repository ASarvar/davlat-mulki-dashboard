-- ─────────────── Rollarni qayta tuzish + username + workflow jadvallar ───────────────

-- 1) Role enum'ni qayta yaratamiz (REGION_USER -> NAZORATCHI ko'chiriladi).
--    Postgres'da enum qiymatini shu tranzaksiyada qo'shib ishlatib bo'lmaydi,
--    shuning uchun butun tipni almashtiramiz.
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'NAZORATCHI', 'VIEWER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING (
  CASE "role"::text WHEN 'REGION_USER' THEN 'NAZORATCHI' ELSE "role"::text END::"Role"
);
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'VIEWER';
DROP TYPE "Role_old";

-- 2) email -> username. Login = email'ning @ dan oldingi qismi.
ALTER TABLE "User" ADD COLUMN "username" TEXT;
UPDATE "User" SET "username" = split_part("email", '@', 1);
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
ALTER TABLE "User" DROP COLUMN "email"; -- unique indeksi ham avtomatik o'chadi

-- 3) Moderator uchun: barcha hudud bayrog'i.
ALTER TABLE "User" ADD COLUMN "allRegions" BOOLEAN NOT NULL DEFAULT false;

-- 4) Moderator ↔ hudud (ko'p-ko'p).
CREATE TABLE "UserRegion" (
    "userId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    CONSTRAINT "UserRegion_pkey" PRIMARY KEY ("userId", "regionId")
);
CREATE INDEX "UserRegion_regionId_idx" ON "UserRegion"("regionId");
ALTER TABLE "UserRegion" ADD CONSTRAINT "UserRegion_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRegion" ADD CONSTRAINT "UserRegion_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) Kategoriya o'zgartirish so'rovi (workflow).
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "CategoryChangeRequest" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "fromCategory" INTEGER,
    "toCategory" INTEGER NOT NULL,
    "note" TEXT,
    "documentId" TEXT,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CategoryChangeRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CategoryChangeRequest_status_idx" ON "CategoryChangeRequest"("status");
CREATE INDEX "CategoryChangeRequest_propertyId_idx" ON "CategoryChangeRequest"("propertyId");
CREATE INDEX "CategoryChangeRequest_requestedById_idx" ON "CategoryChangeRequest"("requestedById");
ALTER TABLE "CategoryChangeRequest" ADD CONSTRAINT "CategoryChangeRequest_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CategoryChangeRequest" ADD CONSTRAINT "CategoryChangeRequest_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CategoryChangeRequest" ADD CONSTRAINT "CategoryChangeRequest_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CategoryChangeRequest" ADD CONSTRAINT "CategoryChangeRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6) Ilova ichidagi bildirishnoma.
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
