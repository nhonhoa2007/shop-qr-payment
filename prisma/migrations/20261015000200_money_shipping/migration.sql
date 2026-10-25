-- CreateEnum
CREATE TYPE "FulfillmentState" AS ENUM ('NONE', 'REQUESTING', 'REVIEW', 'CREATED');

-- CreateEnum
CREATE TYPE "BankTransferStatus" AS ENUM ('PENDING_REVIEW', 'APPLIED_ORDER', 'APPLIED_TOPUP', 'REFUNDED');

-- CreateEnum
CREATE TYPE "RefundCaseStatus" AS ENUM ('OPEN', 'COMPLETED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "fulfillmentState" "FulfillmentState" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "toDistrictId" INTEGER,
ADD COLUMN     "toWardCode" TEXT;

-- CreateTable
CREATE TABLE "BankTransfer" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "bankTransId" TEXT,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "bankName" TEXT,
    "receivedAt" TIMESTAMP(3),
    "rawWebhookData" JSONB NOT NULL,
    "orderId" TEXT,
    "topupCode" TEXT,
    "status" "BankTransferStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundCase" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "orderId" TEXT,
    "bankTransferId" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundCaseStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankTransfer_fingerprint_key" ON "BankTransfer"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransfer_bankTransId_key" ON "BankTransfer"("bankTransId");

-- CreateIndex
CREATE INDEX "BankTransfer_status_createdAt_idx" ON "BankTransfer"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BankTransfer_orderId_idx" ON "BankTransfer"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "RefundCase_sourceKey_key" ON "RefundCase"("sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "RefundCase_bankTransferId_key" ON "RefundCase"("bankTransferId");

-- CreateIndex
CREATE INDEX "RefundCase_status_createdAt_idx" ON "RefundCase"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "BankTransfer" ADD CONSTRAINT "BankTransfer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundCase" ADD CONSTRAINT "RefundCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundCase" ADD CONSTRAINT "RefundCase_bankTransferId_fkey" FOREIGN KEY ("bankTransferId") REFERENCES "BankTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
