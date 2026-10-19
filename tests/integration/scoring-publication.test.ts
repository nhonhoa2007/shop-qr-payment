import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  recomputeScores,
  getProductScores,
  revokeSourceSnapshots,
} from '@server/modules/intelligence/scoring.service.ts';

const db = new PrismaClient();
const tag = crypto.randomUUID().slice(0, 8);

test('Commerce Intelligence Integration: Score Snapshot publication, revision, and revocation', async (t) => {
  try {
    await db.$connect();
  } catch {
    t.skip('Skipping database-dependent test: PostgreSQL is not running locally');
    return;
  }

  // 1. Setup Category, Brand, Product and DataSource
  const category = await db.category.create({
    data: {
      name: `Laptop-Scoring-${tag}`,
      slug: `laptop-scoring-${tag}`,
      kind: 'LAPTOP',
      specSchema: { version: 1, fields: [] },
    },
  });

  const brand = await db.brand.create({
    data: {
      name: `Asus-${tag}`,
      slug: `asus-${tag}`,
    },
  });

  const product = await db.product.create({
    data: {
      name: `ZenBook 14 OLED-${tag}`,
      categoryId: category.id,
      brandId: brand.id,
      kind: 'LAPTOP',
      price: BigInt(28_000_000),
      stock: 15,
      specs: {
        weight_kg: 1.28,
      },
    },
  });

  const source = await db.dataSource.create({
    data: {
      name: `UL-Procyon-${tag}`,
      sourceType: 'BENCHMARK',
      status: 'ACTIVE',
      publisher: 'UL Benchmarks',
      license: 'Commercial-Internal',
      market: 'VN',
      isSynthetic: false,
    },
  });

  const bm1 = await db.benchmarkMeasurement.create({
    data: {
      sourceId: source.id,
      productId: product.id,
      metric: 'geekbench_multi_core',
      value: 12500,
      unit: 'points',
      version: 1,
    },
  });

  const bm2 = await db.benchmarkMeasurement.create({
    data: {
      sourceId: source.id,
      productId: product.id,
      metric: 'battery_web_browsing',
      value: 14.5,
      unit: 'hours',
      version: 1,
    },
  });

  try {
    const adminActor = { id: 'admin_test_1', role: 'ADMIN' };

    // 2. Initial Recomputation Run
    const report1 = await recomputeScores(
      { productId: product.id, useCase: 'office_study' },
      adminActor,
      db
    );

    assert.equal(report1.publishedCount, 1, 'Should publish 1 initial snapshot');
    assert.equal(report1.errors.length, 0);

    const initialSnapshots = await getProductScores(product.id, undefined, db);
    assert.equal(initialSnapshots.length, 1);
    const snap1 = initialSnapshots[0];
    assert.equal(snap1.status, 'ACTIVE');
    assert.equal(snap1.useCase, 'office_study');
    assert.ok(snap1.finalScore > 0);
    assert.ok(snap1.priceSnapshot.includes('28.000.000'));
    assert.ok(Array.isArray(snap1.sourceRefs));
    assert.ok(snap1.sourceRefs.includes(source.id));

    // 3. Idempotent Recomputation (same state)
    const report2 = await recomputeScores(
      { productId: product.id, useCase: 'office_study' },
      adminActor,
      db
    );
    assert.equal(report2.publishedCount, 0, 'No duplicate snapshot should be created');

    const afterIdempotent = await getProductScores(product.id, undefined, db);
    assert.equal(afterIdempotent.length, 1);

    // 4. Price change triggers new revision and supersedes prior
    await db.product.update({
      where: { id: product.id },
      data: { price: BigInt(23_500_000) },
    });

    const report3 = await recomputeScores(
      { productId: product.id, useCase: 'office_study' },
      adminActor,
      db
    );
    assert.equal(report3.publishedCount, 1, 'Should publish new revision snapshot');
    assert.equal(report3.supersededCount, 1, 'Should supersede previous active snapshot');

    // Query all snapshots in DB for this product
    const allDbSnaps = await db.productScoreSnapshot.findMany({
      where: { productId: product.id },
      orderBy: { publishedAt: 'desc' },
    });
    assert.equal(allDbSnaps.length, 2, 'Both snapshots must exist in DB history');
    assert.equal(allDbSnaps[0].status, 'ACTIVE');
    assert.equal(allDbSnaps[1].status, 'SUPERSEDED');

    // 5. Source revocation marks active snapshot REVOKED and disables Good Value
    await db.dataSource.update({
      where: { id: source.id },
      data: { status: 'REVOKED' },
    });

    const revokedCount = await revokeSourceSnapshots(source.id, db);
    assert.ok(revokedCount >= 1, 'Should revoke affected snapshot');

    const scoresAfterRevoke = await getProductScores(product.id, undefined, db);
    const activeOrRevoked = scoresAfterRevoke.find((s) => s.id === allDbSnaps[0].id);
    assert.ok(activeOrRevoked);
    assert.equal(activeOrRevoked.status, 'REVOKED');
    assert.equal(activeOrRevoked.isGoodValue, false);
  } finally {
    // Cleanup fixtures
    await db.productScoreSnapshot.deleteMany({ where: { productId: product.id } });
    await db.benchmarkMeasurement.deleteMany({ where: { id: { in: [bm1.id, bm2.id] } } });
    await db.dataSource.deleteMany({ where: { id: source.id } });
    await db.product.deleteMany({ where: { id: product.id } });
    await db.brand.deleteMany({ where: { id: brand.id } });
    await db.category.deleteMany({ where: { id: category.id } });
    await db.$disconnect();
  }
});
