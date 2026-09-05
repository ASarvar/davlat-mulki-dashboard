-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "coordSource" TEXT,
ADD COLUMN     "coordsAt" TIMESTAMP(3),
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Property_lat_lng_idx" ON "Property"("lat", "lng");
