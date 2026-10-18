-- CreateTable
CREATE TABLE "BenchmarkMeasurement" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "methodology" TEXT,
    "measuredAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "sampleSize" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BenchmarkMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkMeasurement_sourceId_productId_variantId_metric_version_key" ON "BenchmarkMeasurement"("sourceId", "productId", "variantId", "metric", "version");

-- CreateIndex
CREATE INDEX "BenchmarkMeasurement_productId_metric_idx" ON "BenchmarkMeasurement"("productId", "metric");

-- CreateIndex
CREATE INDEX "BenchmarkMeasurement_sourceId_idx" ON "BenchmarkMeasurement"("sourceId");

-- AddForeignKey
ALTER TABLE "BenchmarkMeasurement" ADD CONSTRAINT "BenchmarkMeasurement_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkMeasurement" ADD CONSTRAINT "BenchmarkMeasurement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkMeasurement" ADD CONSTRAINT "BenchmarkMeasurement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
