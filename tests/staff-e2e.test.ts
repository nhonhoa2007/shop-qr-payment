// tests/staff-e2e.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOperatorAccess } from '../src/server/modules/admin/guards.ts';
import { filterValidPermissions } from '../src/server/modules/admin/permission.service.ts';
import { sanitizeStaffAnalytics } from '../src/server/modules/admin/staff-analytics.service.ts';
import { STAFF_PERMISSIONS, isStaffPermission } from '../src/shared/constants/permissions.ts';

describe('Staff Permission Matrix End-to-End Invariants', () => {
  it('Invariant 1: Admin always has full access to every module', () => {
    const admin = { id: 'admin_1', role: 'ADMIN', permissions: [] };
    for (const mod of STAFF_PERMISSIONS) {
      assert.equal(resolveOperatorAccess(admin, mod), true);
    }
  });

  it('Invariant 2: Staff only accesses modules explicitly granted', () => {
    const orderStaff = { id: 'staff_1', role: 'STAFF', permissions: ['orders'] };
    assert.equal(resolveOperatorAccess(orderStaff, 'orders'), true);
    assert.equal(resolveOperatorAccess(orderStaff, 'products'), false);
    assert.equal(resolveOperatorAccess(orderStaff, 'shipments'), false);
    assert.equal(resolveOperatorAccess(orderStaff, 'chat'), false);
    assert.equal(resolveOperatorAccess(orderStaff, 'reviews'), false);

    const warehouseStaff = { id: 'staff_2', role: 'STAFF', permissions: ['products', 'shipments'] };
    assert.equal(resolveOperatorAccess(warehouseStaff, 'orders'), false);
    assert.equal(resolveOperatorAccess(warehouseStaff, 'products'), true);
    assert.equal(resolveOperatorAccess(warehouseStaff, 'shipments'), true);
    assert.equal(resolveOperatorAccess(warehouseStaff, 'chat'), false);
    assert.equal(resolveOperatorAccess(warehouseStaff, 'reviews'), false);
  });

  it('Invariant 3: Customers have zero operator access', () => {
    const customer = { id: 'cust_1', role: 'CUSTOMER', permissions: ['orders', 'products'] };
    for (const mod of STAFF_PERMISSIONS) {
      assert.equal(resolveOperatorAccess(customer, mod), false);
    }
  });

  it('Invariant 4: Staff analytics sanitization never leaks financial fields', () => {
    const rawMetrics = {
      totalRevenue: 500_000_000,
      todayRevenue: 25_000_000,
      todayRevenueGrowth: 15.5,
      periodRevenue: 120_000_000,
      qrMatchRate: 99.2,
      todayOrders: 50,
      pendingOrdersCount: 5,
      lowStockCount: 3,
      urgentActions: [
        {
          id: '1',
          type: 'TRANSACTION_MISMATCH',
          title: 'Lệch tiền',
          description: 'Lệch 50k',
          link: '/admin/transactions',
        },
        {
          id: '2',
          type: 'NEW_ORDER',
          title: 'Đơn mới',
          description: 'Có đơn mới',
          link: '/admin/orders',
        },
      ],
    };

    const sanitized = sanitizeStaffAnalytics(rawMetrics, ['orders']);
    assert.equal((sanitized as Record<string, unknown>).totalRevenue, undefined);
    assert.equal((sanitized as Record<string, unknown>).todayRevenue, undefined);
    assert.equal((sanitized as Record<string, unknown>).todayRevenueGrowth, undefined);
    assert.equal((sanitized as Record<string, unknown>).qrMatchRate, undefined);
    assert.equal(sanitized.todayOrders, 50);
    assert.equal(sanitized.pendingOrdersCount, 5);

    // Urgent action TRANSACTION_MISMATCH must be stripped
    assert.equal(sanitized.urgentActions?.length, 1);
    assert.equal(sanitized.urgentActions?.[0].type, 'NEW_ORDER');
  });

  it('Invariant 5: Permission input filtering strips invalid strings and objects', () => {
    const dirty = ['orders', 'hack_db', 999, null, 'products', 'products'];
    const clean = filterValidPermissions(dirty);
    assert.deepEqual(clean, ['orders', 'products']);
    clean.forEach((p) => assert.equal(isStaffPermission(p), true));
  });
});
