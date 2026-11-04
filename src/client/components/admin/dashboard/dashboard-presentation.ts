import type { KpiSummaryData } from './AdminKpiStrip';
import type { RevenueBarRange } from './AdminRevenueBars';
import { formatVND } from '@shared/utils';

export interface DashboardKpi {
  key: string;
  label: string;
  value: number;
  format: 'currency' | 'number' | 'percent';
  detail: string;
}

export function formatCompactVnd(value: number): string {
  const formatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
  if (Math.abs(value) >= 1_000_000_000) return `${formatter.format(value / 1_000_000_000)} T ₫`;
  if (Math.abs(value) >= 1_000_000) return `${formatter.format(value / 1_000_000)} Tr ₫`;
  return formatVND(value);
}

export function getAdminDashboardKpis(summary: KpiSummaryData | undefined, range: RevenueBarRange): DashboardKpi[] {
  const periodLabel = range === 'today' ? 'hôm nay' : range === '7days' ? '7 ngày' : '30 ngày';
  return [
    {
      key: 'revenue',
      label: `Doanh thu ${periodLabel}`,
      value: range === 'today' ? summary?.todayRevenue ?? 0 : summary?.periodRevenue ?? 0,
      format: 'currency',
      detail: range === 'today' && summary?.todayRevenueGrowth !== undefined
        ? `${summary.todayRevenueGrowth > 0 ? '+' : ''}${summary.todayRevenueGrowth}% so với hôm qua`
        : 'Đã thanh toán trong kỳ',
    },
    {
      key: 'orders',
      label: range === 'today' ? 'Đơn hàng hôm nay' : summary?.periodOrdersCount === undefined ? 'Tổng đơn hàng' : `Đơn hàng ${periodLabel}`,
      value: range === 'today' ? summary?.todayOrders ?? 0 : summary?.periodOrdersCount ?? summary?.totalOrders ?? 0,
      format: 'number',
      detail: range === 'today' ? 'Đơn phát sinh hôm nay' : summary?.periodOrdersCount === undefined ? 'Tất cả đơn từ trước đến nay' : 'Đơn phát sinh trong kỳ',
    },
    {
      key: 'qrMatch',
      label: 'Tỷ lệ khớp VietQR',
      value: summary?.qrMatchRate ?? 0,
      format: 'percent',
      detail: `${summary?.matchedTransactionsCount ?? 0} / ${summary?.totalTransactions ?? 0} giao dịch đã khớp`,
    },
    {
      key: 'shipments',
      label: 'Đơn đang giao',
      value: summary?.activeShipmentsCount ?? 0,
      format: 'number',
      detail: 'Vận đơn GHN đang vận chuyển',
    },
  ];
}

export function getStaffDashboardKpis(summary: KpiSummaryData | undefined, permissions: readonly string[]): DashboardKpi[] {
  const cards: DashboardKpi[] = [];
  if (permissions.includes('orders')) {
    cards.push(
      { key: 'todayOrders', label: 'Đơn hàng hôm nay', value: summary?.todayOrders ?? 0, format: 'number', detail: 'Đơn phát sinh trong ngày' },
      { key: 'pending', label: 'Đơn chờ xử lý', value: summary?.pendingOrdersCount ?? 0, format: 'number', detail: 'Cần xác nhận đóng gói' },
    );
  }
  if (permissions.includes('shipments')) {
    cards.push({ key: 'shipments', label: 'Vận đơn đang giao', value: summary?.activeShipmentsCount ?? 0, format: 'number', detail: 'Đang vận chuyển' });
  }
  if (permissions.includes('products')) {
    cards.push({ key: 'lowStock', label: 'Cảnh báo tồn kho', value: summary?.lowStockCount ?? 0, format: 'number', detail: 'Sản phẩm còn tối đa 5' });
  }
  return cards;
}
