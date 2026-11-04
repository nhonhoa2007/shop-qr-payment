import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildRevenueComparison } from '@server/modules/admin/admin-analytics.service';

describe('revenue comparison', () => {
  it('uses matching seven-day windows without mixing the previous period into current revenue', () => {
    const currentStart = new Date(2026, 10, 1);
    const comparison = buildRevenueComparison('7days', currentStart, [
      { createdAt: new Date(2026, 9, 29, 12), totalAmount: 500 },
      { createdAt: new Date(2026, 10, 2, 12), totalAmount: 1200 },
    ]);

    assert.equal(comparison.current.length, 7);
    assert.equal(comparison.previous.length, 7);
    assert.equal(comparison.current.reduce((total, point) => total + point.revenue, 0), 1200);
    assert.equal(comparison.previous.reduce((total, point) => total + point.revenue, 0), 500);
  });

  it('compares today with yesterday hour by hour', () => {
    const comparison = buildRevenueComparison('today', new Date(2026, 10, 4), [
      { createdAt: new Date(2026, 10, 3, 9), totalAmount: 300 },
      { createdAt: new Date(2026, 10, 4, 9), totalAmount: 700 },
    ]);

    assert.equal(comparison.current[9].revenue, 700);
    assert.equal(comparison.previous[9].revenue, 300);
  });
});
