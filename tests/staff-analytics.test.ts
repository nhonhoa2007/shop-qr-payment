// tests/staff-analytics.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeStaffAnalytics } from '@server/modules/admin/staff-analytics.service';
import { getDashboardAnalyticsEndpoint } from '@client/lib/dashboard-analytics';

describe('Dashboard analytics endpoint selection', () => {
  it('loads staff operational analytics on the initial request', () => {
    assert.equal(getDashboardAnalyticsEndpoint('STAFF', 'today'), '/api/admin/analytics/staff');
  });

  it('keeps admin analytics for admin-selected ranges', () => {
    assert.equal(getDashboardAnalyticsEndpoint('ADMIN', 'today'), '/api/admin/analytics?range=today');
    assert.equal(getDashboardAnalyticsEndpoint('ADMIN', 'month'), '/api/admin/analytics?range=month');
  });
});

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

  it('serializes recent order totals as JSON-safe numbers', () => {
    const rawMetrics = {
      recentOrders: [{
        id: 'order-1',
        orderCode: 'DH000001',
        customerName: 'Khách hàng',
        customerPhone: '0900000000',
        itemsSummary: 'Sản phẩm x 1',
        totalAmount: 149000n,
        paymentStatus: 'PAID',
        status: 'COMPLETED',
        createdAt: '2026-10-22T00:00:00.000Z',
      }],
    };

    const sanitized = sanitizeStaffAnalytics(rawMetrics, ['orders']);
    assert.equal(sanitized.recentOrders?.[0].totalAmount, 149000);
    assert.doesNotThrow(() => JSON.stringify(sanitized));
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
