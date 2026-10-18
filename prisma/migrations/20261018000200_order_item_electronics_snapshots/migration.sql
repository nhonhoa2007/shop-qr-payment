-- AlterTable OrderItem to snapshot electronics terms, warranty, packing lines, and revisions
ALTER TABLE "OrderItem" ADD COLUMN "productName" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "sku" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "variantOptions" JSONB;
ALTER TABLE "OrderItem" ADD COLUMN "unitPrice" BIGINT;
ALTER TABLE "OrderItem" ADD COLUMN "warrantySnapshot" JSONB;
ALTER TABLE "OrderItem" ADD COLUMN "packingLineSnapshot" JSONB;
ALTER TABLE "OrderItem" ADD COLUMN "schemaRevision" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN "sourceRevision" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "returnedQuantity" INTEGER NOT NULL DEFAULT 0;
