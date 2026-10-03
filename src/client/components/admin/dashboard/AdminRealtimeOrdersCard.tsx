'use client';

import React, { useMemo } from 'react';
import { formatVND } from '@shared/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface RealtimeTrendPoint {
  label?: string;
  revenue: number;
}

export interface AdminRealtimeOrdersCardProps {
  /** Tổng số đơn all-time */
  totalOrders?: number;
  /** Số đơn hôm nay */
  todayOrders?: number;
  /** % tăng trưởng hôm nay vs hôm qua */
  todayRevenueGrowth?: number;
  /** Chuỗi điểm doanh thu hiện tại để vẽ sparkline */
  trend?: RealtimeTrendPoint[];
  loading?: boolean;
}

/**
 * Card tối "Đơn hàng realtime" — tương đương card Texts Sent của mẫu tham chiếu:
 * nền gradient violet-ink đậm, số tổng all-time, pill tăng trưởng, area sparkline trắng.
 */
export function AdminRealtimeOrdersCard({
  totalOrders,
  todayOrders,
  todayRevenueGrowth,
  trend,
  loading = false,
}: AdminRealtimeOrdersCardProps) {
  const points = useMemo(() => trend || [], [trend]);

  // Sparkline area: chuẩn hóa về viewBox 200x56
  const sparkPath = useMemo(() => {
    if (points.length < 2) return null;
    const W = 200;
    const H = 56;
    const max = Math.max(...points.map((p) => p.revenue), 1);
    const step = W / (points.length - 1);
    const coords = points.map((p, i) => ({
      x: i * step,
      y: H - Math.max((p.revenue / max) * (H - 8), 4) - 2,
    }));
    // Đường cong mượt qua midpoint control points
    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const cur = coords[i];
      const cx = (prev.x + cur.x) / 2;
      d += ` C ${cx} ${prev.y}, ${cx} ${cur.y}, ${cur.x} ${cur.y}`;
    }
    return { line: d, area: `${d} L ${W} ${H} L 0 ${H} Z`, coords };
  }, [points]);

  const growth = todayRevenueGrowth ?? 0;
  const isPositive = growth >= 0;

  return (
    <div className="relative rounded-[24px] p-5 sm:p-6 h-full flex flex-col overflow-hidden text-white bg-[#15102b] shadow-lg shadow-slate-900/20">
      {/* Vân gradient tối violet */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-[#241a4d] via-[#171029] to-[#0d0a1c]"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-16 -right-10 w-56 h-56 rounded-full bg-[#5433eb]/25 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between mb-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Đơn hàng</p>
          <p className="text-[10px] font-semibold text-white/40">Tất cả thời gian</p>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold backdrop-blur-sm ${
            isPositive ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'
          }`}
        >
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {growth > 0 ? `+${growth}%` : `${growth}%`}
        </span>
      </div>

      <div className="relative">
        {loading && totalOrders === undefined ? (
          <div className="h-10 w-32 rounded-lg bg-white/15 animate-pulse" aria-hidden="true" />
        ) : (
          <p className="text-4xl font-black tracking-tight">
            {(totalOrders ?? 0).toLocaleString('vi-VN')}
          </p>
        )}
        <p className="text-xs font-semibold text-white/60 mt-1.5">
          <span className="text-emerald-300 font-bold">{todayOrders ?? 0} đơn hôm nay</span> ·{' '}
          {formatVND(points.reduce((s, p) => s + p.revenue, 0))} doanh thu kỳ
        </p>
      </div>

      {/* Area sparkline trắng */}
      <div className="relative h-14 mt-auto" aria-hidden="true">
        {sparkPath && (
          <svg viewBox="0 0 200 56" preserveAspectRatio="none" className="w-full h-full">
            <defs>
              <linearGradient id="darkSparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={sparkPath.area} fill="url(#darkSparkFill)" />
            <path d={sparkPath.line} fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
            <circle
              cx={sparkPath.coords[sparkPath.coords.length - 1].x}
              cy={sparkPath.coords[sparkPath.coords.length - 1].y}
              r="3.5"
              fill="#5433eb"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
