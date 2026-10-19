import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustStock,
  validateAdjustmentInput,
} from '@server/modules/inventory/stock-adjustment.service';
import type { PrismaClient } from '@prisma/client';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

describe('Stock Adjustment - Input Validation', () => {
  it('should reject empty or missing reason', () => {
    const res = validateAdjustmentInput({
      productId: 'p1',
      variantId: null,
      delta: 5,
      expectedVersion: 0,
      reason: '',
      operationKey: 'op-1',
    });
    assert.equal(res.valid, false);
    assert.match((res as { error: string }).error, /lý do/i);
  });

  it('should reject zero delta', () => {
    const res = validateAdjustmentInput({
      productId: 'p1',
      variantId: null,
      delta: 0,
      expectedVersion: 0,
      reason: 'Testing',
      operationKey: 'op-1',
    });
    assert.equal(res.valid, false);
    assert.match((res as { error: string }).error, /khác 0/i);
  });

  it('should reject non-integer delta', () => {
    const res = validateAdjustmentInput({
      productId: 'p1',
      variantId: null,
      delta: 2.5,
      expectedVersion: 0,
      reason: 'Testing',
      operationKey: 'op-1',
    });
    assert.equal(res.valid, false);
    assert.match((res as { error: string }).error, /số nguyên/i);
  });

  it('should reject empty or missing operationKey', () => {
    const res = validateAdjustmentInput({
      productId: 'p1',
      variantId: null,
      delta: 5,
      expectedVersion: 0,
      reason: 'Testing',
      operationKey: '',
    });
    assert.equal(res.valid, false);
    assert.match((res as { error: string }).error, /mã thao tác|operationKey/i);
  });

  it('should accept valid adjustment input', () => {
    const res = validateAdjustmentInput({
      productId: 'p1',
      variantId: 'v1',
      delta: -3,
      expectedVersion: 2,
      reason: 'Hàng lỗi xuất kho',
      operationKey: 'op-valid-1',
    });
    assert.equal(res.valid, true);
  });
});

describe('Stock Adjustment - CAS Execution & Idempotency', () => {
  it('should return alreadyProcessed for duplicate operationKey without re-applying delta', async () => {
    const existingAdjustment = {
      id: 'adj_1',
      operationKey: 'op_dup_1',
      productId: 'p1',
      variantId: null,
      delta: 5,
      previousStock: 10,
      newStock: 15,
      version: 1,
      reason: 'Nhập bổ sung',
      actorId: 'admin_1',
      createdAt: new Date(),
    };

    const fakeTx = {
      stockAdjustment: {
        findUnique: async () => existingAdjustment,
      },
    } as unknown as TxClient;

    const res = await adjustStock(
      fakeTx,
      {
        productId: 'p1',
        variantId: null,
        delta: 5,
        expectedVersion: 0,
        reason: 'Nhập bổ sung',
        operationKey: 'op_dup_1',
      },
      'admin_1'
    );

    assert.equal(res.success, true);
    assert.equal(res.alreadyProcessed, true);
    assert.equal(res.newStock, 15);
    assert.equal(res.newVersion, 1);
  });

  it('should conflict when expectedVersion does not match current version', async () => {
    const fakeProduct = {
      id: 'p1',
      name: 'Item 1',
      stock: 10,
      stockVersion: 2, // version changed by another process
      inventoryMode: 'BASE',
      isActive: true,
    };

    const fakeTx = {
      stockAdjustment: {
        findUnique: async () => null,
      },
      product: {
        findUnique: async () => fakeProduct,
        updateMany: async () => ({ count: 0 }),
      },
    } as unknown as TxClient;

    const res = await adjustStock(
      fakeTx,
      {
        productId: 'p1',
        variantId: null,
        delta: -2,
        expectedVersion: 1, // Stale version
        reason: 'Xuất mẫu',
        operationKey: 'op_stale_1',
      },
      'admin_1'
    );

    assert.equal(res.success, false);
    assert.match(res.error!, /phiên bản|xung đột|conflict/i);
  });

  it('should reject adjustment if delta would result in negative stock', async () => {
    const fakeProduct = {
      id: 'p1',
      name: 'Item 1',
      stock: 3,
      stockVersion: 0,
      inventoryMode: 'BASE',
      isActive: true,
    };

    const fakeTx = {
      stockAdjustment: {
        findUnique: async () => null,
      },
      product: {
        findUnique: async () => fakeProduct,
        updateMany: async () => ({ count: 0 }),
      },
    } as unknown as TxClient;

    const res = await adjustStock(
      fakeTx,
      {
        productId: 'p1',
        variantId: null,
        delta: -5, // Exceeds current stock 3
        expectedVersion: 0,
        reason: 'Hủy hàng',
        operationKey: 'op_neg_1',
      },
      'admin_1'
    );

    assert.equal(res.success, false);
    assert.match(res.error!, /không đủ tồn kho|âm kho/i);
  });
});
