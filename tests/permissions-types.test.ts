// tests/permissions-types.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  STAFF_PERMISSIONS,
  PERMISSION_LABELS,
  isStaffPermission,
} from '../src/shared/constants/permissions.ts';

describe('Shared Permission Constants', () => {
  it('should export all staff permissions including extended domain permissions', () => {
    assert.deepEqual([...STAFF_PERMISSIONS], [
      'orders',
      'products',
      'shipments',
      'chat',
      'reviews',
      'inventory',
      'warranties',
      'knowledge',
      'scoring',
      'assistant',
    ]);
  });

  it('should have descriptive Vietnamese labels for all permissions', () => {
    assert.equal(PERMISSION_LABELS.orders, 'Quản lý đơn hàng');
    assert.equal(PERMISSION_LABELS.products, 'Quản lý sản phẩm & danh mục');
    assert.equal(PERMISSION_LABELS.shipments, 'Quản lý vận đơn');
    assert.equal(PERMISSION_LABELS.chat, 'Chat CSKH');
    assert.equal(PERMISSION_LABELS.reviews, 'Quản lý đánh giá');
    assert.equal(PERMISSION_LABELS.inventory, 'Quản lý kho & nhập hàng');
    assert.equal(PERMISSION_LABELS.warranties, 'Quản lý bảo hành & đổi trả');
    assert.equal(PERMISSION_LABELS.knowledge, 'Quản lý tri thức & nguồn dữ liệu');
    assert.equal(PERMISSION_LABELS.scoring, 'Quản lý công thức đánh giá & P/P');
    assert.equal(PERMISSION_LABELS.assistant, 'Giám sát trợ lý AI');
  });

  it('should validate permission type guard correctly', () => {
    assert.equal(isStaffPermission('orders'), true);
    assert.equal(isStaffPermission('products'), true);
    assert.equal(isStaffPermission('unknown'), false);
    assert.equal(isStaffPermission(null), false);
  });
});
