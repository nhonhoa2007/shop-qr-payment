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

export function AdminCustomersCard({ totalCustomers, trend, loading = false }: AdminCustomersCardProps) {
  const points = trend || [];
  const max = Math.max(...points.map((p) => p.count), 1);
  const currentMonth = points.length > 0 ? points[points.length - 1].count : 0;
  const previousMonth = points.length > 1 ? points[points.length - 2].count : 0;
  const growthPct = previousMonth > 0 ? Number((((currentMonth - previousMonth) / previousMonth) * 100).toFixed(0)) : null;

  return (
    <div className="relative rounded-xl p-5 sm:p-6 h-full flex flex-col justify-between overflow-hidden text-white bg-gradient-to-br from-[#2f54eb] via-[#2442c8] to-[#1a2f96] shadow-sm">
      <div className="relative flex items-start justify-between mb-3">
        <div className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center">
          <Users className="w-4 h-4" />
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
          <div className="h-8 w-28 rounded-lg bg-white/20 animate-pulse mt-1" aria-hidden="true" />
        ) : (
          <p className="text-3xl font-extrabold tracking-tight mt-0.5">
            {(totalCustomers ?? 0).toLocaleString('vi-VN')}
          </p>
        )}
        <p className="text-xs font-semibold text-white/80 mt-1">
          +{currentMonth} khách mới tháng này
        </p>
      </div>

      {/* Biểu đồ cột 12 tháng */}
      <div className="relative flex items-end gap-1.5 h-16 mt-4 pt-2" aria-hidden="true">
        {(loading && points.length === 0
          ? Array.from({ length: 12 }, () => 0)
          : points.map((p) => p.count)
        ).map((v, i) => {
          const isLast = i === points.length - 1;
          const pct = Math.max(v / max, 0.08);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end h-10">
                <div
                  className={`w-full rounded-t-sm transition-all duration-500 ${
                    isLast ? 'bg-white' : 'bg-white/40'
                  }`}
                  style={{ height: `${Math.round(pct * 100)}%` }}
                />
              </div>
              {points[i] && (
                <span className={`text-[8px] font-bold select-none ${isLast ? 'text-white' : 'text-white/50'}`}>
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
