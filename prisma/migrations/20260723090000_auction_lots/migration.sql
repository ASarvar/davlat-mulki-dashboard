-- Bitta kadastr obyekti bo'lib-bo'lib bir nechta auksion lotga chiqarilishi mumkin
-- (real ma'lumotda bitta obyektda 13 tagacha ijara loti), va obyekt bir vaqtda
-- HAM xususiylashtirish, HAM ijara savdosida bo'lishi mumkin (46 ta shunday holat).

CREATE TYPE "AuctionLotType" AS ENUM ('PRIVATIZATION', 'RENT');

CREATE TABLE "AuctionLot" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "type" "AuctionLotType" NOT NULL,
    "lotNumber" TEXT,
    "orderId" INTEGER,
    "area" DECIMAL(14,2),
    "startPrice" DECIMAL(18,2),
    "auctionDate" TIMESTAMP(3),
    "lotStatus" TEXT,
    "orderStatus" TEXT,
    "name" TEXT,
    "matchedByOldCad" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionLot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuctionLot_propertyId_idx" ON "AuctionLot"("propertyId");
CREATE INDEX "AuctionLot_lotNumber_idx" ON "AuctionLot"("lotNumber");
CREATE INDEX "AuctionLot_type_idx" ON "AuctionLot"("type");

ALTER TABLE "AuctionLot" ADD CONSTRAINT "AuctionLot_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Filtr/aggregat uchun bayroqlar (Prisma bilan bog'liq jadvalni sanash sekin).
ALTER TABLE "Property" ADD COLUMN "hasPrivatizationLot" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Property" ADD COLUMN "hasRentLot" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Property" ADD COLUMN "auctionTotalArea" DECIMAL(14,2);

CREATE INDEX "Property_hasPrivatizationLot_idx" ON "Property"("hasPrivatizationLot");
CREATE INDEX "Property_hasRentLot_idx" ON "Property"("hasRentLot");
