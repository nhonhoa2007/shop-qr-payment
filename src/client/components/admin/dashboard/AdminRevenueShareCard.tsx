'use client';

import React from 'react';
import { formatVND } from '@shared/utils';
import { PieChart } from 'lucide-react';

export interface AdminRevenueShareCardProps {
  /** Doanh thu của kỳ đang chọn (today/7days/30days) */
  periodRevenue?: number;
  /** Tổng doanh thu all-time để tính tỷ trọng */
  totalRevenue?: number;
  /** Nhãn của kỳ đang chọn, vd "30 ngày qua" */
  periodLabel?: string;
  loading?: boolean;
}

export function AdminRevenueShareCard({
  periodRevenue,
  totalRevenue,
  periodLabel = '30 ngày qua',
  loading = false,
}: AdminRevenueShareCardProps) {
  const period = periodRevenue ?? 0;
  const allTime = totalRevenue ?? 0;
  const sharePct = allTime > 0 ? Math.min(Math.round((period / allTime) * 100), 100) : 0;

  return (
    <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/90 shadow-xs h-full flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Doanh thu kỳ này</h3>
        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
          <PieChart className="w-4 h-4" />
        </div>
      </div>

      <div>
        {loading && periodRevenue === undefined ? (
          <div className="h-8 w-36 rounded-lg bg-slate-100 animate-pulse" aria-hidden="true" />
        ) : (
          <p className="text-[26px] font-extrabold text-slate-900 tracking-tight">{formatVND(period)}</p>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1.5">
          <span>{periodLabel}</span>
          <span className="font-mono font-bold text-slate-700">{sharePct}% của tổng {formatVND(allTime)}</span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#2f54eb] to-[#6b8cff] rounded-full transition-all duration-700"
            style={{ width: `${sharePct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
