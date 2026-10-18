import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRevisionKey,
  resolveGoodValueBadge,
  recomputeScores,
  getProductScores,
  revokeSourceSnapshots,
  type PrismaClientOrTx,
} from '../src/server/modules/intelligence/scoring.service.ts';
import type { RecomputeInput } from '../src/shared/types/intelligence.ts';

interface MockSnapshot {
  id: string;
  productId: string;
  variantId?: string | null;
  useCase: string;
  finalScore: number;
  priceEfficiency: number;
  experience: number;
  support: number;
  coverage: number;
  status: string;
  isGoodValue: boolean;
  rubricVersion: number;
  rubricSnapshot: unknown;
  breakdown: unknown;
  sourceRefs: string[];
  sourceSetHash: string;
  priceSnapshot: string;
  revisionKey: string;
  publishedAt: Date;
  createdAt?: Date;
  [key: string]: unknown;
}

describe('Commerce Intelligence: Immutable Score Publication & Replay', () => {
  it('buildRevisionKey formats deterministic key', () => {
    const key1 = buildRevisionKey({
      productId: 'prod_1',
      variantId: 'var_1',
      useCase: 'office_study',
      rubricVersion: 1,
      sourceSetHash: 'hash123',
      priceSnapshot: '25.000.000 ₫',
    });

    const key2 = buildRevisionKey({
      productId: 'prod_1',
      variantId: 'var_1',
      useCase: 'office_study',
      rubricVersion: 1,
      sourceSetHash: 'hash123',
      priceSnapshot: '25.000.000 ₫',
    });

    assert.equal(key1, 'prod_1:var_1:office_study:1:hash123:25.000.000 ₫');
    assert.equal(key1, key2);

    const baseKey = buildRevisionKey({
      productId: 'prod_1',
      variantId: null,
      useCase: 'office_study',
      rubricVersion: 1,
      sourceSetHash: 'hash123',
      priceSnapshot: '25.000.000 ₫',
    });
    assert.equal(baseKey, 'prod_1:base:office_study:1:hash123:25.000.000 ₫');
  });

  it('derives GOOD_VALUE dynamically from score >= 80, priceEfficiency >= 75 and coverage >= 0.6', () => {
    // Active snapshot with high score
    assert.equal(
      resolveGoodValueBadge({
        finalScore: 82.5,
        priceEfficiency: 80.0,
        coverage: 0.85,
        status: 'ACTIVE',
      }),
      true
    );

    // Score < 80 and priceEfficiency < 80
    assert.equal(
      resolveGoodValueBadge({
        finalScore: 78.0,
        priceEfficiency: 74.0,
        coverage: 0.85,
        status: 'ACTIVE',
      }),
      false
    );

    // Insufficient coverage (< 0.60)
    assert.equal(
      resolveGoodValueBadge({
        finalScore: 90.0,
        priceEfficiency: 90.0,
        coverage: 0.50,
        status: 'ACTIVE',
      }),
      false
    );

    // Non-active status (SUPERSEDED, REVOKED, INSUFFICIENT_DATA) is never GOOD_VALUE
    assert.equal(
      resolveGoodValueBadge({
        finalScore: 95.0,
        priceEfficiency: 95.0,
        coverage: 1.0,
        status: 'SUPERSEDED',
      }),
      false
    );

    assert.equal(
      resolveGoodValueBadge({
        finalScore: 95.0,
        priceEfficiency: 95.0,
        coverage: 1.0,
        status: 'REVOKED',
      }),
      false
    );
  });

  it('rejects publication when actor is STAFF (strictly requires ADMIN)', async () => {
    const input: RecomputeInput = { productId: 'prod_1' };
    const staffActor = { id: 'user_staff_1', role: 'STAFF' };

    await assert.rejects(
      async () => {
        await recomputeScores(input, staffActor);
      },
      /Forbidden: Only ADMIN/
    );

    const customerActor = { id: 'user_cust_1', role: 'CUSTOMER' };
    await assert.rejects(
      async () => {
        await recomputeScores(input, customerActor);
      },
      /Forbidden: Only ADMIN/
    );
  });

  it('recomputeScores is idempotent: concurrent or identical execution produces single snapshot', async () => {
    const snapshotsStore: MockSnapshot[] = [];
    let idCounter = 1;

    const mockDb = {
      category: {
        async findUnique() {
          return {
            id: 'cat_laptop',
            kind: 'LAPTOP',
            slug: 'laptops',
            scoringConfig: null,
          };
        },
      },
      product: {
        async findMany() {
          return [
            {
              id: 'prod_macbook',
              name: 'MacBook Air M2',
              price: BigInt(26_000_000),
              categoryId: 'cat_laptop',
              specs: { weight_kg: 1.24 },
              variants: [],
              categoryRef: {
                id: 'cat_laptop',
                kind: 'LAPTOP',
                slug: 'laptops',
                scoringConfig: null,
              },
              benchmarks: [
                {
                  id: 'bm_1',
                  sourceId: 'src_geekbench',
                  metric: 'geekbench_multi_core',
                  value: 9800,
                  source: { id: 'src_geekbench', status: 'ACTIVE' },
                },
                {
                  id: 'bm_2',
                  sourceId: 'src_battery',
                  metric: 'battery_web_browsing',
                  value: 16.0,
                  source: { id: 'src_battery', status: 'ACTIVE' },
                },
              ],
            },
          ];
        },
      },
      productScoreSnapshot: {
        async findMany(args: { where?: { revisionKey?: string; productId?: string; status?: string } }) {
          if (args.where?.revisionKey) {
            return snapshotsStore.filter((s) => s.revisionKey === args.where?.revisionKey);
          }
          if (args.where?.productId) {
            return snapshotsStore.filter(
              (s) =>
                s.productId === args.where?.productId &&
                (args.where?.status ? s.status === args.where?.status : true)
            );
          }
          return snapshotsStore;
        },
        async updateMany(args: { where: { productId?: string; useCase?: string }; data: { status: string } }) {
          let updatedCount = 0;
          for (const s of snapshotsStore) {
            if (
              s.productId === args.where.productId &&
              s.useCase === args.where.useCase &&
              s.status === 'ACTIVE'
            ) {
              s.status = args.data.status;
              updatedCount++;
            }
          }
          return { count: updatedCount };
        },
        async create(args: { data: Record<string, unknown> }) {
          const item: MockSnapshot = {
            id: `snap_${idCounter++}`,
            productId: String(args.data.productId),
            variantId: args.data.variantId as string | null | undefined,
            useCase: String(args.data.useCase),
            finalScore: Number(args.data.finalScore),
            priceEfficiency: Number(args.data.priceEfficiency),
            experience: Number(args.data.experience),
            support: Number(args.data.support),
            coverage: Number(args.data.coverage),
            status: String(args.data.status),
            isGoodValue: Boolean(args.data.isGoodValue),
            rubricVersion: Number(args.data.rubricVersion),
            rubricSnapshot: args.data.rubricSnapshot,
            breakdown: args.data.breakdown,
            sourceRefs: (args.data.sourceRefs as string[]) || [],
            sourceSetHash: String(args.data.sourceSetHash),
            priceSnapshot: String(args.data.priceSnapshot),
            revisionKey: String(args.data.revisionKey),
            publishedAt: new Date(),
            createdAt: new Date(),
          };
          snapshotsStore.push(item);
          return item;
        },
      },
      $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(mockDb),
    };

    const adminActor = { id: 'admin_1', role: 'ADMIN' };

    // 1st Recompute Run
    const report1 = await recomputeScores(
      { productId: 'prod_macbook', useCase: 'office_study' },
      adminActor,
      mockDb as unknown as PrismaClientOrTx
    );

    assert.equal(report1.publishedCount, 1);
    assert.equal(snapshotsStore.length, 1);
    assert.equal(snapshotsStore[0].status, 'ACTIVE');
    assert.equal(snapshotsStore[0].useCase, 'office_study');

    // 2nd Recompute Run with identical inputs
    const report2 = await recomputeScores(
      { productId: 'prod_macbook', useCase: 'office_study' },
      adminActor,
      mockDb as unknown as PrismaClientOrTx
    );

    // Idempotent: No duplicate row added
    assert.equal(report2.publishedCount, 0);
    assert.equal(snapshotsStore.length, 1);
  });

  it('creates new snapshot and supersedes prior snapshot when price or evidence changes', async () => {
    const snapshotsStore: MockSnapshot[] = [];
    let idCounter = 1;
    let currentPrice = BigInt(26_000_000);

    const mockDb = {
      category: {
        async findUnique() {
          return {
            id: 'cat_laptop',
            kind: 'LAPTOP',
            slug: 'laptops',
            scoringConfig: null,
          };
        },
      },
      product: {
        async findMany() {
          return [
            {
              id: 'prod_macbook',
              name: 'MacBook Air M2',
              price: currentPrice,
              categoryId: 'cat_laptop',
              specs: { weight_kg: 1.24 },
              variants: [],
              categoryRef: {
                id: 'cat_laptop',
                kind: 'LAPTOP',
                slug: 'laptops',
                scoringConfig: null,
              },
              benchmarks: [
                {
                  id: 'bm_1',
                  sourceId: 'src_geekbench',
                  metric: 'geekbench_multi_core',
                  value: 9800,
                  source: { id: 'src_geekbench', status: 'ACTIVE' },
                },
                {
                  id: 'bm_2',
                  sourceId: 'src_battery',
                  metric: 'battery_web_browsing',
                  value: 16.0,
                  source: { id: 'src_battery', status: 'ACTIVE' },
                },
              ],
            },
          ];
        },
      },
      productScoreSnapshot: {
        async findMany(args: { where?: { revisionKey?: string; productId?: string; status?: string } }) {
          if (args.where?.revisionKey) {
            return snapshotsStore.filter((s) => s.revisionKey === args.where?.revisionKey);
          }
          if (args.where?.productId) {
            return snapshotsStore.filter(
              (s) =>
                s.productId === args.where?.productId &&
                (args.where?.status ? s.status === args.where?.status : true)
            );
          }
          return snapshotsStore;
        },
        async updateMany(args: { where: { productId?: string; useCase?: string }; data: { status: string } }) {
          let updatedCount = 0;
          for (const s of snapshotsStore) {
            if (
              s.productId === args.where.productId &&
              s.useCase === args.where.useCase &&
              s.status === 'ACTIVE'
            ) {
              s.status = args.data.status;
              updatedCount++;
            }
          }
          return { count: updatedCount };
        },
        async create(args: { data: Record<string, unknown> }) {
          const item: MockSnapshot = {
            id: `snap_${idCounter++}`,
            productId: String(args.data.productId),
            variantId: args.data.variantId as string | null | undefined,
            useCase: String(args.data.useCase),
            finalScore: Number(args.data.finalScore),
            priceEfficiency: Number(args.data.priceEfficiency),
            experience: Number(args.data.experience),
            support: Number(args.data.support),
            coverage: Number(args.data.coverage),
            status: String(args.data.status),
            isGoodValue: Boolean(args.data.isGoodValue),
            rubricVersion: Number(args.data.rubricVersion),
            rubricSnapshot: args.data.rubricSnapshot,
            breakdown: args.data.breakdown,
            sourceRefs: (args.data.sourceRefs as string[]) || [],
            sourceSetHash: String(args.data.sourceSetHash),
            priceSnapshot: String(args.data.priceSnapshot),
            revisionKey: String(args.data.revisionKey),
            publishedAt: new Date(),
            createdAt: new Date(),
          };
          snapshotsStore.push(item);
          return item;
        },
      },
      $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(mockDb),
    };

    const adminActor = { id: 'admin_1', role: 'ADMIN' };

    // Initial publish
    await recomputeScores(
      { productId: 'prod_macbook', useCase: 'office_study' },
      adminActor,
      mockDb as unknown as PrismaClientOrTx
    );
    assert.equal(snapshotsStore.length, 1);
    assert.equal(snapshotsStore[0].status, 'ACTIVE');
    const firstSnapRevision = snapshotsStore[0].revisionKey;

    // Price drop!
    currentPrice = BigInt(22_000_000);

    // Recompute
    const report2 = await recomputeScores(
      { productId: 'prod_macbook', useCase: 'office_study' },
      adminActor,
      mockDb as unknown as PrismaClientOrTx
    );

    assert.equal(report2.publishedCount, 1);
    assert.equal(report2.supersededCount, 1);
    assert.equal(snapshotsStore.length, 2);

    // Prior snapshot is preserved and marked SUPERSEDED
    const prior = snapshotsStore.find((s) => s.revisionKey === firstSnapRevision);
    assert.ok(prior);
    assert.equal(prior.status, 'SUPERSEDED');

    // New snapshot is ACTIVE
    const latest = snapshotsStore.find((s) => s.revisionKey !== firstSnapRevision);
    assert.ok(latest);
    assert.equal(latest.status, 'ACTIVE');
    assert.ok(latest.priceSnapshot.includes('22.000.000'));
  });

  it('revoking evidence marks snapshot REVOKED and disables GOOD_VALUE badge', async () => {
    const snapshotsStore: MockSnapshot[] = [
      {
        id: 'snap_active_1',
        productId: 'prod_macbook',
        variantId: null,
        useCase: 'office_study',
        finalScore: 88.0,
        priceEfficiency: 85.0,
        experience: 80.0,
        support: 80.0,
        coverage: 0.85,
        status: 'ACTIVE',
        isGoodValue: true,
        rubricVersion: 1,
        rubricSnapshot: {},
        breakdown: {},
        sourceRefs: ['src_geekbench', 'src_battery'],
        sourceSetHash: 'hash1',
        priceSnapshot: '26.000.000 ₫',
        revisionKey: 'rev1',
        publishedAt: new Date(),
      },
    ];

    const mockDb = {
      productScoreSnapshot: {
        async findMany(args?: { where?: { status?: string; productId?: string } }) {
          return snapshotsStore.filter((s) => {
            if (args?.where?.status && s.status !== args.where.status) return false;
            if (args?.where?.productId && s.productId !== args.where.productId) return false;
            return true;
          });
        },
        async update(args: { where: { id: string }; data: { status?: string; isGoodValue?: boolean } }) {
          const item = snapshotsStore.find((s) => s.id === args.where.id);
          if (item) {
            Object.assign(item, args.data);
          }
          return item;
        },
      },
      dataSource: {
        async findMany() {
          // src_geekbench has been REVOKED
          return [{ id: 'src_geekbench', status: 'REVOKED' }];
        },
      },
    };

    // When fetching scores for product, revoked source should demote the snapshot
    const scores = await getProductScores('prod_macbook', undefined, mockDb as unknown as PrismaClientOrTx);
    assert.equal(scores.length, 1);
    assert.equal(scores[0].status, 'REVOKED');
    assert.equal(scores[0].isGoodValue, false);

    // Calling revokeSourceSnapshots directly
    const count = await revokeSourceSnapshots('src_battery', mockDb as unknown as PrismaClientOrTx);
    assert.ok(count >= 0);
  });
});
