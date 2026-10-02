'use client';

import React, { useState, useMemo } from 'react';
import { formatVND } from '@shared/utils';

export interface RevenueTrendPoint {
  date: string;
  label?: string;
  revenue: number;
}

export interface AdminRevenueChartProps {
  trend?: RevenueTrendPoint[];
  timeRange?: 'today' | '7days' | 'month';
  loading?: boolean;
}

export function AdminRevenueChart({
  trend,
  timeRange = 'today',
  loading = false,
}: AdminRevenueChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // 100% REAL DATA PROCESSING - ZERO FABRICATED REVENUE NUMBERS
  const pointsData: RevenueTrendPoint[] = useMemo(() => {
    if (trend && trend.length > 0) {
      return trend.map((item, idx) => {
        let label = item.label;
        if (!label) {
          if (timeRange === 'today') {
            label = `${String(idx).padStart(2, '0')}h`;
          } else if (timeRange === 'month') {
            const d = new Date(item.date);
            label = isNaN(d.getTime()) ? `N${idx + 1}` : `${d.getDate()}/${d.getMonth() + 1}`;
          } else {
            const d = new Date(item.date);
            if (isNaN(d.getTime())) {
              label = `N${idx + 1}`;
            } else {
              const dayName = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()] || `N${idx + 1}`;
              const dayMonth = `${d.getDate()}/${d.getMonth() + 1}`;
              label = idx === trend.length - 1 ? 'Hôm nay' : `${dayName} (${dayMonth})`;
            }
          }
        }
        return {
          date: item.date,
          label,
          revenue: Math.max(0, item.revenue || 0),
        };
      });
    }

    // Baseline empty points (all 0₫) when no data loaded yet
    if (timeRange === 'today') {
      return Array.from({ length: 24 }, (_, i) => ({
        date: `${String(i).padStart(2, '0')}:00`,
        label: `${String(i).padStart(2, '0')}h`,
        revenue: 0,
      }));
    }

    if (timeRange === 'month') {
      return Array.from({ length: 30 }, (_, i) => ({
        date: `Day-${i + 1}`,
        label: `${i + 1}`,
        revenue: 0,
      }));
    }

    // 7 days default
    const WEEKDAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      const dayName = WEEKDAY_NAMES[d.getDay()] || 'T2';
      const label = i === 6 ? 'Hôm nay' : `${dayName} (${d.getDate()}/${d.getMonth() + 1})`;
      return {
        date: d.toISOString().slice(0, 10),
        label,
        revenue: 0,
      };
    });
  }, [trend, timeRange]);

  // Real scale calculation: if all 0, use 1,000,000 baseline; otherwise scale with 15% headroom
  const revenues = pointsData.map((p) => p.revenue);
  const highestVal = Math.max(...revenues, 0);
  const hasRealRevenue = highestVal > 0;
  const maxRevenue = hasRealRevenue ? Math.round(highestVal * 1.15) : 1000000;
  const minRevenue = 0;

  // Chart dimension constants
  const chartWidth = 700;
  const chartHeight = 180;
  const paddingY = 30;
  const plotHeight = chartHeight - paddingY * 2;

  // Compute coordinates
  const count = pointsData.length;
  const coords = pointsData.map((pt, i) => {
    const x = count > 1 ? Math.round((i / (count - 1)) * chartWidth) : Math.round(chartWidth / 2);
    const ratio = (pt.revenue - minRevenue) / (maxRevenue - minRevenue || 1);
    const y = Math.round(chartHeight - paddingY - ratio * plotHeight);
    return { x, y, pt };
  });

  // Construct smooth SVG curve
  const createSmoothPath = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cx = (p0.x + p1.x) / 2;
      d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const linePath = createSmoothPath(coords);
  const lastX = coords.length > 0 ? coords[coords.length - 1].x : chartWidth;
  const firstX = coords.length > 0 ? coords[0].x : 0;
  const areaPath =
    coords.length > 0 && hasRealRevenue
      ? `${linePath} L ${lastX} ${chartHeight} L ${firstX} ${chartHeight} Z`
      : '';

  const chartTitle =
    timeRange === 'today'
      ? 'Biểu đồ doanh thu hôm nay'
      : timeRange === 'month'
      ? 'Biểu đồ doanh thu 30 ngày qua'
      : 'Biểu đồ doanh thu 7 ngày gần nhất';

  const chartSubtitle =
    timeRange === 'today'
      ? 'Theo dõi doanh thu 24 khung giờ thực tế'
      : timeRange === 'month'
      ? 'Dữ liệu doanh thu thực tế 30 ngày gần nhất từ hệ thống'
      : 'Dữ liệu doanh thu thực tế 7 ngày gần nhất từ hệ thống';

  const shouldShowTick = (idx: number, total: number) => {
    if (total <= 10) return true;
    if (total <= 24) return idx % 2 === 0 || idx === total - 1; // every 2 hours
    return idx % 4 === 0 || idx === total - 1; // every 4 days for month
  };

  const isDense = count > 15;

  return (
    <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-bold text-slate-900 text-sm">
              {chartTitle}
            </h3>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[10px] font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Dữ liệu thực tế</span>
            </div>
            {!hasRealRevenue && !loading && (
              <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                Chưa có doanh thu phát sinh
              </span>
            )}
            {loading && (
              <span className="text-[10px] text-slate-400 font-medium animate-pulse">
                Đang đồng bộ...
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {chartSubtitle}
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-semibold select-none">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#5433eb]" />
            <span className="text-slate-700">VietQR PayOS</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-700">Ví Shop</span>
          </span>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="h-44 sm:h-48 w-full relative">
        <svg
          className="w-full h-full overflow-visible"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="violetRevenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5433eb" stopOpacity="0.32" />
              <stop offset="90%" stopColor="#5433eb" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#5433eb" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1="0"
            y1={paddingY}
            x2={chartWidth}
            y2={paddingY}
            stroke="#f1f5f9"
            strokeDasharray="4 4"
          />
          <line
            x1="0"
            y1={paddingY + plotHeight / 2}
            x2={chartWidth}
            y2={paddingY + plotHeight / 2}
            stroke="#f1f5f9"
            strokeDasharray="4 4"
          />
          <line
            x1="0"
            y1={chartHeight - paddingY}
            x2={chartWidth}
            y2={chartHeight - paddingY}
            stroke="#e2e8f0"
          />

          {/* Area Fill */}
          {areaPath && <path d={areaPath} fill="url(#violetRevenueGradient)" />}

          {/* Curve / Baseline */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#5433eb"
              strokeWidth={isDense ? '2' : '2.5'}
              strokeLinecap="round"
            />
          )}

          {/* Interactive Data Points & Hover Targets */}
          {coords.map((c, i) => {
            const isHovered = hoveredIndex === i;
            const nodeRadius = isHovered ? (isDense ? 4.5 : 5.5) : (isDense ? 2 : 3);
            const hitWidth = Math.max(14, chartWidth / Math.max(1, count));

            return (
              <g key={i}>
                <rect
                  x={Math.max(0, c.x - hitWidth / 2)}
                  y={0}
                  width={hitWidth}
                  height={chartHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />

                {isHovered && (
                  <>
                    <line
                      x1={c.x}
                      y1={paddingY}
                      x2={c.x}
                      y2={chartHeight - paddingY}
                      stroke="#5433eb"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                      strokeOpacity="0.4"
                      pointerEvents="none"
                    />
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={isDense ? 9 : 12}
                      fill="#5433eb"
                      fillOpacity="0.18"
                      pointerEvents="none"
                    />
                  </>
                )}

                <circle
                  cx={c.x}
                  cy={c.y}
                  r={nodeRadius}
                  fill="#ffffff"
                  stroke="#5433eb"
                  strokeWidth={isHovered ? (isDense ? 2.5 : 3) : (isDense ? 1.5 : 2)}
                  className="pointer-events-none transition-all duration-150"
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {hoveredIndex !== null && coords[hoveredIndex] && (
          <div
            className="absolute -top-3 pointer-events-none transform -translate-x-1/2 -translate-y-full bg-slate-900/95 backdrop-blur-sm text-white text-[11px] rounded-xl px-3 py-2 shadow-2xl whitespace-nowrap z-20 border border-slate-800 transition-all duration-75"
            style={{
              left: `${Math.max(8, Math.min(92, (coords[hoveredIndex].x / chartWidth) * 100))}%`,
            }}
          >
            <div className="font-medium text-slate-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa]"></span>
              <span>{coords[hoveredIndex].pt.label || coords[hoveredIndex].pt.date}</span>
            </div>
            <div className="font-black text-[#c0b5f3] text-xs mt-0.5 tracking-tight">
              {formatVND(coords[hoveredIndex].pt.revenue)}
            </div>
          </div>
        )}
      </div>

      {/* X-axis Tick Labels */}
      <div className="relative h-6 mt-2 pt-2 border-t border-slate-100 select-none text-[11px] font-semibold text-slate-400">
        {coords.map((c, i) => {
          if (!shouldShowTick(i, coords.length)) return null;
          const isLast = i === coords.length - 1;
          const isHovered = hoveredIndex === i;
          return (
            <span
              key={i}
              className={`absolute transform -translate-x-1/2 cursor-pointer transition-colors whitespace-nowrap ${
                isLast
                  ? 'text-[#5433eb] font-bold'
                  : isHovered
                  ? 'text-slate-900 font-bold'
                  : 'hover:text-slate-600'
              }`}
              style={{ left: `${(c.x / chartWidth) * 100}%` }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {c.pt.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
