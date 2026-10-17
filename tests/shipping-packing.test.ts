import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPackingSnapshot,
  PackingDataMissingError,
  type PackingSourceItem,
} from '@server/modules/shipping/packing.service';

describe('Shipping Packing Snapshot Builder', () => {
  it('should throw PackingDataMissingError when weight or dimensions are missing or non-positive', () => {
    const invalidItems: PackingSourceItem[] = [
      {
        productId: 'prod_laptop',
        variantId: null,
        quantity: 1,
        weightGrams: null, // missing
        lengthCm: 35,
        widthCm: 25,
        heightCm: 3,
      },
    ];

    assert.throws(
      () => buildPackingSnapshot(invalidItems, 25_000_000n),
      (err: unknown) => {
        assert.ok(err instanceof PackingDataMissingError);
        assert.equal(err.code, 'PACKING_DATA_MISSING');
        assert.equal(err.missingItems.length, 1);
        assert.equal(err.missingItems[0].field, 'weightGrams');
        return true;
      }
    );

    const nonPositiveItems: PackingSourceItem[] = [
      {
        productId: 'prod_phone',
        variantId: 'v1',
        quantity: 1,
        weightGrams: 200,
        lengthCm: 0, // non-positive
        widthCm: 8,
        heightCm: 1,
      },
    ];

    assert.throws(
      () => buildPackingSnapshot(nonPositiveItems, 15_000_000n),
      (err: unknown) => {
        assert.ok(err instanceof PackingDataMissingError);
        assert.equal(err.missingItems[0].field, 'lengthCm');
        return true;
      }
    );
  });

  it('should aggregate multiple quantities and items deterministically', () => {
    const validItems: PackingSourceItem[] = [
      {
        productId: 'prod_laptop',
        variantId: null,
        quantity: 2,
        weightGrams: 1800,
        lengthCm: 36,
        widthCm: 26,
        heightCm: 3,
      },
      {
        productId: 'prod_mouse',
        variantId: 'v_mouse_black',
        quantity: 3,
        weightGrams: 120,
        lengthCm: 12,
        widthCm: 7,
        heightCm: 4,
      },
    ];

    const snapshot = buildPackingSnapshot(validItems, 50_000_000n);

    // Total weight: 2 * 1800 + 3 * 120 = 3600 + 360 = 3960 grams
    assert.equal(snapshot.totalWeightGrams, 3960);
    // Insured value is decimal string MoneyVnd
    assert.equal(snapshot.insuredValue, '50000000');
    // Lines count
    assert.equal(snapshot.lines.length, 2);
    // Revision is non-empty hex string
    assert.ok(typeof snapshot.revision === 'string' && snapshot.revision.length >= 8);
    // Conservative rectangular bounding box: max footprint, stacked height
    assert.ok(snapshot.lengthCm >= 36);
    assert.ok(snapshot.widthCm >= 26);
    assert.ok(snapshot.heightCm >= 3 * 2 + 4 * 3);
  });

  it('should produce identical revision hash for identical inputs', () => {
    const itemsA: PackingSourceItem[] = [
      {
        productId: 'p1',
        variantId: 'v1',
        quantity: 1,
        weightGrams: 500,
        lengthCm: 20,
        widthCm: 15,
        heightCm: 5,
      },
    ];
    const itemsB: PackingSourceItem[] = [
      {
        productId: 'p1',
        variantId: 'v1',
        quantity: 1,
        weightGrams: 500,
        lengthCm: 20,
        widthCm: 15,
        heightCm: 5,
      },
    ];

    const snapA = buildPackingSnapshot(itemsA, 1_000_000n);
    const snapB = buildPackingSnapshot(itemsB, 1_000_000n);

    assert.equal(snapA.revision, snapB.revision);
  });
});
