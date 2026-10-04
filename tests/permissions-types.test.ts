// tests/permissions-types.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  STAFF_PERMISSIONS,
  PERMISSION_LABELS,
  isStaffPermission,
} from '../src/shared/constants/permissions.ts';

describe('Shared Permission Constants', () => {
  it('should export all 5 core staff permissions', () => {
    assert.deepEqual([...STAFF_PERMISSIONS], [
      'orders',
      'products',
      'shipments',
      'chat',
      'reviews',
    ]);
  });

  it('should have descriptive Vietnamese labels for all permissions', () => {
    assert.equal(PERMISSION_LABELS.orders, 'Quản lý đơn hàng');
    assert.equal(PERMISSION_LABELS.products, 'Quản lý sản phẩm & kho');
    assert.equal(PERMISSION_LABELS.shipments, 'Quản lý vận đơn');
    assert.equal(PERMISSION_LABELS.chat, 'Chat CSKH');
    assert.equal(PERMISSION_LABELS.reviews, 'Quản lý đánh giá');
  });

  it('should validate permission type guard correctly', () => {
    assert.equal(isStaffPermission('orders'), true);
    assert.equal(isStaffPermission('products'), true);
    assert.equal(isStaffPermission('unknown'), false);
    assert.equal(isStaffPermission(null), false);
  });
});
