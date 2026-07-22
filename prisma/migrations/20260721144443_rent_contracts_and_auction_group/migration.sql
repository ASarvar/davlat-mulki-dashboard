-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "auctionGroupName" TEXT,
ADD COLUMN     "rentCheckedAt" TIMESTAMP(3),
ADD COLUMN     "rentContractCount" INTEGER,
ADD COLUMN     "rentContractNumber" TEXT,
ADD COLUMN     "rentDocLink" TEXT,
ADD COLUMN     "rentTenantName" TEXT,
ADD COLUMN     "rentTotalSum" DECIMAL(18,2);
