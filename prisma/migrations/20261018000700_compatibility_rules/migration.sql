-- CreateEnum
CREATE TYPE "CompatibilityDirection" AS ENUM ('HOST_TO_ACCESSORY', 'ACCESSORY_TO_HOST', 'BIDIRECTIONAL');

-- CreateEnum
CREATE TYPE "CompatibilityRuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'REVOKED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "CompatibilityRule" (
    "id" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "direction" "CompatibilityDirection" NOT NULL DEFAULT 'HOST_TO_ACCESSORY',
    "sourceCategoryId" TEXT,
    "targetCategoryId" TEXT,
    "categoryScope" JSONB,
    "conditions" JSONB NOT NULL,
    "warnings" JSONB,
    "market" TEXT DEFAULT 'VN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "CompatibilityRuleStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceId" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompatibilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompatibilityRule_ruleCode_version_key" ON "CompatibilityRule"("ruleCode", "version");

-- CreateIndex
CREATE INDEX "CompatibilityRule_status_sourceCategoryId_targetCategoryId_idx" ON "CompatibilityRule"("status", "sourceCategoryId", "targetCategoryId");

-- CreateIndex
CREATE INDEX "CompatibilityRule_ruleCode_status_idx" ON "CompatibilityRule"("ruleCode", "status");

-- CreateIndex
CREATE INDEX "CompatibilityRule_sourceId_idx" ON "CompatibilityRule"("sourceId");

-- AddForeignKey
ALTER TABLE "CompatibilityRule" ADD CONSTRAINT "CompatibilityRule_sourceCategoryId_fkey" FOREIGN KEY ("sourceCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompatibilityRule" ADD CONSTRAINT "CompatibilityRule_targetCategoryId_fkey" FOREIGN KEY ("targetCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompatibilityRule" ADD CONSTRAINT "CompatibilityRule_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompatibilityRule" ADD CONSTRAINT "CompatibilityRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompatibilityRule" ADD CONSTRAINT "CompatibilityRule_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
