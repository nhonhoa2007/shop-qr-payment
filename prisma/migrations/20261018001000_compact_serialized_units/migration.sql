-- CreateEnum
CREATE TYPE "SerializedUnitStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'SOLD', 'QUARANTINED', 'DEFECTIVE');

-- CreateTable
CREATE TABLE "SerializedUnit" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "serialNumber" TEXT,
    "imei1" TEXT,
    "imei2" TEXT,
    "status" "SerializedUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "orderId" TEXT,
    "orderItemId" TEXT,
    "purchaseOrderItemId" TEXT,
    "supplierId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "quarantinedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SerializedUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SerializedUnit_serialNumber_key" ON "SerializedUnit"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SerializedUnit_imei1_key" ON "SerializedUnit"("imei1");

-- CreateIndex
CREATE UNIQUE INDEX "SerializedUnit_imei2_key" ON "SerializedUnit"("imei2");

-- CreateIndex
CREATE INDEX "SerializedUnit_productId_variantId_status_idx" ON "SerializedUnit"("productId", "variantId", "status");

-- CreateIndex
CREATE INDEX "SerializedUnit_orderId_status_idx" ON "SerializedUnit"("orderId", "status");

-- CreateIndex
CREATE INDEX "SerializedUnit_orderItemId_idx" ON "SerializedUnit"("orderItemId");

-- CreateIndex
CREATE INDEX "SerializedUnit_purchaseOrderItemId_idx" ON "SerializedUnit"("purchaseOrderItemId");

-- CreateIndex
CREATE INDEX "SerializedUnit_status_idx" ON "SerializedUnit"("status");

-- AddForeignKey
ALTER TABLE "SerializedUnit" ADD CONSTRAINT "SerializedUnit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerializedUnit" ADD CONSTRAINT "SerializedUnit_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerializedUnit" ADD CONSTRAINT "SerializedUnit_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerializedUnit" ADD CONSTRAINT "SerializedUnit_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerializedUnit" ADD CONSTRAINT "SerializedUnit_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
