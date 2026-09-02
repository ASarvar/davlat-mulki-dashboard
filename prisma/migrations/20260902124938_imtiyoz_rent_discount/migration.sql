-- CreateEnum
CREATE TYPE "ImtiyozResultCode" AS ENUM ('ELIGIBLE', 'NOT_ELIGIBLE', 'NO_WORKERS', 'INCONCLUSIVE_SOLIQ', 'INCONCLUSIVE_TIEK', 'INCONCLUSIVE_YATT_INDEX');

-- CreateEnum
CREATE TYPE "ImtiyozSubjectType" AS ENUM ('STIR', 'JSHSHIR');

-- CreateEnum
CREATE TYPE "ImtiyozWorkerStatus" AS ENUM ('DISABLED', 'NOT_DISABLED', 'NOT_FOUND', 'FAILED');

-- DropIndex
DROP INDEX "Property_electricLastPaymentAt_idx";

-- DropIndex
DROP INDEX "Property_hasPrivatizationLot_idx";

-- DropIndex
DROP INDEX "Property_hasRentLot_idx";

-- DropIndex
DROP INDEX "Property_vacantArea_idx";

-- CreateTable
CREATE TABLE "ImtiyozCheck" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "sourceRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "username" TEXT NOT NULL,
    "clientIp" TEXT,
    "subjectId" TEXT NOT NULL,
    "subjectType" "ImtiyozSubjectType" NOT NULL,
    "year" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "isRetry" BOOLEAN NOT NULL DEFAULT false,
    "fromCache" BOOLEAN NOT NULL DEFAULT false,
    "resultCode" "ImtiyozResultCode" NOT NULL,
    "isEligible" BOOLEAN,
    "totalWorkers" INTEGER NOT NULL,
    "checkedCount" INTEGER NOT NULL,
    "disabledCount" INTEGER NOT NULL,
    "requiredCount" INTEGER NOT NULL,
    "disabledPercentage" DOUBLE PRECISION,
    "notDisabledCount" INTEGER NOT NULL DEFAULT 0,
    "notFoundCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "yattIndexIncomplete" BOOLEAN NOT NULL DEFAULT false,
    "yattIndexReady" BOOLEAN NOT NULL DEFAULT true,
    "soliqError" TEXT,
    "message" TEXT NOT NULL,
    "durationMs" INTEGER,
    "appVersion" TEXT,

    CONSTRAINT "ImtiyozCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImtiyozCheckWorker" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "ord" INTEGER NOT NULL,
    "pinfl" TEXT NOT NULL,
    "position" TEXT,
    "rate" TEXT,
    "status" "ImtiyozWorkerStatus" NOT NULL,
    "fullName" TEXT,
    "birthOn" TEXT,
    "disabilityGroup" INTEGER,
    "disabilityStartOn" TEXT,
    "disabilityEndOn" TEXT,
    "icd10Code" TEXT,
    "fromCache" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,

    CONSTRAINT "ImtiyozCheckWorker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImtiyozYattWorker" (
    "entrepreneurPinfl" TEXT NOT NULL,
    "workerPinfl" TEXT NOT NULL,

    CONSTRAINT "ImtiyozYattWorker_pkey" PRIMARY KEY ("entrepreneurPinfl","workerPinfl")
);

-- CreateTable
CREATE TABLE "ImtiyozYattSync" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "syncing" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "totalPages" INTEGER NOT NULL DEFAULT 0,
    "failedPages" INTEGER NOT NULL DEFAULT 0,
    "entrepreneurCount" INTEGER NOT NULL DEFAULT 0,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImtiyozYattSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImtiyozTiekCache" (
    "pinfl" TEXT NOT NULL,
    "isDisabled" BOOLEAN NOT NULL,
    "notFound" BOOLEAN NOT NULL DEFAULT false,
    "person" JSONB,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImtiyozTiekCache_pkey" PRIMARY KEY ("pinfl")
);

-- CreateTable
CREATE TABLE "ImtiyozResultCache" (
    "key" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImtiyozResultCache_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImtiyozCheck_requestId_key" ON "ImtiyozCheck"("requestId");

-- CreateIndex
CREATE INDEX "ImtiyozCheck_createdAt_idx" ON "ImtiyozCheck"("createdAt");

-- CreateIndex
CREATE INDEX "ImtiyozCheck_subjectId_createdAt_idx" ON "ImtiyozCheck"("subjectId", "createdAt");

-- CreateIndex
CREATE INDEX "ImtiyozCheck_username_createdAt_idx" ON "ImtiyozCheck"("username", "createdAt");

-- CreateIndex
CREATE INDEX "ImtiyozCheck_resultCode_createdAt_idx" ON "ImtiyozCheck"("resultCode", "createdAt");

-- CreateIndex
CREATE INDEX "ImtiyozCheckWorker_checkId_idx" ON "ImtiyozCheckWorker"("checkId");

-- CreateIndex
CREATE INDEX "ImtiyozCheckWorker_pinfl_idx" ON "ImtiyozCheckWorker"("pinfl");

-- CreateIndex
CREATE INDEX "ImtiyozYattWorker_entrepreneurPinfl_idx" ON "ImtiyozYattWorker"("entrepreneurPinfl");

-- CreateIndex
CREATE INDEX "ImtiyozTiekCache_checkedAt_idx" ON "ImtiyozTiekCache"("checkedAt");

-- CreateIndex
CREATE INDEX "ImtiyozResultCache_expiresAt_idx" ON "ImtiyozResultCache"("expiresAt");

-- AddForeignKey
ALTER TABLE "ImtiyozCheck" ADD CONSTRAINT "ImtiyozCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImtiyozCheckWorker" ADD CONSTRAINT "ImtiyozCheckWorker_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "ImtiyozCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
