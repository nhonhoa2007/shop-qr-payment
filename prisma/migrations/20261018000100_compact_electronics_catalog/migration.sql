-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('LAPTOP', 'PHONE', 'ACCESSORY', 'LEGACY');

-- CreateEnum
CREATE TYPE "ProductSegment" AS ENUM ('BUDGET', 'MID_RANGE', 'PREMIUM', 'FLAGSHIP');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('DISCOVERED', 'LICENSE_REVIEW', 'MAPPING_REVIEW', 'APPROVED', 'ACTIVE', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "DataSourceType" AS ENUM ('CATALOG', 'REVIEW_AGGREGATE', 'BENCHMARK', 'COMPATIBILITY', 'MANUFACTURER');

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "country" TEXT,
    "websiteUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "ProductKind" NOT NULL DEFAULT 'LEGACY',
    "parentId" TEXT,
    "specSchema" JSONB NOT NULL,
    "specSchemaVersion" INTEGER NOT NULL DEFAULT 1,
    "scoringConfig" JSONB,
    "warrantyConfig" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" "DataSourceType" NOT NULL,
    "status" "SourceStatus" NOT NULL DEFAULT 'DISCOVERED',
    "publisher" TEXT NOT NULL,
    "url" TEXT,
    "license" TEXT,
    "market" TEXT,
    "version" TEXT,
    "checksum" TEXT,
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- AlterTable Product: add M1 electronics fields while preserving legacy category and image
ALTER TABLE "Product"
    ADD COLUMN "brandId" TEXT,
    ADD COLUMN "categoryId" TEXT,
    ADD COLUMN "kind" "ProductKind" NOT NULL DEFAULT 'LEGACY',
    ADD COLUMN "segment" "ProductSegment",
    ADD COLUMN "isLegacy" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "specs" JSONB,
    ADD COLUMN "images" JSONB,
    ADD COLUMN "editorialTags" JSONB,
    ADD COLUMN "warrantyConfig" JSONB,
    ADD COLUMN "catalogVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable ProductVariant: add M1 option values, hash, and spec overrides while preserving color and size
ALTER TABLE "ProductVariant"
    ADD COLUMN "optionValues" JSONB,
    ADD COLUMN "optionHash" TEXT,
    ADD COLUMN "specOverrides" JSONB,
    ADD COLUMN "images" JSONB,
    ADD COLUMN "warrantyConfig" JSONB,
    ADD COLUMN "serializationRequired" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");
CREATE INDEX "Brand_isActive_idx" ON "Brand"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_kind_isActive_idx" ON "Category"("kind", "isActive");

-- CreateIndex
CREATE INDEX "DataSource_sourceType_status_idx" ON "DataSource"("sourceType", "status");
CREATE INDEX "DataSource_status_idx" ON "DataSource"("status");

-- CreateIndex
CREATE INDEX "Product_categoryId_isActive_idx" ON "Product"("categoryId", "isActive");
CREATE INDEX "Product_brandId_isActive_idx" ON "Product"("brandId", "isActive");
CREATE INDEX "Product_kind_segment_isActive_idx" ON "Product"("kind", "segment", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_optionHash_key" ON "ProductVariant"("productId", "optionHash");
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId", "isActive");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSource" ADD CONSTRAINT "DataSource_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PostgreSQL GIN Indexes for high-performance JSON search
CREATE INDEX "Product_specs_gin_idx" ON "Product" USING GIN ("specs");
CREATE INDEX "Product_images_gin_idx" ON "Product" USING GIN ("images");
CREATE INDEX "ProductVariant_optionValues_gin_idx" ON "ProductVariant" USING GIN ("optionValues");
CREATE INDEX "Category_specSchema_gin_idx" ON "Category" USING GIN ("specSchema");
CREATE INDEX "DataSource_payload_gin_idx" ON "DataSource" USING GIN ("payload");

-- Step 4: Backfill LEGACY root category without inventing data
INSERT INTO "Category" (
    "id",
    "name",
    "slug",
    "kind",
    "specSchema",
    "specSchemaVersion",
    "isActive",
    "createdAt",
    "updatedAt"
)
VALUES (
    'cat_legacy_root',
    'Sản phẩm truyền thống',
    'legacy-products',
    'LEGACY',
    '{"schemaVersion": 1, "definitions": []}'::jsonb,
    1,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;

-- Link existing products to LEGACY category preserving IDs and provenance
UPDATE "Product"
SET
    "categoryId" = 'cat_legacy_root',
    "isLegacy" = true,
    "kind" = 'LEGACY'
WHERE "categoryId" IS NULL;
