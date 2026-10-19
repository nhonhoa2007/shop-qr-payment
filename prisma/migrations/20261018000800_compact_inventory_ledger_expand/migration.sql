-- AlterTable
ALTER TABLE "Product" ADD COLUMN "onHandStock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reservedStock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "quarantinedStock" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN "onHandStock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reservedStock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "quarantinedStock" INTEGER NOT NULL DEFAULT 0;

-- Backfill onHandStock from existing stock
UPDATE "Product" SET "onHandStock" = "stock";
UPDATE "ProductVariant" SET "onHandStock" = "stock";

-- CreateEnum
CREATE TYPE "MovementKind" AS ENUM ('OPENING_LEGACY', 'RESERVE', 'RELEASE', 'SHIP', 'RECEIVE', 'QUARANTINE', 'RESTOCK', 'ADJUST');

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "payloadFingerprint" TEXT,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "kind" "MovementKind" NOT NULL,
    "deltaOnHand" INTEGER NOT NULL,
    "deltaReserved" INTEGER NOT NULL,
    "deltaQuarantined" INTEGER NOT NULL,
    "beforeOnHand" INTEGER NOT NULL,
    "afterOnHand" INTEGER NOT NULL,
    "beforeReserved" INTEGER NOT NULL,
    "afterReserved" INTEGER NOT NULL,
    "beforeQuarantined" INTEGER NOT NULL,
    "afterQuarantined" INTEGER NOT NULL,
    "beforeAvailable" INTEGER NOT NULL,
    "afterAvailable" INTEGER NOT NULL,
    "beforeVersion" INTEGER NOT NULL,
    "afterVersion" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_operationKey_key" ON "InventoryMovement"("operationKey");

-- CreateIndex
CREATE INDEX "InventoryMovement_productId_variantId_idx" ON "InventoryMovement"("productId", "variantId");

-- CreateIndex
CREATE INDEX "InventoryMovement_referenceType_referenceId_idx" ON "InventoryMovement"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "InventoryMovement_kind_createdAt_idx" ON "InventoryMovement"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill OPENING_LEGACY movements for existing variants
INSERT INTO "InventoryMovement" (
    "id", "operationKey", "productId", "variantId", "kind",
    "deltaOnHand", "deltaReserved", "deltaQuarantined",
    "beforeOnHand", "afterOnHand", "beforeReserved", "afterReserved",
    "beforeQuarantined", "afterQuarantined", "beforeAvailable", "afterAvailable",
    "beforeVersion", "afterVersion", "reason", "referenceType", "referenceId", "createdAt"
)
SELECT
    'init_var_' || id,
    'opening:legacy:variant:' || id,
    "productId",
    id,
    'OPENING_LEGACY'::"MovementKind",
    stock, 0, 0,
    0, stock, 0, 0,
    0, 0, 0, stock,
    "stockVersion", "stockVersion",
    'Initial baseline stock backfill',
    'SYSTEM', 'legacy_init', CURRENT_TIMESTAMP
FROM "ProductVariant"
WHERE stock > 0
ON CONFLICT ("operationKey") DO NOTHING;

-- Backfill OPENING_LEGACY movements for existing base products without variants
INSERT INTO "InventoryMovement" (
    "id", "operationKey", "productId", "variantId", "kind",
    "deltaOnHand", "deltaReserved", "deltaQuarantined",
    "beforeOnHand", "afterOnHand", "beforeReserved", "afterReserved",
    "beforeQuarantined", "afterQuarantined", "beforeAvailable", "afterAvailable",
    "beforeVersion", "afterVersion", "reason", "referenceType", "referenceId", "createdAt"
)
SELECT
    'init_prod_' || id,
    'opening:legacy:product:' || id,
    id,
    NULL,
    'OPENING_LEGACY'::"MovementKind",
    stock, 0, 0,
    0, stock, 0, 0,
    0, 0, 0, stock,
    "stockVersion", "stockVersion",
    'Initial baseline stock backfill',
    'SYSTEM', 'legacy_init', CURRENT_TIMESTAMP
FROM "Product"
WHERE stock > 0
  AND id NOT IN (SELECT DISTINCT "productId" FROM "ProductVariant")
ON CONFLICT ("operationKey") DO NOTHING;
