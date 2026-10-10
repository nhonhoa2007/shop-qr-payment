'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useHydrated } from '@client/hooks/useHydrated';
import { pusherClient } from '@client/infrastructure/pusher-client';
import { AdminKpiStrip, KpiSummaryData } from '@client/components/admin/dashboard/AdminKpiStrip';
import { AdminRevenueBars, RevenueBarRange, RevenueBarPoint } from '@client/components/admin/dashboard/AdminRevenueBars';
import { AdminDonutChart, DonutPaymentDistribution } from '@client/components/admin/dashboard/AdminDonutChart';
import { AdminTopProducts, TopProductItem } from '@client/components/admin/dashboard/AdminTopProducts';
import { AdminCustomersCard, CustomerTrendPoint } from '@client/components/admin/dashboard/AdminCustomersCard';
import { AdminRevenueShareCard } from '@client/components/admin/dashboard/AdminRevenueShareCard';
import { AdminRealtimeOrdersCard } from '@client/components/admin/dashboard/AdminRealtimeOrdersCard';
import { AdminActionCenter, UrgentActionItem } from '@client/components/admin/dashboard/AdminActionCenter';
import { AdminRecentOrdersTable, RecentOrderItem } from '@client/components/admin/dashboard/AdminRecentOrdersTable';
import { AlertTriangle, RefreshCw, Sparkles, Plus } from 'lucide-react';

interface AnalyticsPayload {
  error?: boolean;
  summary?: KpiSummaryData;
  ordersByStatus?: Record<string, number>;
  revenueTrend?: RevenueBarPoint[];
  newCustomersTrend?: CustomerTrendPoint[];
  paymentMethodDistribution?: DonutPaymentDistribution;
  urgentActions?: UrgentActionItem[];
  recentOrders?: RecentOrderItem[];
  topProducts?: TopProductItem[];
}

/** Lời chào theo giờ trong ngày (chỉ chạy phía client sau khi hydrate) */
function getGreeting(): string {
  if (typeof window === 'undefined') return 'Xin chào';
  const hour = new Date().getHours();
  if (hour < 12) return 'Chào buổi sáng';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

const PERIOD_LABELS: Record<RevenueBarRange, string> = {
  today: 'hôm nay',
  '7days': '7 ngày qua',
  month: '30 ngày qua',
};

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
  const [timeRange, setTimeRange] = useState<RevenueBarRange>('today');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isHydrated = useHydrated();

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

  const greeting = isHydrated ? getGreeting() : 'Xin chào';

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
    (range: RevenueBarRange, isInitial = false) => {
      if (isInitial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const endpoint = isStaff
        ? '/api/admin/analytics/staff'
        : `/api/admin/analytics?range=${range}`;

      fetch(endpoint)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Analytics fetch failed with status ${res.status}`);
          }
          return res.json();
        })
        .then((resData) => {
          applyAnalytics(isStaff ? { summary: resData, ...resData } : resData);
        })
        .catch((err) => {
          console.error('Failed to fetch analytics:', err);
          setFetchError(true);
        })
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [applyAnalytics, isStaff]
  );

  // Initial load
  useEffect(() => {
    let cancelled = false;

    fetch('/api/admin/analytics?range=today')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Analytics fetch failed with status ${res.status}`);
        }
        return res.json();
      })
      .then((resData) => {
        if (!cancelled) applyAnalytics(resData);
      })
      .catch((err) => {
        console.error('Failed to fetch analytics:', err);
        if (!cancelled) setFetchError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applyAnalytics]);

  // Real-time Pusher Subscription
  useEffect(() => {
    const channel = pusherClient.subscribe('private-admin-channel');

    const handleAnalyticsUpdate = () => {
      fetchAnalytics(timeRangeRef.current, false);
    };

    channel.bind('analytics-updated', handleAnalyticsUpdate);

    return () => {
      channel.unbind('analytics-updated', handleAnalyticsUpdate);
      pusherClient.unsubscribe('private-admin-channel');
    };
  }, [fetchAnalytics]);

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
    setTimeRange(newRange);
    fetchAnalytics(newRange, false);
  };

  const handleRefresh = () => {
    fetchAnalytics(timeRange, false);
  };

  const isLoading = loading || refreshing;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* HEADER: Chào hỏi + Trạng thái Sync + Nhóm Thao tác chuẩn Aurora Console */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-[26px] font-extrabold text-slate-900 tracking-tight">
              {greeting}, {isStaff ? (user?.name || 'Nhân viên') : 'Quản trị viên'} 👋
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#2f54eb]/10 text-[#2f54eb] text-[11px] font-bold">
              <Sparkles className="w-3 h-3" />
              {isStaff ? 'Operations Panel' : 'Aurora Workspace'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {isStaff
              ? `Báo cáo vận hành thời gian thực (${currentDateString})`
              : `Toàn cảnh tăng trưởng doanh thu & vận hành thanh toán QR (${currentDateString})`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* Trạng thái Realtime Live dot */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-xs font-semibold text-emerald-800 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-bold text-emerald-700">
              {formattedLastUpdated ? `Sync ${formattedLastUpdated}` : 'Realtime'}
            </span>
          </div>

          {/* Bộ chọn kỳ (Hôm nay / 7 ngày / 30 ngày) */}
          {!isStaff && (
            <div className="flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => handleRangeChange('today')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  timeRange === 'today' ? 'bg-[#2f54eb] text-white shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => handleRangeChange('7days')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  timeRange === '7days' ? 'bg-[#2f54eb] text-white shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                7 ngày
              </button>
              <button
                type="button"
                onClick={() => handleRangeChange('month')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  timeRange === 'month' ? 'bg-[#2f54eb] text-white shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                30 ngày
              </button>
            </div>
          )}

          {/* Nút Refresh */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            aria-label="Làm mới dữ liệu"
            className="p-2 rounded-xl bg-white border border-slate-200/90 text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-xs transition disabled:opacity-50 cursor-pointer"
            title="Tải lại số liệu"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#2f54eb]' : ''}`} />
          </button>

          {/* Nút Quản lý/Tạo đơn nhanh */}
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2f54eb] text-white text-xs font-bold hover:bg-[#1d39c4] transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo đơn</span>
          </Link>
        </div>
      </div>

      {/* Thông báo lỗi nếu fetch thất bại */}
      {fetchError && !loading && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Không tải được dữ liệu phân tích. Vui lòng thử lại.
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-800 text-white text-xs font-semibold hover:bg-amber-900 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Thử lại
          </button>
        </div>
      )}

      {isStaff ? (
        <div className="space-y-6">
          {/* HÀNG 1: THẺ CHỈ SỐ VẬN HÀNH DÀNH CHO NHÂN VIÊN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {userPermissions.includes('orders') && (
              <>
                <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Đơn hàng hôm nay
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    {data?.summary?.todayOrders ?? 0}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Đơn phát sinh trong ngày</p>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs">
                  <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-1">
                    Đơn chờ xử lý
                  </div>
                  <div className="text-3xl font-extrabold text-amber-700 tracking-tight">
                    {data?.summary?.pendingOrdersCount ?? 0}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Cần xác nhận đóng gói</p>
                </div>
              </>
            )}

            {userPermissions.includes('shipments') && (
              <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs">
                <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">
                  Vận đơn đang giao
                </div>
                <div className="text-3xl font-extrabold text-blue-700 tracking-tight">
                  {data?.summary?.activeShipmentsCount ?? 0}
                </div>
                <p className="text-xs text-slate-500 mt-1">Đơn vị GHN đang vận chuyển</p>
              </div>
            )}

            {userPermissions.includes('products') && (
              <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs">
                <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-1">
                  Cảnh báo tồn kho
                </div>
                <div className="text-3xl font-extrabold text-rose-700 tracking-tight">
                  {data?.summary?.lowStockCount ?? 0}
                </div>
                <p className="text-xs text-slate-500 mt-1">Sản phẩm tồn kho &le; 5</p>
              </div>
            )}
          </div>

          {/* HÀNG 2: CẢNH BÁO VẬN HÀNH CẦN XỬ LÝ NGAY */}
          {data?.urgentActions && data.urgentActions.length > 0 && (
            <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Cần xử lý ngay</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Cảnh báo tự động
                </span>
              </div>
              <AdminActionCenter
                urgentActions={data?.urgentActions}
                lowStockCount={data?.summary?.lowStockCount}
              />
            </div>
          )}

          {/* HÀNG 3: ĐƠN HÀNG MỚI NHẤT */}
          {userPermissions.includes('orders') && (
            <AdminRecentOrdersTable orders={data?.recentOrders} />
          )}
        </div>
      ) : (
        <>
          {/* HÀNG 1: 4 KPI CARDS VỚI AURORA SPARKLINE */}
          <AdminKpiStrip
            summary={data?.summary}
            timeRange={timeRange}
            loading={isLoading}
            trend={data?.revenueTrend}
          />

          {/* HÀNG 2: Biểu đồ Doanh thu MRR (8 cols) + Phân bố thanh toán Donut (4 cols) chuẩn Aurora ov-grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 min-h-[340px]">
              <AdminRevenueBars
                trend={data?.revenueTrend}
                timeRange={timeRange}
                loading={isLoading}
                onRangeChange={handleRangeChange}
              />
            </div>

            <div className="lg:col-span-4 bg-white rounded-xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Cơ cấu thanh toán</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Tỷ trọng kênh thanh toán ({PERIOD_LABELS[timeRange]})</p>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {PERIOD_LABELS[timeRange]}
                </span>
              </div>
              <AdminDonutChart distribution={data?.paymentMethodDistribution} loading={isLoading} />
            </div>
          </div>

          {/* HÀNG 3: Top Sản phẩm (4 cols) + Khách hàng (4 cols) + Đơn hàng Realtime (4 cols) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <AdminTopProducts products={data?.topProducts} loading={isLoading} />

            <AdminCustomersCard
              totalCustomers={data?.summary?.totalCustomers}
              trend={data?.newCustomersTrend}
              loading={isLoading}
            />

            <AdminRealtimeOrdersCard
              totalOrders={data?.summary?.totalOrders}
              todayOrders={data?.summary?.todayOrders}
              todayRevenueGrowth={data?.summary?.todayRevenueGrowth}
              trend={data?.revenueTrend}
              loading={isLoading}
            />
          </div>

          {/* HÀNG 4: Doanh thu kỳ share card & Cảnh báo vận hành cần xử lý */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-4">
              <AdminRevenueShareCard
                periodRevenue={
                  timeRange === 'today'
                    ? data?.summary?.todayRevenue
                    : data?.summary?.periodRevenue
                }
                totalRevenue={data?.summary?.totalRevenue}
                periodLabel={PERIOD_LABELS[timeRange]}
                loading={isLoading}
              />
            </div>

            <div className="lg:col-span-8 bg-white rounded-xl p-5 sm:p-6 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Cần xử lý ngay</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Cảnh báo tự động
                </span>
              </div>
              <AdminActionCenter
                urgentActions={data?.urgentActions}
                lowStockCount={data?.summary?.lowStockCount}
                unmatchedTxCount={data?.summary?.unmatchedTransactionsCount}
              />
            </div>
          </div>

          {/* HÀNG 5: Đơn hàng mới nhất trong hệ thống */}
          <AdminRecentOrdersTable orders={data?.recentOrders} />
        </>
      )}
    </div>
  );
}

export default AdminDashboardView;
