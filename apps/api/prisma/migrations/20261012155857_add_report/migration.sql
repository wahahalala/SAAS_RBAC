-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('usage', 'members', 'billing');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('csv', 'pdf');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "format" "ReportFormat" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'pending',
    "filePath" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "rowCount" INTEGER,
    "error" TEXT,
    "requestedById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_tenantId_status_idx" ON "reports"("tenantId", "status");

-- CreateIndex
CREATE INDEX "reports_tenantId_createdAt_idx" ON "reports"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
