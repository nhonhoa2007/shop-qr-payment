import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAdminDashboardKpis,
  getStaffDashboardKpis,
  formatCompactVnd,
} from '@client/components/admin/dashboard/dashboard-presentation';

describe('admin dashboard KPI presentation', () => {
  const summary = {
    todayRevenue: 1_250_000,
    periodRevenue: 8_400_000,
    todayRevenueGrowth: 8.3,
    todayOrders: 12,
    totalOrders: 144,
    pendingOrdersCount: 3,
    qrMatchRate: 96.5,
  };

  it('shows today revenue and today orders for the today range', () => {
    const cards = getAdminDashboardKpis(summary, 'today');
    assert.deepEqual(cards.slice(0, 2).map(({ label, value }) => ({ label, value })), [
      { label: 'Doanh thu hôm nay', value: 1_250_000 },
      { label: 'Đơn hàng hôm nay', value: 12 },
    ]);
  });

  it('uses period revenue but labels the all-time order total honestly', () => {
    const cards = getAdminDashboardKpis(summary, '7days');
    assert.deepEqual(cards.slice(0, 2).map(({ label, value }) => ({ label, value })), [
      { label: 'Doanh thu 7 ngày', value: 8_400_000 },
      { label: 'Tổng đơn hàng', value: 144 },
    ]);
  });

  it('shows the selected period order count when analytics provides it', () => {
    const cards = getAdminDashboardKpis({ ...summary, periodOrdersCount: 21 }, '7days');
    assert.equal(cards[1].label, 'Đơn hàng 7 ngày');
    assert.equal(cards[1].value, 21);
  });

  it('shows QR match rate and active shipments in the overview strip', () => {
    const cards = getAdminDashboardKpis(summary, 'month');
    assert.deepEqual(cards.slice(2).map(({ key, value }) => ({ key, value })), [
      { key: 'qrMatch', value: 96.5 },
      { key: 'shipments', value: 0 },
    ]);
  });

  it('formats large currency values compactly while retaining full values elsewhere', () => {
    assert.equal(formatCompactVnd(3_477_090_000), '3,5 T ₫');
    assert.equal(formatCompactVnd(1_250_000), '1,3 Tr ₫');
    assert.equal(formatCompactVnd(950_000), '950.000 ₫');
  });

  it('renders zero values for an empty response', () => {
    assert.deepEqual(getAdminDashboardKpis(undefined, 'today').map((card) => card.value), [0, 0, 0, 0]);
  });
});

describe('staff dashboard KPI presentation', () => {
  it('shows only operational metrics granted by permissions', () => {
    const cards = getStaffDashboardKpis({ todayOrders: 6, pendingOrdersCount: 2, activeShipmentsCount: 4, lowStockCount: 3 }, ['orders']);
    assert.deepEqual(cards.map((card) => card.key), ['todayOrders', 'pending']);
  });

  it('does not show any financial metric for staff without permissions', () => {
    const cards = getStaffDashboardKpis({ todayRevenue: 1_000_000, qrMatchRate: 90 }, []);
    assert.deepEqual(cards, []);
  });
});
