-- AlterTable
ALTER TABLE "Product" ADD COLUMN "weightGrams" INTEGER,
ADD COLUMN "lengthCm" INTEGER,
ADD COLUMN "widthCm" INTEGER,
ADD COLUMN "heightCm" INTEGER;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN "weightGrams" INTEGER,
ADD COLUMN "lengthCm" INTEGER,
ADD COLUMN "widthCm" INTEGER,
ADD COLUMN "heightCm" INTEGER;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "packingSnapshot" JSONB,
ADD COLUMN "packingRevision" TEXT;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "weightGrams" INTEGER;
