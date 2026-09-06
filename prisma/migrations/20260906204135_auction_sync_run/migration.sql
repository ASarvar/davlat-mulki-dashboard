-- CreateEnum
CREATE TYPE "AuctionSyncStatus" AS ENUM ('RUNNING', 'DONE', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "AuctionSyncRun" (
    "id" TEXT NOT NULL,
    "status" "AuctionSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "credential" TEXT,
    "credentialIndex" INTEGER NOT NULL DEFAULT 0,
    "credentialTotal" INTEGER NOT NULL DEFAULT 0,
    "page" INTEGER NOT NULL DEFAULT 0,
    "pages" INTEGER NOT NULL DEFAULT 0,
    "saved" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "perCredential" JSONB,
    "error" TEXT,
    "startedById" TEXT,

    CONSTRAINT "AuctionSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuctionSyncRun_startedAt_idx" ON "AuctionSyncRun"("startedAt");

-- CreateIndex
CREATE INDEX "AuctionSyncRun_status_idx" ON "AuctionSyncRun"("status");
