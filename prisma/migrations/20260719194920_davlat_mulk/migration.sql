-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'REGION_USER', 'VIEWER');

-- CreateEnum
CREATE TYPE "CategorySource" AS ENUM ('INTEGRATION', 'MANUAL');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCING', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncRunType" AS ENUM ('FULL_ALL', 'REGION', 'SINGLE');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "regionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stir" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "code" INTEGER NOT NULL,
    "nameUz" TEXT NOT NULL,
    "source" "CategorySource" NOT NULL,
    "excludeInefficient" BOOLEAN NOT NULL DEFAULT false,
    "requiresDocument" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "cadNumber" TEXT NOT NULL,
    "cadNumberOld" TEXT,
    "regionId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT,
    "address" TEXT,
    "area" DECIMAL(14,2),
    "buildingArea" DECIMAL(14,2),
    "rawApi2" JSONB,
    "integrationCategoryCode" INTEGER,
    "manualCategoryCode" INTEGER,
    "isInefficient" BOOLEAN NOT NULL DEFAULT false,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectStatusCheck" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "apiSource" TEXT NOT NULL,
    "found" BOOLEAN NOT NULL DEFAULT false,
    "matchedByOldCad" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    "rawResponse" JSONB,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObjectStatusCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyCategoryAssignment" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "categoryCode" INTEGER NOT NULL,
    "assignedById" TEXT NOT NULL,
    "documentId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyCategoryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "type" "SyncRunType" NOT NULL,
    "status" "SyncRunStatus" NOT NULL DEFAULT 'QUEUED',
    "triggeredById" TEXT,
    "regionId" TEXT,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_regionId_idx" ON "User"("regionId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- CreateIndex
CREATE INDEX "OrganizationSource_stir_idx" ON "OrganizationSource"("stir");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSource_regionId_stir_key" ON "OrganizationSource"("regionId", "stir");

-- CreateIndex
CREATE UNIQUE INDEX "Property_cadNumber_key" ON "Property"("cadNumber");

-- CreateIndex
CREATE INDEX "Property_cadNumberOld_idx" ON "Property"("cadNumberOld");

-- CreateIndex
CREATE INDEX "Property_regionId_isInefficient_idx" ON "Property"("regionId", "isInefficient");

-- CreateIndex
CREATE INDEX "Property_sourceId_idx" ON "Property"("sourceId");

-- CreateIndex
CREATE INDEX "Property_syncStatus_idx" ON "Property"("syncStatus");

-- CreateIndex
CREATE INDEX "Property_integrationCategoryCode_idx" ON "Property"("integrationCategoryCode");

-- CreateIndex
CREATE INDEX "Property_manualCategoryCode_idx" ON "Property"("manualCategoryCode");

-- CreateIndex
CREATE INDEX "ObjectStatusCheck_apiSource_status_idx" ON "ObjectStatusCheck"("apiSource", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectStatusCheck_propertyId_apiSource_key" ON "ObjectStatusCheck"("propertyId", "apiSource");

-- CreateIndex
CREATE INDEX "PropertyCategoryAssignment_propertyId_idx" ON "PropertyCategoryAssignment"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyCategoryAssignment_categoryCode_idx" ON "PropertyCategoryAssignment"("categoryCode");

-- CreateIndex
CREATE INDEX "Document_propertyId_idx" ON "Document"("propertyId");

-- CreateIndex
CREATE INDEX "SyncRun_status_idx" ON "SyncRun"("status");

-- CreateIndex
CREATE INDEX "SyncRun_createdAt_idx" ON "SyncRun"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSource" ADD CONSTRAINT "OrganizationSource_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "OrganizationSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_integrationCategoryCode_fkey" FOREIGN KEY ("integrationCategoryCode") REFERENCES "Category"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_manualCategoryCode_fkey" FOREIGN KEY ("manualCategoryCode") REFERENCES "Category"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectStatusCheck" ADD CONSTRAINT "ObjectStatusCheck_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyCategoryAssignment" ADD CONSTRAINT "PropertyCategoryAssignment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyCategoryAssignment" ADD CONSTRAINT "PropertyCategoryAssignment_categoryCode_fkey" FOREIGN KEY ("categoryCode") REFERENCES "Category"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyCategoryAssignment" ADD CONSTRAINT "PropertyCategoryAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyCategoryAssignment" ADD CONSTRAINT "PropertyCategoryAssignment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
