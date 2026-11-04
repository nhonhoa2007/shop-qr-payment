'use client';

import { formatVND } from '@shared/utils';
import { formatCompactVnd, getAdminDashboardKpis, getStaffDashboardKpis, type DashboardKpi } from './dashboard-presentation';

export interface KpiSummaryData {
  totalRevenue?: number;
  todayRevenue?: number;
  todayRevenueGrowth?: number;
  totalOrders?: number;
  todayOrders?: number;
  periodOrdersCount?: number;
  totalPaidOrders?: number;
  pendingOrdersCount?: number;
  processingOrdersCount?: number;
  qrMatchRate?: number;
  unmatchedTransactionsCount?: number;
  activeShipmentsCount?: number;
  lowStockCount?: number;
  totalCustomers?: number;
  periodRevenue?: number;
  totalTransactions?: number;
  matchedTransactionsCount?: number;
  deliveredShipmentsCount?: number;
  totalShipmentsCount?: number;
}

function displayValue(card: DashboardKpi): string {
  if (card.format === 'percent') return `${card.value}%`;
  if (card.format === 'number') return card.value.toLocaleString('vi-VN');
  return formatCompactVnd(card.value);
}

function KpiCards({ cards, loading }: { cards: DashboardKpi[]; loading: boolean }) {
  if (cards.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-4" aria-label="Chỉ số kinh doanh">
      {cards.map((card) => (
        <article key={card.key} className="min-w-0 bg-white p-5">
          <p className="text-xs font-medium text-slate-600">{card.label}</p>
          {loading ? (
            <div className="mt-3 h-8 w-24 rounded bg-slate-100" aria-hidden="true" />
          ) : (
            <p className="mt-2 truncate text-[30px] font-semibold leading-tight tracking-tight text-slate-900" title={card.format === 'currency' ? formatVND(card.value) : undefined}>
              {displayValue(card)}
            </p>
          )}
          <p className="mt-2 truncate text-xs text-slate-500">{card.detail}</p>
        </article>
      ))}
    </div>
  );
}

export function AdminKpiStrip({
  summary,
  timeRange = 'today',
  loading = false,
}: {
  summary?: KpiSummaryData;
  timeRange?: 'today' | '7days' | 'month';
  loading?: boolean;
}) {
  return <KpiCards cards={getAdminDashboardKpis(summary, timeRange)} loading={loading && !summary} />;
}

export function StaffKpiStrip({
  summary,
  permissions,
  loading = false,
}: {
  summary?: KpiSummaryData;
  permissions: readonly string[];
  loading?: boolean;
}) {
  return <KpiCards cards={getStaffDashboardKpis(summary, permissions)} loading={loading && !summary} />;
}
