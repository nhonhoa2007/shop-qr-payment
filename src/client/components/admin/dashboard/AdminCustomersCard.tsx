'use client';

import React from 'react';
import { Users, TrendingUp } from 'lucide-react';

export interface CustomerTrendPoint {
  label: string;
  count: number;
}

export interface AdminCustomersCardProps {
  totalCustomers?: number;
  /** 12 bucket tháng gần nhất (bucket cuối = tháng hiện tại) */
  trend?: CustomerTrendPoint[];
  loading?: boolean;
}

/**
 * Card tính năng "Khách hàng" — tương đương card Contacts của mẫu tham chiếu:
 * nền gradient đậm, số lớn, pill khách mới, biểu đồ cột trắng 12 tháng.
 */
export function AdminCustomersCard({ totalCustomers, trend, loading = false }: AdminCustomersCardProps) {
  const points = trend || [];
  const max = Math.max(...points.map((p) => p.count), 1);
  const currentMonth = points.length > 0 ? points[points.length - 1].count : 0;
  const previousMonth = points.length > 1 ? points[points.length - 2].count : 0;
  const growthPct = previousMonth > 0 ? Number((((currentMonth - previousMonth) / previousMonth) * 100).toFixed(0)) : null;

  return (
    <div className="relative rounded-[24px] p-5 sm:p-6 h-full flex flex-col overflow-hidden text-white shadow-lg shadow-[#5433eb]/20">
      {/* Nền gradient violet đậm + vân trang trí */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#5433eb] via-[#4628cb] to-[#2d1a96]" aria-hidden="true" />
      <div
        className="absolute inset-0 opacity-20"
        aria-hidden="true"
        style={{
          backgroundImage: 'radial-gradient(circle at 85% 15%, rgba(255,255,255,0.35) 0, transparent 40%)',
        }}
      />

      <div className="relative flex items-start justify-between mb-4">
        <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
          <Users className="w-5 h-5" />
        </div>
        {growthPct !== null && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm text-[11px] font-bold">
            <TrendingUp className={`w-3 h-3 ${growthPct < 0 ? 'rotate-180' : ''}`} />
            {growthPct > 0 ? `+${growthPct}%` : `${growthPct}%`}
          </span>
        )}
      </div>

      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Khách hàng</p>
        {loading && totalCustomers === undefined ? (
          <div className="h-9 w-28 rounded-lg bg-white/20 animate-pulse mt-1" aria-hidden="true" />
        ) : (
          <p className="text-4xl font-black tracking-tight mt-1">
            {(totalCustomers ?? 0).toLocaleString('vi-VN')}
          </p>
        )}
        <p className="text-xs font-semibold text-white/75 mt-1.5">
          +{currentMonth} khách mới tháng này
        </p>
      </div>

      {/* Biểu đồ cột trắng 12 tháng */}
      <div className="relative flex items-end gap-1.5 h-20 mt-auto pt-4" aria-hidden="true">
        {(loading && points.length === 0
          ? Array.from({ length: 12 }, () => 0)
          : points.map((p) => p.count)
        ).map((v, i) => {
          const isLast = i === 11;
          const pct = Math.max(v / max, 0.08);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end h-14">
                <div
                  className={`w-full rounded-full transition-all duration-700 ${
                    isLast ? 'bg-white' : 'bg-white/40'
                  }`}
                  style={{ height: `${Math.round(pct * 100)}%` }}
                />
              </div>
              {points[i] && (
                <span className={`text-[8px] font-bold ${isLast ? 'text-white' : 'text-white/50'}`}>
                  {points[i].label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
