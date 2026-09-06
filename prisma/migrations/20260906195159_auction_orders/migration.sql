-- CreateTable
CREATE TABLE "AuctionOrder" (
    "orderId" INTEGER NOT NULL,
    "oldOrderId" INTEGER,
    "newOrderId" INTEGER,
    "credential" TEXT NOT NULL,
    "name" TEXT,
    "region" TEXT,
    "regionSoato" TEXT,
    "area" TEXT,
    "areaSoato" TEXT,
    "address" TEXT,
    "groupName" TEXT,
    "categoryName" TEXT,
    "categoryId" INTEGER,
    "orderStatus" TEXT,
    "orderStatusesId" INTEGER,
    "lotStatus" TEXT,
    "lotStatusesId" INTEGER,
    "lotNumber" TEXT,
    "startPrice" DECIMAL(18,2),
    "paidPrice" DECIMAL(18,2),
    "soldPrice" DECIMAL(18,2),
    "centerFee" DECIMAL(18,2),
    "fullPricePaid" INTEGER,
    "withDiscount" INTEGER,
    "termPayment" INTEGER,
    "termMonth" INTEGER,
    "lotPlaceDate" TIMESTAMP(3),
    "auctionDate" TIMESTAMP(3),
    "firstLotPlaceDate" TIMESTAMP(3),
    "firstAuctionDate" TIMESTAMP(3),
    "lotAcceptedTime" TIMESTAMP(3),
    "customerName" TEXT,
    "customerInn" TEXT,
    "customerSoato" TEXT,
    "winnerName" TEXT,
    "winnerInn" TEXT,
    "winnerPassport" TEXT,
    "winnerPinfl" TEXT,
    "winnerPhone" TEXT,
    "winnerAddress" TEXT,
    "winnerPassportDate" TIMESTAMP(3),
    "winnerPassportIssuedBy" TEXT,
    "winnerSubjectType" INTEGER,
    "bankName" TEXT,
    "bankMfo" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "protocolFileUrl" TEXT,
    "isDowngradeAuction" INTEGER,
    "propSet" INTEGER,
    "acceptState" INTEGER,
    "score" DOUBLE PRECISION,
    "raw" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionOrder_pkey" PRIMARY KEY ("orderId")
);

-- CreateIndex
CREATE INDEX "AuctionOrder_credential_idx" ON "AuctionOrder"("credential");

-- CreateIndex
CREATE INDEX "AuctionOrder_region_idx" ON "AuctionOrder"("region");

-- CreateIndex
CREATE INDEX "AuctionOrder_auctionDate_idx" ON "AuctionOrder"("auctionDate");

-- CreateIndex
CREATE INDEX "AuctionOrder_orderStatusesId_idx" ON "AuctionOrder"("orderStatusesId");

-- CreateIndex
CREATE INDEX "AuctionOrder_lotNumber_idx" ON "AuctionOrder"("lotNumber");

-- CreateIndex
CREATE INDEX "AuctionOrder_customerInn_idx" ON "AuctionOrder"("customerInn");
