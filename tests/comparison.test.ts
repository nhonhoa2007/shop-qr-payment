import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareProducts,
  normalizeCanonicalSpec,
} from '../src/server/modules/intelligence/comparison.service.ts';
import type { PrismaClientOrTx } from '../src/server/modules/intelligence/scoring.service.ts';

describe('Commerce Intelligence: Product Comparison Engine', () => {
  it('enforces comparison of exactly 2 or 3 items', async () => {
    const mockDb = {} as unknown as PrismaClientOrTx;

    await assert.rejects(
      async () => {
        await compareProducts({ items: [{ productId: 'p1' }] }, mockDb);
      },
      { message: /Yêu cầu so sánh từ 2 đến 3 sản phẩm/ }
    );

    await assert.rejects(
      async () => {
        await compareProducts(
          {
            items: [
              { productId: 'p1' },
              { productId: 'p2' },
              { productId: 'p3' },
              { productId: 'p4' },
            ],
          },
          mockDb
        );
      },
      { message: /Yêu cầu so sánh từ 2 đến 3 sản phẩm/ }
    );
  });

  it('rejects duplicate products/variants in the comparison list', async () => {
    const mockDb = {} as unknown as PrismaClientOrTx;

    await assert.rejects(
      async () => {
        await compareProducts(
          {
            items: [
              { productId: 'p1', variantId: 'v1' },
              { productId: 'p1', variantId: 'v1' },
            ],
          },
          mockDb
        );
      },
      { message: /Không được chọn trùng sản phẩm hoặc phiên bản/ }
    );
  });

  it('rejects comparing products across different categories', async () => {
    const mockDb = {
      product: {
        async findMany() {
          return [
            {
              id: 'p1',
              name: 'Laptop Asus',
              categoryId: 'cat_laptop',
              category: { id: 'cat_laptop', name: 'Laptop' },
              brand: { name: 'Asus' },
              price: BigInt(20_000_000),
              stock: 10,
              isActive: true,
              specs: {},
              variants: [],
            },
            {
              id: 'p2',
              name: 'Tai nghe Sony',
              categoryId: 'cat_audio',
              category: { id: 'cat_audio', name: 'Audio' },
              brand: { name: 'Sony' },
              price: BigInt(5_000_000),
              stock: 20,
              isActive: true,
              specs: {},
              variants: [],
            },
          ];
        },
      },
    };

    await assert.rejects(
      async () => {
        await compareProducts(
          {
            items: [{ productId: 'p1' }, { productId: 'p2' }],
          },
          mockDb as unknown as PrismaClientOrTx
        );
      },
      { message: /Chỉ được so sánh các sản phẩm trong cùng danh mục/ }
    );
  });

  it('correctly distinguishes UNKNOWN (missing info) from UNSUPPORTED (explicit absence of capability)', () => {
    // 1. Explicitly unsupported capability (e.g. dedicated GPU: false, or optical drive: "none")
    const unsupportedBool = normalizeCanonicalSpec('dedicated_gpu', false);
    assert.equal(unsupportedBool.status, 'UNSUPPORTED');
    assert.equal(unsupportedBool.canonicalValue, false);

    const unsupportedNone = normalizeCanonicalSpec('touchscreen', 'none');
    assert.equal(unsupportedNone.status, 'UNSUPPORTED');

    // 2. Explicitly known capability
    const knownSpec = normalizeCanonicalSpec('ram_gb', 16);
    assert.equal(knownSpec.status, 'KNOWN');
    assert.equal(knownSpec.canonicalValue, 16);
    assert.equal(knownSpec.unit, 'GB');

    // 3. Unknown / missing capability
    const unknownSpecNull = normalizeCanonicalSpec('battery_wh', null);
    assert.equal(unknownSpecNull.status, 'UNKNOWN');

    const unknownSpecUndefined = normalizeCanonicalSpec('screen_nits', undefined);
    assert.equal(unknownSpecUndefined.status, 'UNKNOWN');

    const unknownSpecN_A = normalizeCanonicalSpec('water_resistance', 'N/A');
    assert.equal(unknownSpecN_A.status, 'UNKNOWN');
  });

  it('generates comparison DTO with live prices, score snapshots, net sales, separated reviews, and objective trade-offs without unsolicited winner', async () => {
    const mockDb = {
      product: {
        async findMany() {
          return [
            {
              id: 'p1',
              name: 'ThinkPad T14 Gen 4',
              categoryId: 'cat_laptop',
              category: { id: 'cat_laptop', name: 'Laptop' },
              brand: { name: 'Lenovo' },
              price: BigInt(26_000_000),
              stock: 5,
              isActive: true,
              specs: {
                ram_gb: 16,
                weight_kg: 1.36,
                battery_wh: 52.5,
                dedicated_gpu: false,
              },
              variants: [],
            },
            {
              id: 'p2',
              name: 'MacBook Air M2',
              categoryId: 'cat_laptop',
              category: { id: 'cat_laptop', name: 'Laptop' },
              brand: { name: 'Apple' },
              price: BigInt(24_500_000),
              stock: 8,
              isActive: true,
              specs: {
                ram_gb: 8,
                weight_kg: 1.24,
                battery_wh: 52.6,
                dedicated_gpu: false,
              },
              variants: [],
            },
          ];
        },
      },
      orderItem: {
        async findMany() {
          return [
            {
              productId: 'p1',
              quantity: 10,
              returnedQuantity: 1,
              price: BigInt(26_000_000),
              order: { status: 'COMPLETED', completedAt: new Date() },
            },
            {
              productId: 'p2',
              quantity: 25,
              returnedQuantity: 2,
              price: BigInt(24_500_000),
              order: { status: 'COMPLETED', completedAt: new Date() },
            },
          ];
        },
      },
      review: {
        async findMany() {
          return [
            {
              productId: 'p1',
              rating: 5,
              comment: 'Bàn phím gõ tuyệt đỉnh, tản nhiệt tốt',
              isApproved: true,
            },
            {
              productId: 'p2',
              rating: 5,
              comment: 'Pin rất trâu dùng 15 tiếng, máy mỏng nhẹ',
              isApproved: true,
            },
          ];
        },
      },
      dataSource: {
        async findMany() {
          return [];
        },
      },
      productScoreSnapshot: {
        async findMany() {
          return [
            {
              id: 'snap_p1',
              productId: 'p1',
              useCase: 'office_study',
              finalScore: 88.5,
              priceEfficiency: 82.0,
              experience: 90.0,
              support: 92.0,
              coverage: 0.95,
              status: 'PUBLISHED',
              isGoodValue: true,
              rubricVersion: 1,
              priceSnapshot: '26000000',
              publishedAt: new Date(),
            },
            {
              id: 'snap_p2',
              productId: 'p2',
              useCase: 'office_study',
              finalScore: 91.2,
              priceEfficiency: 89.0,
              experience: 94.0,
              support: 88.0,
              coverage: 0.95,
              status: 'PUBLISHED',
              isGoodValue: true,
              rubricVersion: 1,
              priceSnapshot: '24500000',
              publishedAt: new Date(),
            },
          ];
        },
      },
    };

    const comparison = await compareProducts(
      {
        items: [{ productId: 'p1' }, { productId: 'p2' }],
        useCase: 'office_study',
      },
      mockDb as unknown as PrismaClientOrTx
    );

    assert.equal(comparison.categoryId, 'cat_laptop');
    assert.equal(comparison.items.length, 2);

    // Live prices
    assert.equal(comparison.items[0].priceVnd, '26000000');
    assert.equal(comparison.items[1].priceVnd, '24500000');

    // Score snapshots present
    assert.ok(comparison.items[0].scoreSnapshot);
    assert.ok(comparison.items[1].scoreSnapshot);
    assert.equal(comparison.items[0].scoreSnapshot?.finalScore, 88.5);
    assert.equal(comparison.items[1].scoreSnapshot?.finalScore, 91.2);

    // Net sales present
    assert.ok(comparison.items[0].netSales);
    assert.equal(comparison.items[0].netSales?.netUnits, 9);
    assert.equal(comparison.items[1].netSales?.netUnits, 23);

    // Separated reviews present
    assert.ok(comparison.items[0].reviews?.shop);
    assert.ok(comparison.items[1].reviews?.shop);

    // Specs canonical
    assert.equal(comparison.items[0].canonicalSpecs.ram_gb.status, 'KNOWN');
    assert.equal(comparison.items[0].canonicalSpecs.ram_gb.canonicalValue, 16);
    assert.equal(comparison.items[0].canonicalSpecs.dedicated_gpu.status, 'UNSUPPORTED');

    // Trade-off summaries without subjective overall winner
    assert.ok(Array.isArray(comparison.tradeOffSummary));
    assert.ok(comparison.tradeOffSummary.length > 0);
    // Ensure no biased unsolicited winner is decreed
    for (const tradeOff of comparison.tradeOffSummary) {
      assert.equal(tradeOff.toLowerCase().includes('winner is'), false);
      assert.equal(tradeOff.toLowerCase().includes('tuyệt đối tốt nhất'), false);
    }
  });
});
