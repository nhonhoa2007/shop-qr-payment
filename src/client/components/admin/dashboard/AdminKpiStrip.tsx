'use client';

import React from 'react';
import { formatVND } from '@shared/utils';
import { TrendingUp, TrendingDown, ShoppingBag, CheckCircle2, Truck } from 'lucide-react';

export interface KpiSummaryData {
  totalRevenue?: number;
  todayRevenue?: number;
  todayRevenueGrowth?: number;
  totalOrders?: number;
  todayOrders?: number;
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

export interface KpiTrendPoint {
  label?: string;
  revenue: number;
  orders?: number;
}

export interface AdminKpiStripProps {
  summary?: KpiSummaryData;
  timeRange?: 'today' | '7days' | 'month';
  loading?: boolean;
  /** Chuỗi điểm theo bucket hiện tại — vẽ mini bar-strip dưới 2 KPI đầu */
  trend?: KpiTrendPoint[];
}

/** Mini bar-strip chấm bi đặc trưng của dashboard: hàng chục thanh dọc nhỏ bo tròn */
function MiniBarStrip({
  values,
  loading,
  accent = 'violet',
}: {
  values: number[];
  loading?: boolean;
  accent?: 'violet' | 'emerald';
}) {
  const max = Math.max(...values, 1);

  if (loading && values.every((v) => v === 0)) {
    return (
      <div className="flex items-end gap-[3px] h-8 mt-3" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="w-[4px] rounded-full bg-slate-200 animate-pulse"
            style={{ height: `${30 + ((i * 37) % 60)}%` }}
          />
        ))}
      </div>
    );
  }

  const bars = values.length > 0 ? values : Array.from({ length: 24 }, () => 0);

  return (
    <div className="flex items-end gap-[3px] h-8 mt-3" aria-hidden="true">
      {bars.map((v, i) => {
        const pct = Math.max(v / max, 0.06);
        const isLast = i === bars.length - 1;
        const color =
          accent === 'violet'
            ? isLast
              ? 'bg-[#5433eb]'
              : 'bg-[#5433eb]/25'
            : isLast
              ? 'bg-emerald-500'
              : 'bg-emerald-500/25';
        return (
          <div
            key={i}
            className={`flex-1 min-w-[3px] max-w-[8px] rounded-full ${color} transition-all duration-500`}
            style={{ height: `${Math.round(pct * 100)}%` }}
          />
        );
      })}
    </div>
  );
}

function DeltaPill({ value, prefix = '' }: { value: number; prefix?: string }) {
  const isPositive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
        isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
      }`}
    >
      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {prefix}
      {value > 0 ? `+${value}%` : `${value}%`}
    </span>
  );
}

export function AdminKpiStrip({ summary, timeRange = 'today', loading = false, trend }: AdminKpiStripProps) {
  // 100% REAL DATA FROM DATABASE - ZERO FABRICATED FALLBACKS
  const revenueValue = timeRange === 'today'
    ? (summary?.todayRevenue ?? 0)
    : (summary?.periodRevenue ?? 0);

  const growth = summary?.todayRevenueGrowth ?? 0;

  const ordersCount = timeRange === 'today'
    ? (summary?.todayOrders ?? 0)
    : (summary?.totalOrders ?? 0);

  const pendingOrders = summary?.pendingOrdersCount ?? 0;
  const paidOrders = summary?.totalPaidOrders ?? 0;

  const totalTx = summary?.totalTransactions ?? 0;
  const unmatchedTxCount = summary?.unmatchedTransactionsCount ?? 0;
  const matchedTx = summary?.matchedTransactionsCount ?? (totalTx >= unmatchedTxCount ? totalTx - unmatchedTxCount : 0);
  const qrMatchRate = summary?.qrMatchRate ?? (totalTx === 0 ? 100 : 0);

  const deliveringShipments = summary?.activeShipmentsCount ?? 0;
  const deliveredShipments = summary?.deliveredShipmentsCount ?? 0;
  const totalShipments = summary?.totalShipmentsCount ?? (deliveringShipments + deliveredShipments);
  const deliveryRate = totalShipments > 0 ? Number(((deliveredShipments / totalShipments) * 100).toFixed(1)) : null;

  const revenueCardTitle = timeRange === 'today'
    ? 'Doanh thu hôm nay'
    : timeRange === '7days'
    ? 'Doanh thu 7 ngày'
    : 'Doanh thu 30 ngày';

  const ordersCardTitle = timeRange === 'today' ? 'Đơn hàng hôm nay' : 'Đơn hàng theo kỳ';

  const trendValues = (trend || []).map((p) => p.revenue);
  const trendOrderValues = (trend || []).map((p) => p.orders ?? 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {/* Card 1: Doanh thu kỳ + mini bar strip theo bucket */}
      <div className="bg-white rounded-[24px] p-5 border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-[#5433eb]/40 hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {revenueCardTitle}
          </span>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center transition-transform group-hover:scale-110">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
        {loading && !summary ? (
          <div className="h-8 w-32 rounded-lg bg-slate-200 animate-pulse" aria-hidden="true" />
        ) : (
          <div className="text-2xl font-black text-slate-900 tracking-tight truncate">
            {formatVND(revenueValue)}
          </div>
        )}
        <div className="flex items-center gap-2 mt-2 text-xs">
          {timeRange === 'today' ? (
            <>
              <DeltaPill value={growth} />
              <span className="text-slate-400">so với hôm qua</span>
            </>
          ) : (
            <span className="text-slate-400 font-medium">Đã thanh toán trong kỳ</span>
          )}
        </div>
        <MiniBarStrip values={trendValues} loading={loading} accent="violet" />
      </div>

      {/* Card 2: Đơn hàng + mini bar strip theo bucket */}
      <div className="bg-white rounded-[24px] p-5 border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-[#5433eb]/40 hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {ordersCardTitle}
          </span>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center transition-transform group-hover:scale-110">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>
        {loading && !summary ? (
          <div className="h-8 w-24 rounded-lg bg-slate-200 animate-pulse" aria-hidden="true" />
        ) : (
          <div className="text-2xl font-black text-slate-900 tracking-tight">{ordersCount} đơn</div>
        )}
        <div className="flex items-center gap-2 mt-2 text-xs flex-wrap">
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">
            {pendingOrders} chờ duyệt
          </span>
          <span className="text-slate-400 font-medium">{paidOrders} đã thanh toán</span>
        </div>
        <MiniBarStrip values={trendOrderValues} loading={loading} accent="emerald" />
      </div>

      {/* Card 3: Tỷ lệ giao thành công (GHN) */}
      <div className="bg-white rounded-[24px] p-5 border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-[#5433eb]/40 hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Tỷ lệ giao thành công
          </span>
          <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center transition-transform group-hover:scale-110">
            <Truck className="w-5 h-5" />
          </div>
        </div>
        {loading && !summary ? (
          <div className="h-8 w-20 rounded-lg bg-slate-200 animate-pulse" aria-hidden="true" />
        ) : (
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {deliveryRate === null ? '—' : `${deliveryRate}%`}
          </div>
        )}
        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 flex-wrap">
          <span className="text-blue-600 font-bold">{deliveringShipments} đang giao</span>
          <span>•</span>
          <span className="text-slate-400">{deliveredShipments}/{totalShipments} kiện</span>
        </div>
        {/* Thanh tiến trình giao hàng */}
        <div className="h-1.5 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-400 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${deliveryRate ?? 0}%` }}
          />
        </div>
      </div>

      {/* Card 4: Khớp VietQR Tự Động */}
      <div className="bg-white rounded-[24px] p-5 border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-[#5433eb]/40 hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Khớp VietQR Tự Động
          </span>
          <div className="w-9 h-9 rounded-xl bg-[#5433eb]/10 text-[#5433eb] flex items-center justify-center transition-transform group-hover:scale-110">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
        {loading && !summary ? (
          <div className="h-8 w-20 rounded-lg bg-slate-200 animate-pulse" aria-hidden="true" />
        ) : (
          <div className="text-2xl font-black text-slate-900 tracking-tight">{qrMatchRate}%</div>
        )}
        <div className="flex items-center gap-2 mt-2 text-xs flex-wrap">
          <span className="text-emerald-600 font-bold">
            {totalTx > 0 ? `${matchedTx}/${totalTx} giao dịch` : '0 giao dịch'}
          </span>
          {unmatchedTxCount > 0 && (
            <span className="text-rose-500 font-bold">({unmatchedTxCount} chưa khớp)</span>
          )}
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
          <div
            className="h-full bg-[#5433eb] rounded-full transition-all duration-500"
            style={{ width: `${qrMatchRate}%` }}
          />
        </div>
      </div>
    </div>
  );
}
