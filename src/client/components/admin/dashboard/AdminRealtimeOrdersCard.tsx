'use client';

import React, { useMemo } from 'react';
import { formatVND } from '@shared/utils';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';

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
    <div className="relative rounded-xl p-5 sm:p-6 h-full flex flex-col justify-between overflow-hidden text-white bg-[#0f172a] border border-slate-800 shadow-sm">
      <div className="relative flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/10 text-emerald-400 flex items-center justify-center">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Đơn hàng realtime</p>
            <p className="text-[10px] text-slate-500">Tất cả thời gian</p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold backdrop-blur-sm ${
            isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
          }`}
        >
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {growth > 0 ? `+${growth}%` : `${growth}%`}
        </span>
      </div>

      <div className="relative my-2">
        {loading && totalOrders === undefined ? (
          <div className="h-9 w-32 rounded-lg bg-slate-800 animate-pulse" aria-hidden="true" />
        ) : (
          <p className="text-3xl font-extrabold tracking-tight">
            {(totalOrders ?? 0).toLocaleString('vi-VN')} <span className="text-sm font-normal text-slate-400">đơn</span>
          </p>
        )}
        <p className="text-xs font-semibold text-slate-400 mt-1">
          <span className="text-emerald-400 font-bold">{todayOrders ?? 0} đơn hôm nay</span> ·{' '}
          {formatVND(points.reduce((s, p) => s + p.revenue, 0))} kỳ này
        </p>
      </div>

      {/* Area sparkline trắng */}
      <div className="relative h-14 mt-auto pt-2" aria-hidden="true">
        {sparkPath && (
          <svg viewBox="0 0 200 56" preserveAspectRatio="none" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="auroraDarkSparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2f54eb" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#2f54eb" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={sparkPath.area} fill="url(#auroraDarkSparkFill)" />
            <path d={sparkPath.line} fill="none" stroke="#6b8cff" strokeWidth="2" strokeLinecap="round" />
            <circle
              cx={sparkPath.coords[sparkPath.coords.length - 1].x}
              cy={sparkPath.coords[sparkPath.coords.length - 1].y}
              r="3.5"
              fill="#6b8cff"
              stroke="#0f172a"
              strokeWidth="1.5"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
