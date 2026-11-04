'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useHydrated } from '@client/hooks/useHydrated';
import { pusherClient } from '@client/infrastructure/pusher-client';
import { getDashboardAnalyticsEndpoint } from '@client/lib/dashboard-analytics';
import { createLatestAsyncGuard } from '@client/lib/latest-async-guard';
import { AdminKpiStrip, StaffKpiStrip, KpiSummaryData } from '@client/components/admin/dashboard/AdminKpiStrip';
import { AdminRevenueBars, RevenueBarRange, RevenueBarPoint } from '@client/components/admin/dashboard/AdminRevenueBars';
import { AdminDonutChart, DonutPaymentDistribution } from '@client/components/admin/dashboard/AdminDonutChart';
import { AdminTopProducts, TopProductItem } from '@client/components/admin/dashboard/AdminTopProducts';
import { AdminCustomersCard, CustomerTrendPoint } from '@client/components/admin/dashboard/AdminCustomersCard';
import { AdminRevenueShareCard } from '@client/components/admin/dashboard/AdminRevenueShareCard';
import { AdminRealtimeOrdersCard } from '@client/components/admin/dashboard/AdminRealtimeOrdersCard';
import { AdminActionCenter, UrgentActionItem } from '@client/components/admin/dashboard/AdminActionCenter';
import { AdminRecentOrdersTable, RecentOrderItem } from '@client/components/admin/dashboard/AdminRecentOrdersTable';
import { AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';
import { ToggleGroup } from '@animate-ui/react/primitives/radix-ui/toggle-group';
import { canAccessAdminPage } from '@shared/admin-page-access';

interface AnalyticsPayload {
  error?: boolean;
  summary?: KpiSummaryData;
  ordersByStatus?: Record<string, number>;
  revenueTrend?: RevenueBarPoint[];
  previousRevenueTrend?: RevenueBarPoint[];
  newCustomersTrend?: CustomerTrendPoint[];
  paymentMethodDistribution?: DonutPaymentDistribution;
  paymentDistributionSampleCount?: number;
  urgentActions?: UrgentActionItem[];
  recentOrders?: RecentOrderItem[];
  topProducts?: TopProductItem[];
}

const PERIOD_LABELS: Record<RevenueBarRange, string> = {
  today: 'hôm nay',
  '7days': '7 ngày qua',
  month: '30 ngày qua',
};

async function loadAnalytics(role: string | undefined, range: RevenueBarRange): Promise<unknown> {
  const response = await fetch(getDashboardAnalyticsEndpoint(role, range));
  if (!response.ok) throw new Error(`Analytics fetch failed with status ${response.status}`);
  return response.json();
}

function normalizeAnalytics(payload: unknown, isStaff: boolean): AnalyticsPayload {
  if (!isStaff) return payload as AnalyticsPayload;
  const staff = payload as KpiSummaryData & AnalyticsPayload;
  return { ...staff, summary: staff };
}

export interface AdminDashboardViewProps {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string;
    permissions?: string[];
  };
}

export function AdminDashboardView({ user }: AdminDashboardViewProps = {}) {
  const isStaff = user?.role === 'STAFF';
  const userPermissions = (user?.permissions || []) as string[];

  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [timeRange, setTimeRange] = useState<RevenueBarRange>('today');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isHydrated = useHydrated();
  const latestAnalyticsRef = useRef(createLatestAsyncGuard<unknown>());

  const timeRangeRef = useRef(timeRange);

  useEffect(() => {
    timeRangeRef.current = timeRange;
  }, [timeRange]);

  const currentDateString = isHydrated
    ? new Date().toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : 'Hôm nay';

  const formattedLastUpdated =
    isHydrated && lastUpdated
      ? lastUpdated.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : null;

  // Xử lý response analytics dùng chung cho mọi đường fetch
  const applyAnalytics = useCallback((resData: AnalyticsPayload) => {
    if (resData.error) {
      setFetchError(true);
      return;
    }
    setData(resData);
    setLastUpdated(new Date());
    setFetchError(false);
  }, []);

  // Fetch khi người dùng chủ động (đổi range, bấm refresh, realtime, polling)
  const fetchAnalytics = useCallback(
    (range: RevenueBarRange, isInitial = false, announce = false) => {
      if (announce) setAnnouncement('');
      if (isInitial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      void latestAnalyticsRef.current.run(
        () => loadAnalytics(user?.role, range),
        (resData) => {
          const normalized = normalizeAnalytics(resData, isStaff);
          applyAnalytics(normalized);
          if (announce && !normalized.error) setAnnouncement(`Số liệu ${PERIOD_LABELS[range]} đã cập nhật`);
        },
        (err) => {
          console.error('Failed to fetch analytics:', err);
          setFetchError(true);
        },
        () => {
          setLoading(false);
          setRefreshing(false);
        },
      );
    },
    [applyAnalytics, isStaff, user?.role]
  );

  // Initial load; discard stale results after a range switch or unmount.
  useEffect(() => {
    const guard = latestAnalyticsRef.current;
    void guard.run(
      () => loadAnalytics(user?.role, 'today'),
      (payload) => {
        const normalized = normalizeAnalytics(payload, isStaff);
        applyAnalytics(normalized);
        if (!normalized.error) setAnnouncement('Số liệu hôm nay đã cập nhật');
      },
      (error) => {
        console.error('Failed to fetch analytics:', error);
        setFetchError(true);
      },
      () => setLoading(false),
    );
    return () => guard.invalidate();
  }, [applyAnalytics, isStaff, user?.role]);

  // Real-time Pusher Subscription
  useEffect(() => {
    if (isStaff) return;
    const channel = pusherClient.subscribe('private-admin-channel');

    const handleAnalyticsUpdate = () => {
      fetchAnalytics(timeRangeRef.current, false);
    };

    channel.bind('analytics-updated', handleAnalyticsUpdate);

    return () => {
      channel.unbind('analytics-updated', handleAnalyticsUpdate);
      pusherClient.unsubscribe('private-admin-channel');
    };
  }, [fetchAnalytics, isStaff]);

  // Fallback Auto-Polling every 15 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchAnalytics(timeRangeRef.current, false);
      }
    }, 15000);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchAnalytics]);

  const handleRangeChange = (newRange: RevenueBarRange) => {
    timeRangeRef.current = newRange;
    setTimeRange(newRange);
    setData(null);
    fetchAnalytics(newRange, true, true);
  };

  const handleRefresh = () => {
    fetchAnalytics(timeRange, false, true);
  };

  const canViewOrders = canAccessAdminPage(user, '/admin/orders');
  const deliveryTotal = data?.summary?.totalShipmentsCount ?? 0;
  const deliveryCompleted = data?.summary?.deliveredShipmentsCount ?? 0;
  const deliveryRate = deliveryTotal > 0 ? Math.round((deliveryCompleted / deliveryTotal) * 100) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:space-y-7 lg:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1.5 text-[11px] text-slate-500">
            {currentDateString}{formattedLastUpdated ? ` · Cập nhật ${formattedLastUpdated}` : ''}
            {refreshing ? ' · Đang cập nhật' : ''}
          </p>
          <h1 className="text-[27px] font-semibold tracking-tight text-slate-900">{isStaff ? 'Tổng quan vận hành' : 'Tổng quan bán hàng'}</h1>
          <p className="mt-1 text-xs text-slate-500">{isStaff ? 'Đơn hàng, vận chuyển và tồn kho cần theo dõi.' : 'Doanh thu, thanh toán và đơn hàng trong một trang.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isStaff && (
            <ToggleGroup.Root
              type="single"
              value={timeRange}
              onValueChange={(value) => { if (value) handleRangeChange(value as RevenueBarRange); }}
              aria-label="Khoảng thời gian báo cáo"
              className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1"
            >
              {([['today', 'Hôm nay'], ['7days', '7 ngày'], ['month', '30 ngày']] as const).map(([value, label]) => (
                <ToggleGroup.Item
                  key={value}
                  value={value}
                  className="min-h-11 rounded-md px-3 text-xs font-medium text-slate-600 hover:bg-slate-200/70 focus-visible:outline-2 focus-visible:outline-slate-700 data-[state=on]:bg-white data-[state=on]:text-slate-900"
                >{label}</ToggleGroup.Item>
              ))}
            </ToggleGroup.Root>
          )}
          <button type="button" onClick={handleRefresh} disabled={loading || refreshing} aria-label="Làm mới dữ liệu" title="Làm mới dữ liệu" className="flex size-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-700 disabled:opacity-50">
            <RefreshCw className="size-4" />
          </button>
          {canViewOrders && <Link href="/admin/orders" className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-slate-800 px-3 text-xs font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700">Xem đơn hàng <ArrowRight className="size-3.5" /></Link>}
        </div>
      </header>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>

      {fetchError && !loading && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="inline-flex items-center gap-2"><AlertTriangle className="size-4" />{data ? 'Không tải được dữ liệu mới. Số liệu gần nhất vẫn được hiển thị.' : 'Không tải được dữ liệu phân tích.'}</span>
          <button type="button" onClick={handleRefresh} className="font-semibold underline underline-offset-2">Thử lại</button>
        </div>
      )}

      {(!fetchError || data) && (isStaff ? (
        <>
          <StaffKpiStrip summary={data?.summary} permissions={userPermissions} loading={loading} />
          <section aria-labelledby="staff-actions-title">
            <h2 id="staff-actions-title" className="text-sm font-semibold text-slate-900">Cần xử lý</h2>
            <AdminActionCenter urgentActions={data?.urgentActions} loading={loading} />
          </section>
          {userPermissions.includes('orders') && <AdminRecentOrdersTable orders={data?.recentOrders} loading={loading} sampleSize={5} />}
        </>
      ) : (
        <>
          <AdminKpiStrip summary={data?.summary} timeRange={timeRange} loading={loading} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
            <div className="lg:col-span-2"><AdminRevenueBars trend={data?.revenueTrend} previousTrend={data?.previousRevenueTrend} timeRange={timeRange} loading={loading} /></div>
            <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="payment-distribution-title">
              <h2 id="payment-distribution-title" className="text-sm font-semibold text-slate-900">Phương thức thanh toán</h2>
              <p className="mb-5 mt-1 text-xs text-slate-500">Tỷ trọng trong tối đa 500 đơn đã thanh toán gần nhất.</p>
              <AdminDonutChart distribution={data?.paymentMethodDistribution} sampleCount={data?.paymentDistributionSampleCount} loading={loading} />
            </section>
          </div>
          <section aria-labelledby="admin-actions-title">
            <h2 id="admin-actions-title" className="text-sm font-semibold text-slate-900">Cần xử lý</h2>
            <AdminActionCenter urgentActions={data?.urgentActions} loading={loading} />
          </section>
          <AdminRecentOrdersTable orders={data?.recentOrders} loading={loading} />

          <section aria-labelledby="additional-analytics-title" className="space-y-4 pt-3">
            <h2 id="additional-analytics-title" className="text-sm font-semibold text-slate-700">Phân tích thêm</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <AdminTopProducts products={data?.topProducts} loading={loading} />
              <AdminCustomersCard totalCustomers={data?.summary?.totalCustomers} trend={data?.newCustomersTrend} loading={loading} />
              <AdminRealtimeOrdersCard totalOrders={data?.summary?.totalOrders} todayOrders={data?.summary?.todayOrders} todayRevenueGrowth={data?.summary?.todayRevenueGrowth} trend={data?.revenueTrend} loading={loading} />
              <AdminRevenueShareCard periodRevenue={timeRange === 'today' ? data?.summary?.todayRevenue : data?.summary?.periodRevenue} totalRevenue={data?.summary?.totalRevenue} periodLabel={PERIOD_LABELS[timeRange]} loading={loading} />
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-900">Giao hàng</h3>
                <p className="mt-5 text-2xl font-semibold text-slate-900">{deliveryRate === null ? '—' : `${deliveryRate}%`}</p>
                <p className="mt-2 text-xs text-slate-500">{deliveryCompleted}/{deliveryTotal} vận đơn đã giao · {data?.summary?.activeShipmentsCount ?? 0} đang giao</p>
              </div>
            </div>
          </section>
        </>
      ))}
    </div>
  );
}

export default AdminDashboardView;
