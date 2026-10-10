// tests/staff-analytics.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeStaffAnalytics } from '../src/server/modules/admin/staff-analytics.service.ts';

describe('Staff Operational Analytics Sanitization', () => {
  it('should completely strip financial metrics from staff response', () => {
    const rawMetrics = {
      totalRevenue: 100_000_000,
      todayRevenue: 5_000_000,
      qrMatchRate: 98.5,
      todayOrders: 12,
      pendingOrdersCount: 4,
      processingOrdersCount: 3,
      lowStockCount: 2,
    };

    const sanitized = sanitizeStaffAnalytics(rawMetrics, ['orders', 'products']);
    assert.equal('totalRevenue' in sanitized, false);
    assert.equal('todayRevenue' in sanitized, false);
    assert.equal('qrMatchRate' in sanitized, false);
    assert.equal(sanitized.todayOrders, 12);
    assert.equal(sanitized.pendingOrdersCount, 4);
    assert.equal(sanitized.lowStockCount, 2);
  });

  it('should only include metrics matching granted permissions', () => {
    const rawMetrics = {
      todayOrders: 10,
      lowStockCount: 5,
      activeShipmentsCount: 3,
    };

    const sanitizedOrdersOnly = sanitizeStaffAnalytics(rawMetrics, ['orders']);
    assert.equal(sanitizedOrdersOnly.todayOrders, 10);
    assert.equal('lowStockCount' in sanitizedOrdersOnly, false);
    assert.equal('activeShipmentsCount' in sanitizedOrdersOnly, false);
  });
});
