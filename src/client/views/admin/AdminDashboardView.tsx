'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useHydrated } from '@/lib/hydration';
import { pusherClient } from '@/lib/pusher-client';
import { AdminKpiStrip, KpiSummaryData } from '@client/components/admin/dashboard/AdminKpiStrip';
import { AdminRevenueChart, RevenueTrendPoint } from '@client/components/admin/dashboard/AdminRevenueChart';
import { AdminPaymentBreakdown, PaymentMethodDistribution } from '@client/components/admin/dashboard/AdminPaymentBreakdown';
import { AdminActionCenter, UrgentActionItem } from '@client/components/admin/dashboard/AdminActionCenter';
import { AdminRecentOrdersTable, RecentOrderItem } from '@client/components/admin/dashboard/AdminRecentOrdersTable';
import {
  Package,
  Truck,
  CreditCard,
  ShoppingBag,
  Tag,
  Star,
  Users,
  MessageSquare,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface AnalyticsPayload {
  summary?: KpiSummaryData;
  ordersByStatus?: Record<string, number>;
  revenueTrend?: RevenueTrendPoint[];
  paymentMethodDistribution?: PaymentMethodDistribution;
  urgentActions?: UrgentActionItem[];
  recentOrders?: RecentOrderItem[];
  topProducts?: Array<{
    productId: string;
    name: string;
    price: number;
    image: string | null;
    category?: string | null;
    totalSold: number;
  }>;
}

export function AdminDashboardView() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<'today' | '7days' | 'month'>('today');
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

  const formattedLastUpdated =
    isHydrated && lastUpdated
      ? lastUpdated.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : null;

  // Dynamic Fetching
  const fetchAnalytics = useCallback(
    (range: 'today' | '7days' | 'month', isInitial = false) => {
      if (isInitial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      fetch(`/api/admin/analytics?range=${range}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Analytics fetch failed with status ${res.status}`);
          }
          return res.json();
        })
        .then((resData) => {
          if (!resData.error) {
            setData(resData);
            setLastUpdated(new Date());
          }
        })
        .catch((err) => {
          console.error('Failed to fetch analytics:', err);
        })
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    []
  );

  // Initial load
  useEffect(() => {
    let ignore = false;

    fetch('/api/admin/analytics?range=today')
      .then((res) => res.json())
      .then((resData) => {
        if (!ignore && !resData.error) {
          setData(resData);
          setLastUpdated(new Date());
        }
      })
      .catch((err) => {
        console.error('Failed to fetch analytics:', err);
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

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

  const handleRangeChange = (newRange: 'today' | '7days' | 'month') => {
    setTimeRange(newRange);
    fetchAnalytics(newRange, false);
  };

  const handleRefresh = () => {
    fetchAnalytics(timeRange, false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Welcome & Time Range Filter Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Xin chào, Quản trị viên 👋
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#5433eb]/10 text-[#5433eb] text-[10px] font-bold">
              <Sparkles className="w-3 h-3" />
              Realtime Workspace
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Dữ liệu kinh doanh và vận hành thanh toán QR tự động hôm nay ({currentDateString})
          </p>
        </div>

        {/* Realtime Live Indicator, Time range switcher & Refresh */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* Realtime Live status dot & Last updated */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/90 border border-emerald-200/80 text-xs font-semibold text-emerald-800 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-bold text-emerald-700">
              Thời gian thực (Realtime)
            </span>
            {formattedLastUpdated && (
              <>
                <span className="text-emerald-300">•</span>
                <span className="text-[11px] text-emerald-600 font-medium">
                  Cập nhật lúc: {formattedLastUpdated}
                </span>
              </>
            )}
          </div>

          {/* Time range switcher */}
          <div className="flex items-center p-1 rounded-xl bg-white border border-slate-200/80 text-xs font-bold text-slate-700 shadow-sm">
            <button
              type="button"
              onClick={() => handleRangeChange('today')}
              className={`px-3 py-1 rounded-lg transition ${
                timeRange === 'today'
                  ? 'bg-[#5433eb] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => handleRangeChange('7days')}
              className={`px-3 py-1 rounded-lg transition ${
                timeRange === '7days'
                  ? 'bg-[#5433eb] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              7 ngày
            </button>
            <button
              type="button"
              onClick={() => handleRangeChange('month')}
              className={`px-3 py-1 rounded-lg transition ${
                timeRange === 'month'
                  ? 'bg-[#5433eb] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tháng này
            </button>
          </div>

          {/* Manual Refresh button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            aria-label="Làm mới dữ liệu"
            className="p-2 rounded-xl bg-white border border-slate-200/80 text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-sm transition disabled:opacity-50"
            title="Tải lại số liệu"
          >
            <RefreshCw
              className={`w-4 h-4 ${
                loading || refreshing ? 'animate-spin text-[#5433eb]' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* BENTO ROW 1: KPI CARDS */}
      <AdminKpiStrip
        summary={data?.summary}
        timeRange={timeRange}
        loading={loading || refreshing}
      />

      {/* BENTO ROW 2: CHART (8 COLS) + PAYMENT & ACTIONS (4 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 8 Cols: Revenue Area Chart */}
        <div className="lg:col-span-8">
          <AdminRevenueChart
            trend={data?.revenueTrend}
            timeRange={timeRange}
            loading={loading || refreshing}
          />
        </div>

        {/* 4 Cols: Payment Breakdown & Action Center */}
        <div className="lg:col-span-4 bg-white rounded-[24px] p-5 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <AdminPaymentBreakdown distribution={data?.paymentMethodDistribution} />
          <AdminActionCenter
            urgentActions={data?.urgentActions}
            lowStockCount={data?.summary?.lowStockCount}
            unmatchedTxCount={data?.summary?.unmatchedTransactionsCount}
          />
        </div>
      </div>

      {/* BENTO ROW 3: RECENT ORDERS TABLE */}
      <AdminRecentOrdersTable orders={data?.recentOrders} />

      {/* BENTO ROW 4: QUICK OPERATIONAL ACCESS TILES */}
      <div className="pt-2">
        <h2 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider text-[11px] text-slate-400">
          Phân hệ Nghiệp vụ Quản trị
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <Link
            href="/admin/orders"
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/70 hover:border-[#5433eb]/40 hover:shadow-md transition text-center group flex flex-col items-center justify-center"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 truncate w-full">Đơn hàng</span>
          </Link>

          <Link
            href="/admin/shipments"
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/70 hover:border-[#5433eb]/40 hover:shadow-md transition text-center group flex flex-col items-center justify-center"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Truck className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 truncate w-full">Vận đơn GHN</span>
          </Link>

          <Link
            href="/admin/transactions"
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/70 hover:border-[#5433eb]/40 hover:shadow-md transition text-center group flex flex-col items-center justify-center"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 truncate w-full">Đối soát VietQR</span>
          </Link>

          <Link
            href="/admin/products"
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/70 hover:border-[#5433eb]/40 hover:shadow-md transition text-center group flex flex-col items-center justify-center"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 truncate w-full">Sản phẩm</span>
          </Link>

          <Link
            href="/admin/coupons"
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/70 hover:border-[#5433eb]/40 hover:shadow-md transition text-center group flex flex-col items-center justify-center"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Tag className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 truncate w-full">Mã giảm giá</span>
          </Link>

          <Link
            href="/admin/customers"
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/70 hover:border-[#5433eb]/40 hover:shadow-md transition text-center group flex flex-col items-center justify-center"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 truncate w-full">Khách & RBAC</span>
          </Link>

          <Link
            href="/admin/chat"
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/70 hover:border-[#5433eb]/40 hover:shadow-md transition text-center group flex flex-col items-center justify-center"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 truncate w-full">CSKH Trực tuyến</span>
          </Link>

          <Link
            href="/admin/reviews"
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/70 hover:border-[#5433eb]/40 hover:shadow-md transition text-center group flex flex-col items-center justify-center"
          >
            <div className="w-10 h-10 rounded-xl bg-yellow-50 text-yellow-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Star className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 truncate w-full">Đánh giá SP</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardView;
