'use client';

import React from 'react';
import { formatVND } from '@shared/utils';
import { Plus } from 'lucide-react';

export interface AdminRevenueShareCardProps {
  /** Doanh thu của kỳ đang chọn (today/7days/30days) */
  periodRevenue?: number;
  /** Tổng doanh thu all-time để tính tỷ trọng */
  totalRevenue?: number;
  /** Nhãn của kỳ đang chọn, vd "30 ngày qua" */
  periodLabel?: string;
  loading?: boolean;
}

/**
 * Card "Doanh thu kỳ này" — tương đương card Credits của mẫu tham chiếu:
 * số tiền lớn + progress bar tỷ trọng so với tổng doanh thu tất cả thời gian.
 */
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
    <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-slate-200/80 shadow-sm h-full flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Doanh thu kỳ này</h3>
        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
          <Plus className="w-4 h-4" />
        </div>
      </div>

      {loading && periodRevenue === undefined ? (
        <div className="h-8 w-36 rounded-lg bg-slate-200 animate-pulse" aria-hidden="true" />
      ) : (
        <p className="text-3xl font-black text-slate-900 tracking-tight">{formatVND(period)}</p>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
          <span>{periodLabel}</span>
          <span>{sharePct}% của tổng {formatVND(allTime)}</span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#5433eb] to-[#8b7cf0] rounded-full transition-all duration-700"
            style={{ width: `${sharePct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
