'use client';

import React from 'react';
import { formatVND } from '@shared/utils';
import { TrendingUp, ShoppingBag, CheckCircle2, Truck } from 'lucide-react';

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

export interface AdminKpiStripProps {
  summary?: KpiSummaryData;
  timeRange?: 'today' | '7days' | 'month';
  loading?: boolean;
}

export function AdminKpiStrip({ summary, timeRange = 'today', loading = false }: AdminKpiStripProps) {
  // 100% REAL DATA FROM DATABASE - ZERO FABRICATED FALLBACKS
  const revenueValue = timeRange === 'today'
    ? (summary?.todayRevenue ?? 0)
    : (summary?.periodRevenue ?? 0);

  const growth = summary?.todayRevenueGrowth ?? 0;
  const isPositiveGrowth = growth >= 0;

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

  const revenueCardTitle = timeRange === 'today'
    ? 'Doanh thu hôm nay'
    : timeRange === '7days'
    ? 'Doanh thu 7 ngày'
    : 'Doanh thu 30 ngày';

  const revenueComparisonText = timeRange === 'today'
    ? 'so với hôm qua'
    : 'tổng theo chu kỳ';

  const ordersCardTitle = timeRange === 'today'
    ? 'Đơn hôm nay'
    : 'Tổng đơn hàng';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {/* Card 1: Doanh thu thực tế */}
      <div className="bg-white rounded-[24px] p-5 border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-[#5433eb]/40 hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {revenueCardTitle}
          </span>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center transition-transform group-hover:scale-110">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
        <div className={`text-2xl font-black text-slate-900 tracking-tight truncate transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
          {formatVND(revenueValue)}
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs">
          {timeRange === 'today' ? (
            <>
              <span
                className={`flex items-center font-bold ${
                  isPositiveGrowth ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                <span>{growth > 0 ? `+${growth}%` : `${growth}%`}</span>
              </span>
              <span className="text-slate-400">{revenueComparisonText}</span>
            </>
          ) : (
            <span className="text-slate-400">
              Tổng doanh thu đã thanh toán
            </span>
          )}
        </div>
      </div>

      {/* Card 2: Đơn hàng thực tế */}
      <div className="bg-white rounded-[24px] p-5 border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-[#5433eb]/40 hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {ordersCardTitle}
          </span>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center transition-transform group-hover:scale-110">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>
        <div className={`text-2xl font-black text-slate-900 tracking-tight transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
          {ordersCount} đơn
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs flex-wrap">
          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[11px]">
            {pendingOrders} chờ duyệt
          </span>
          <span className="text-slate-400 font-medium">
            {paidOrders} đã thanh toán
          </span>
        </div>
      </div>

      {/* Card 3: Khớp VietQR Tự Động thực tế */}
      <div className="bg-white rounded-[24px] p-5 border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-[#5433eb]/40 hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Khớp VietQR Tự Động
          </span>
          <div className="w-9 h-9 rounded-xl bg-[#5433eb]/10 text-[#5433eb] flex items-center justify-center transition-transform group-hover:scale-110">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
        <div className={`text-2xl font-black text-slate-900 tracking-tight transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
          {qrMatchRate}%
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs flex-wrap">
          <span className="text-emerald-600 font-bold">
            {totalTx > 0 ? `${matchedTx}/${totalTx} giao dịch` : '0 giao dịch'}
          </span>
          {unmatchedTxCount > 0 && (
            <span className="text-rose-500 font-bold">
              ({unmatchedTxCount} chưa khớp)
            </span>
          )}
        </div>
      </div>

      {/* Card 4: Vận đơn GHN OpenAPI thực tế */}
      <div className="bg-white rounded-[24px] p-5 border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-[#5433eb]/40 hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Vận đơn GHN OpenAPI
          </span>
          <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center transition-transform group-hover:scale-110">
            <Truck className="w-5 h-5" />
          </div>
        </div>
        <div className={`text-2xl font-black text-slate-900 tracking-tight transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
          {totalShipments} kiện
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
          <span className="text-blue-600 font-bold">{deliveringShipments} đang giao</span>
          <span>•</span>
          <span className="text-slate-400">{deliveredShipments} đã giao xong</span>
        </div>
      </div>
    </div>
  );
}
