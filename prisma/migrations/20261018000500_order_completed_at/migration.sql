-- AlterTable
ALTER TABLE "Order" ADD COLUMN "completedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_status_completedAt_idx" ON "Order"("status", "completedAt");
