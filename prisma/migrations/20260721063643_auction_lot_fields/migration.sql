-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "auctionCheckedAt" TIMESTAMP(3),
ADD COLUMN     "auctionOrderId" INTEGER,
ADD COLUMN     "auctionStatus" TEXT,
ADD COLUMN     "auctionStatusId" INTEGER,
ADD COLUMN     "lotNumber" TEXT,
ADD COLUMN     "lotStatus" TEXT,
ADD COLUMN     "paymentTermMonths" INTEGER;

-- CreateIndex
CREATE INDEX "Property_lotNumber_idx" ON "Property"("lotNumber");
