-- CreateEnum
CREATE TYPE "WarrantyClaimStatus" AS ENUM ('SUBMITTED', 'RECEIVED', 'INSPECTING', 'WAITING_PARTS', 'RESOLVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WarrantyResolutionOutcome" AS ENUM ('REPAIRED', 'REPLACED', 'REFUND_RECOMMENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReturnRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'ITEM_RECEIVED', 'INSPECTED', 'RESOLVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnDisposition" AS ENUM ('RESTOCKABLE', 'REFURBISH', 'DEFECTIVE', 'RETURN_TO_SUPPLIER', 'DISPOSED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WARRANTY_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'RETURN_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'REFUND_COMPLETED';

-- AlterTable
ALTER TABLE "RefundCase" ADD COLUMN "entitlementSnapshot" JSONB,
ADD COLUMN "allocationSnapshot" JSONB;

-- CreateTable
CREATE TABLE "WarrantyClaim" (
    "id" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "serializedUnitId" TEXT,
    "status" "WarrantyClaimStatus" NOT NULL DEFAULT 'SUBMITTED',
    "issueDescription" TEXT NOT NULL,
    "timeline" JSONB NOT NULL,
    "evidenceRefs" JSONB NOT NULL,
    "resolution" JSONB,
    "resolutionOutcome" "WarrantyResolutionOutcome",
    "replacementUnitId" TEXT,
    "refundCaseId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastOperationKey" TEXT,
    "warrantyTermsSnapshot" JSONB NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarrantyClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "ReturnRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "timeline" JSONB NOT NULL,
    "evidenceRefs" JSONB NOT NULL,
    "disposition" "ReturnDisposition",
    "dispositionNotes" TEXT,
    "refundCaseId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastOperationKey" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarrantyClaim_claimNumber_key" ON "WarrantyClaim"("claimNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WarrantyClaim_refundCaseId_key" ON "WarrantyClaim"("refundCaseId");

-- CreateIndex
CREATE INDEX "WarrantyClaim_customerId_status_idx" ON "WarrantyClaim"("customerId", "status");

-- CreateIndex
CREATE INDEX "WarrantyClaim_orderId_idx" ON "WarrantyClaim"("orderId");

-- CreateIndex
CREATE INDEX "WarrantyClaim_orderItemId_status_idx" ON "WarrantyClaim"("orderItemId", "status");

-- CreateIndex
CREATE INDEX "WarrantyClaim_serializedUnitId_idx" ON "WarrantyClaim"("serializedUnitId");

-- CreateIndex
CREATE INDEX "WarrantyClaim_status_createdAt_idx" ON "WarrantyClaim"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRequest_returnNumber_key" ON "ReturnRequest"("returnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRequest_refundCaseId_key" ON "ReturnRequest"("refundCaseId");

-- CreateIndex
CREATE INDEX "ReturnRequest_customerId_status_idx" ON "ReturnRequest"("customerId", "status");

-- CreateIndex
CREATE INDEX "ReturnRequest_orderId_idx" ON "ReturnRequest"("orderId");

-- CreateIndex
CREATE INDEX "ReturnRequest_status_createdAt_idx" ON "ReturnRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_serializedUnitId_fkey" FOREIGN KEY ("serializedUnitId") REFERENCES "SerializedUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_replacementUnitId_fkey" FOREIGN KEY ("replacementUnitId") REFERENCES "SerializedUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_refundCaseId_fkey" FOREIGN KEY ("refundCaseId") REFERENCES "RefundCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_refundCaseId_fkey" FOREIGN KEY ("refundCaseId") REFERENCES "RefundCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
