import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOrderItemSnapshot,
  serializeOrderItemDto,
} from '@server/modules/orders/order-item-snapshot.service';
import type { OrderItemSnapshotInput } from '@server/modules/orders/order-item-snapshot.service';

describe('OrderItem Electronics Terms Snapshot & Immutability', () => {
  const mockProduct = {
    id: 'prod-macbook-m3',
    name: 'MacBook Pro 14 inch M3',
    slug: 'macbook-pro-14-m3',
    price: BigInt(39990000),
    weightGrams: 1550,
    lengthCm: 31,
    widthCm: 22,
    heightCm: 2,
    warrantyConfig: {
      policyType: 'OFFICIAL',
      periodMonths: 12,
      provider: 'Apple Vietnam',
    },
    categoryRef: {
      id: 'cat-laptop',
      specSchemaVersion: 1,
      warrantyConfig: {
        policyType: 'OFFICIAL',
        periodMonths: 12,
      },
    },
  };

  const mockVariant = {
    id: 'var-mbp-sg-512',
    sku: 'MBP14-M3-8-512-SG',
    title: 'Xám không gian / 8GB / 512GB',
    price: BigInt(39990000),
    optionValues: {
      color: 'Space Grey',
      ram: 8,
      ssd: 512,
    },
    warrantyConfig: null,
  };

  const mockActiveSource = {
    id: 'src-apple-mbp14',
    version: '2024.1',
    status: 'ACTIVE',
  };

  it('builds immutable electronics snapshot from verified product and variant data', () => {
    const input: OrderItemSnapshotInput = {
      product: mockProduct,
      variant: mockVariant,
      activeSource: mockActiveSource,
      quantity: 2,
    };

    const snapshot = buildOrderItemSnapshot(input);

    assert.equal(snapshot.productName, 'MacBook Pro 14 inch M3');
    assert.equal(snapshot.sku, 'MBP14-M3-8-512-SG');
    assert.equal(snapshot.unitPrice, BigInt(39990000));
    assert.deepEqual(snapshot.variantOptions, {
      color: 'Space Grey',
      ram: 8,
      ssd: 512,
    });
    assert.deepEqual(snapshot.warrantySnapshot, {
      policyType: 'OFFICIAL',
      periodMonths: 12,
      provider: 'Apple Vietnam',
    });
    assert.deepEqual(snapshot.packingLineSnapshot, {
      unitWeightGrams: 1550,
      totalWeightGrams: 3100,
      lengthCm: 31,
      widthCm: 22,
      heightCm: 2,
    });
    assert.equal(snapshot.schemaRevision, 1);
    assert.equal(snapshot.sourceRevision, '2024.1');
  });

  it('ignores spoofed client input and derives snapshot exclusively from backend DB records', () => {
    const maliciousClientPayload = {
      productName: 'Spoofed Fake Product Name',
      sku: 'SPOOFED-SKU-999',
      unitPrice: BigInt(1000),
      warrantySnapshot: { periodMonths: 999 },
      schemaRevision: 99,
    };

    const input: OrderItemSnapshotInput = {
      product: mockProduct,
      variant: mockVariant,
      activeSource: mockActiveSource,
      quantity: 1,
      clientPayload: maliciousClientPayload,
    };

    const snapshot = buildOrderItemSnapshot(input);

    // Guaranteed to match verified DB records, not malicious client input
    assert.equal(snapshot.productName, mockProduct.name);
    assert.equal(snapshot.sku, mockVariant.sku);
    assert.equal(snapshot.unitPrice, mockVariant.price);
    assert.notEqual(snapshot.unitPrice, BigInt(1000));
    assert.equal(snapshot.schemaRevision, 1);
  });

  it('preserves historical snapshot fidelity when catalog records are mutated subsequently', () => {
    const input: OrderItemSnapshotInput = {
      product: mockProduct,
      variant: mockVariant,
      activeSource: mockActiveSource,
      quantity: 1,
    };

    // 1. Snapshot taken at order placement
    const initialSnapshot = buildOrderItemSnapshot(input);

    // 2. Later, admin updates product name, price, warranty and source in catalog
    const mutatedProduct = {
      ...mockProduct,
      name: 'MacBook Pro 14 M3 - 2026 Refurbished Edition',
      price: BigInt(45000000),
      warrantyConfig: { policyType: 'SHOP_WARRANTY', periodMonths: 3 },
    };
    const mutatedVariant = {
      ...mockVariant,
      sku: 'NEW-SKU-2026',
      price: BigInt(45000000),
    };
    const mutatedSource = {
      ...mockActiveSource,
      version: '2026.2',
    };

    // 3. Serialized DTO uses stored OrderItem snapshot and does NOT reflect mutations
    const serializedDto = serializeOrderItemDto({
      id: 'order-item-123',
      orderId: 'order-abc',
      productId: mockProduct.id,
      variantId: mockVariant.id,
      quantity: 1,
      price: initialSnapshot.unitPrice,
      productName: initialSnapshot.productName,
      sku: initialSnapshot.sku,
      variantOptions: initialSnapshot.variantOptions,
      unitPrice: initialSnapshot.unitPrice,
      warrantySnapshot: initialSnapshot.warrantySnapshot,
      packingLineSnapshot: initialSnapshot.packingLineSnapshot,
      schemaRevision: initialSnapshot.schemaRevision,
      sourceRevision: initialSnapshot.sourceRevision,
      returnedQuantity: 0,
      product: mutatedProduct,
      variant: mutatedVariant,
    });

    assert.equal(serializedDto.productName, 'MacBook Pro 14 inch M3');
    assert.equal(serializedDto.sku, 'MBP14-M3-8-512-SG');
    assert.equal(serializedDto.unitPrice.amount, '39990000');
    assert.deepEqual(serializedDto.warranty, {
      policyType: 'OFFICIAL',
      periodMonths: 12,
      provider: 'Apple Vietnam',
    });
    assert.equal(serializedDto.sourceRevision, '2024.1');
    assert.equal(mutatedSource.version, '2026.2');
  });

  it('gracefully handles legacy products without structured electronics specs or categoryRef', () => {
    const legacyProduct = {
      id: 'prod-legacy-1',
      name: 'Áo Thun Basic Cotton',
      slug: 'ao-thun-basic-cotton',
      price: BigInt(150000),
      weightGrams: null,
      lengthCm: null,
      widthCm: null,
      heightCm: null,
      warrantyConfig: null,
      categoryRef: null,
    };

    const input: OrderItemSnapshotInput = {
      product: legacyProduct,
      variant: null,
      activeSource: null,
      quantity: 1,
    };

    const snapshot = buildOrderItemSnapshot(input);

    assert.equal(snapshot.productName, 'Áo Thun Basic Cotton');
    assert.equal(snapshot.sku, 'ao-thun-basic-cotton');
    assert.equal(snapshot.unitPrice, BigInt(150000));
    assert.equal(snapshot.variantOptions, null);
    assert.equal(snapshot.warrantySnapshot, null);
    assert.deepEqual(snapshot.packingLineSnapshot, {
      unitWeightGrams: 200, // Safe legacy default
      totalWeightGrams: 200,
      lengthCm: 20,
      widthCm: 15,
      heightCm: 5,
    });
    assert.equal(snapshot.schemaRevision, null);
    assert.equal(snapshot.sourceRevision, null);
  });
});
