-- CreateEnum
CREATE TYPE "InventoryMode" AS ENUM ('BASE', 'VARIANT');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "inventoryMode" "InventoryMode" NOT NULL DEFAULT 'BASE';

-- Backfill: Any product with historical or existing variants is marked as VARIANT inventory mode
UPDATE "Product"
SET "inventoryMode" = 'VARIANT'
WHERE "id" IN (SELECT DISTINCT "productId" FROM "ProductVariant");
