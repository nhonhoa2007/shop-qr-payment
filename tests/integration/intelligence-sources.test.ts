import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  listActiveEvidence,
  invalidateEvidenceCache,
} from '@server/modules/intelligence/sources.service.ts';
import {
  validateReviewAggregatePayload,
} from '@shared/validations/evidence-json.ts';

const db = new PrismaClient();
const tag = crypto.randomUUID().slice(0, 8);

test('Intelligence Evidence Integration: DataSource payload, BenchmarkMeasurement, and caching lifecycle', async (t) => {
  try {
    await db.$connect();
  } catch {
    t.skip('Skipping database-dependent test: PostgreSQL is not running locally');
    return;
  }

  // 1. Setup Category, Brand, Product and Variant
  const category = await db.category.create({
    data: {
      name: `Laptop-${tag}`,
      slug: `laptop-${tag}`,
      kind: 'LAPTOP',
      specSchema: { version: 1, fields: [] },
    },
  });

  const brand = await db.brand.create({
    data: {
      name: `Apple-${tag}`,
      slug: `apple-${tag}`,
    },
  });

  const product = await db.product.create({
    data: {
      name: `MacBook Pro 14-${tag}`,
      categoryId: category.id,
      brandId: brand.id,
      kind: 'LAPTOP',
      price: BigInt(45_000_000),
      stock: 10,
    },
  });

  const variant = await db.productVariant.create({
    data: {
      productId: product.id,
      sku: `MBP14-${tag}-512`,
      title: '16GB / 512GB Space Gray',
      price: BigInt(45_000_000),
      stock: 10,
    },
  });

  // 2. Setup DataSource: Review Aggregate
  const reviewPayload = {
    schemaVersion: 1,
    sampleSize: 85,
    analyzerVersion: 'nlp-v2',
    ratingSummary: { averageRating: 4.8, totalReviews: 85 },
    aspects: [
      { aspect: 'Performance', positiveScore: 94.0, confidence: 0.98, sampleCount: 80 },
      { aspect: 'Battery', positiveScore: 92.5, confidence: 0.95, sampleCount: 75 },
    ],
    mapping: {
      productId: product.id,
      variantId: variant.id,
    },
  };

  const validatedReview = validateReviewAggregatePayload(reviewPayload);
  assert.equal(validatedReview.valid, true);

  const reviewSource = await db.dataSource.create({
    data: {
      name: `Notebookcheck-${tag}`,
      sourceType: 'REVIEW_AGGREGATE',
      status: 'ACTIVE',
      publisher: 'Notebookcheck',
      license: 'CC-BY-NC-4.0',
      market: 'VN',
      isSynthetic: false,
      payload: (validatedReview.payload ?? {}) as Record<string, unknown>,
    },
  });

  // 3. Setup DataSource: Benchmark
  const benchSource = await db.dataSource.create({
    data: {
      name: `GeekbenchLab-${tag}`,
      sourceType: 'BENCHMARK',
      status: 'ACTIVE',
      publisher: 'Primate Labs',
      license: 'ODbL-1.0',
      market: 'VN',
      isSynthetic: false,
    },
  });

  // 4. Create BenchmarkMeasurement records
  const measurement1 = await db.benchmarkMeasurement.create({
    data: {
      sourceId: benchSource.id,
      productId: product.id,
      variantId: variant.id,
      metric: 'geekbench_multi_core',
      value: 11950,
      unit: 'points',
      methodology: 'Geekbench 6 Multi-Core CPU 64-bit',
      version: 1,
      sampleSize: 15,
    },
  });
  assert.ok(measurement1.id);

  const measurement2 = await db.benchmarkMeasurement.create({
    data: {
      sourceId: benchSource.id,
      productId: product.id,
      variantId: variant.id,
      metric: 'battery_web_browsing',
      value: 15.5,
      unit: 'hours',
      methodology: 'WiFi 150 nits continuous browsing',
      version: 1,
      sampleSize: 3,
    },
  });
  assert.ok(measurement2.id);

  try {
    // 5. Invalidate cache before test
    await invalidateEvidenceCache();

    // 6. Query evidence for this variant
    const evidenceList = await listActiveEvidence({
      productId: product.id,
      variantId: variant.id,
      market: 'VN',
    });

    assert.ok(evidenceList.length >= 2);

    // Verify Review Aggregate Evidence
    const reviewEvidence = evidenceList.find((e) => e.id === reviewSource.id);
    assert.ok(reviewEvidence, 'Review evidence must be returned');
    assert.equal(reviewEvidence.sourceType, 'REVIEW_AGGREGATE');
    assert.equal(reviewEvidence.provenance, 'EXTERNAL');

    // Verify Benchmark Evidence
    const benchEvidence = evidenceList.find((e) => e.id === benchSource.id);
    assert.ok(benchEvidence, 'Benchmark evidence must be returned');
    assert.ok(benchEvidence.benchmarks && benchEvidence.benchmarks.length >= 2);
    assert.ok(
      benchEvidence.benchmarks.some(
        (b) => b.metric === 'geekbench_multi_core' && b.value === 11950 && b.unit === 'points'
      )
    );
    assert.ok(
      benchEvidence.benchmarks.some(
        (b) => b.metric === 'battery_web_browsing' && b.value === 15.5 && b.unit === 'hours'
      )
    );

    // 7. Test uniqueness constraint on BenchmarkMeasurement
    await assert.rejects(
      db.benchmarkMeasurement.create({
        data: {
          sourceId: benchSource.id,
          productId: product.id,
          variantId: variant.id,
          metric: 'geekbench_multi_core',
          value: 12000,
          unit: 'points',
          version: 1, // Duplicate version 1 on same source, product, variant, metric
        },
      }),
      (err: unknown) => {
        const e = err as { code?: string; message?: string };
        return e.code === 'P2002' || (typeof e.message === 'string' && e.message.includes('Unique constraint'));
      }
    );

    // 8. Test version increment allows new measurement revision
    const measurementV2 = await db.benchmarkMeasurement.create({
      data: {
        sourceId: benchSource.id,
        productId: product.id,
        variantId: variant.id,
        metric: 'geekbench_multi_core',
        value: 12050,
        unit: 'points',
        version: 2, // Version incremented
      },
    });
    assert.ok(measurementV2.id);

    // 9. Test Revocation and Immediate Cache Invalidation
    await db.dataSource.update({
      where: { id: benchSource.id },
      data: { status: 'REVOKED' },
    });
    await invalidateEvidenceCache(product.id);

    const refreshedEvidence = await listActiveEvidence({
      productId: product.id,
      variantId: variant.id,
      market: 'VN',
    });

    // Revoked benchmark source must be completely excluded
    assert.equal(
      refreshedEvidence.some((e) => e.id === benchSource.id),
      false,
      'Revoked DataSource must be immediately excluded from active evidence'
    );
  } finally {
    // Cleanup
    await db.product.delete({ where: { id: product.id } }).catch(() => {});
    await db.brand.delete({ where: { id: brand.id } }).catch(() => {});
    await db.category.delete({ where: { id: category.id } }).catch(() => {});
    await db.dataSource.delete({ where: { id: reviewSource.id } }).catch(() => {});
    await db.dataSource.delete({ where: { id: benchSource.id } }).catch(() => {});
  }
});
