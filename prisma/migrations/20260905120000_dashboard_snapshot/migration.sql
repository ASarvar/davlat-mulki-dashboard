-- Kunlik snapshot: boshqaruv panelidagi ko'rsatkichlarning TARIXI.
-- Gran — (day, sourceId, regionId), uchalasi ham NOT NULL va birgalikda birlamchi kalit.
-- ⚠️ Tarixni backfill qilib bo'lmaydi: o'tmishdagi holat hech qayerda saqlanmagan.

-- CreateTable
CREATE TABLE "DashboardSnapshot" (
    "day" DATE NOT NULL,
    "sourceId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "totalObjects" INTEGER NOT NULL,
    "vacantObjects" INTEGER NOT NULL,
    "vacantBuildings" INTEGER NOT NULL,
    "rentedObjects" INTEGER NOT NULL,
    "contractCount" INTEGER NOT NULL,
    "rentArea" DECIMAL(18,2) NOT NULL,
    "rentSum" DECIMAL(20,2) NOT NULL,
    "vacantArea" DECIMAL(18,2) NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardSnapshot_pkey" PRIMARY KEY ("day","sourceId","regionId")
);

-- CreateIndex
CREATE INDEX "DashboardSnapshot_day_idx" ON "DashboardSnapshot"("day");

-- AddForeignKey
ALTER TABLE "DashboardSnapshot" ADD CONSTRAINT "DashboardSnapshot_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "OrganizationSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardSnapshot" ADD CONSTRAINT "DashboardSnapshot_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;
