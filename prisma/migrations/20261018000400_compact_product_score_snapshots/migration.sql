-- CreateTable
CREATE TABLE "ProductScoreSnapshot" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "useCase" TEXT NOT NULL,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "priceEfficiency" DOUBLE PRECISION NOT NULL,
    "experience" DOUBLE PRECISION NOT NULL,
    "support" DOUBLE PRECISION NOT NULL,
    "coverage" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isGoodValue" BOOLEAN NOT NULL DEFAULT false,
    "rubricVersion" INTEGER NOT NULL DEFAULT 1,
    "rubricSnapshot" JSONB NOT NULL,
    "breakdown" JSONB NOT NULL,
    "sourceRefs" JSONB NOT NULL,
    "missingEvidence" JSONB,
    "sourceSetHash" TEXT NOT NULL,
    "priceSnapshot" TEXT NOT NULL,
    "revisionKey" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductScoreSnapshot_revisionKey_key" ON "ProductScoreSnapshot"("revisionKey");

-- CreateIndex
CREATE INDEX "ProductScoreSnapshot_productId_useCase_status_idx" ON "ProductScoreSnapshot"("productId", "useCase", "status");

-- CreateIndex
CREATE INDEX "ProductScoreSnapshot_isGoodValue_status_idx" ON "ProductScoreSnapshot"("isGoodValue", "status");

-- CreateIndex
CREATE INDEX "ProductScoreSnapshot_publishedAt_idx" ON "ProductScoreSnapshot"("publishedAt");

-- AddForeignKey
ALTER TABLE "ProductScoreSnapshot" ADD CONSTRAINT "ProductScoreSnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductScoreSnapshot" ADD CONSTRAINT "ProductScoreSnapshot_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
