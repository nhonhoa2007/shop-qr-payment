'use client';

import React, { useMemo, useState } from 'react';
import { formatVND } from '@shared/utils';
import { TrendingUp, BarChart3, LineChart } from 'lucide-react';

export interface RevenueBarPoint {
  date: string;
  label?: string;
  revenue: number;
  orders?: number;
}

export type RevenueBarRange = 'today' | '7days' | 'month';

export interface AdminRevenueBarsProps {
  trend?: RevenueBarPoint[];
  timeRange?: RevenueBarRange;
  loading?: boolean;
  onRangeChange?: (range: RevenueBarRange) => void;
}

const RANGE_LABELS: Array<{ key: RevenueBarRange; label: string }> = [
  { key: 'today', label: 'Hôm nay' },
  { key: '7days', label: '7 ngày' },
  { key: 'month', label: '30 ngày' },
];

const SVG_W = 760;
const SVG_H = 260;
const PAD_LEFT = 60;
const PAD_RIGHT = 24;
const PAD_TOP = 20;
const PAD_BOTTOM = 36;

export function AdminRevenueBars({
  trend,
  timeRange = '7days',
  loading = false,
  onRangeChange,
}: AdminRevenueBarsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [chartMode, setChartMode] = useState<'area' | 'bar'>('area');

  const points = useMemo<RevenueBarPoint[]>(() => {
    if (trend && trend.length > 0) return trend;
    const count = timeRange === 'today' ? 24 : timeRange === 'month' ? 30 : 7;
    return Array.from({ length: count }, (_, i) => ({
      date: `slot-${i}`,
      label: timeRange === 'today' ? `${i}h` : `T${i + 1}`,
      revenue: 0,
      orders: 0,
    }));
  }, [trend, timeRange]);

  const maxRevenue = Math.max(...points.map((p) => p.revenue), 1);
  const totalRevenue = points.reduce((s, p) => s + p.revenue, 0);
  const totalOrders = points.reduce((s, p) => s + (p.orders ?? 0), 0);
  const hasRevenue = totalRevenue > 0;

  const iw = SVG_W - PAD_LEFT - PAD_RIGHT;
  const ih = SVG_H - PAD_TOP - PAD_BOTTOM;

  // Tọa độ các điểm
  const coords = useMemo(() => {
    const n = Math.max(points.length - 1, 1);
    return points.map((p, i) => {
      const x = PAD_LEFT + (i / n) * iw;
      const y = PAD_TOP + ih - (p.revenue / maxRevenue) * ih;
      return { x, y, point: p, index: i };
    });
  }, [points, maxRevenue, iw, ih]);

  // Đường cong Area SVG (Cubic Bezier mượt mà theo chuẩn Aurora Console)
  const { linePath, areaPath } = useMemo(() => {
    if (coords.length === 0) return { linePath: '', areaPath: '' };
    if (coords.length === 1) {
      const pt = coords[0];
      return {
        linePath: `M ${PAD_LEFT} ${pt.y} L ${PAD_LEFT + iw} ${pt.y}`,
        areaPath: `M ${PAD_LEFT} ${pt.y} L ${PAD_LEFT + iw} ${pt.y} L ${PAD_LEFT + iw} ${PAD_TOP + ih} L ${PAD_LEFT} ${PAD_TOP + ih} Z`,
      };
    }

    let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const cur = coords[i];
      const cx = (prev.x + cur.x) / 2;
      d += ` C ${cx.toFixed(1)} ${prev.y.toFixed(1)}, ${cx.toFixed(1)} ${cur.y.toFixed(1)}, ${cur.x.toFixed(1)} ${cur.y.toFixed(1)}`;
    }

    const startX = coords[0].x.toFixed(1);
    const endX = coords[coords.length - 1].x.toFixed(1);
    const baseY = (PAD_TOP + ih).toFixed(1);
    const area = `${d} L ${endX} ${baseY} L ${startX} ${baseY} Z`;

    return { linePath: d, areaPath: area };
  }, [coords, ih, iw]);

  // Lưới ngang 4 mức
  const gridTicks = useMemo(() => {
    return [0, 0.25, 0.5, 0.75, 1].map((frac) => {
      const val = Math.round(maxRevenue * frac);
      const y = PAD_TOP + ih - frac * ih;
      return { y, val };
    });
  }, [maxRevenue, ih]);

  const hovered = hoveredIndex !== null ? coords[hoveredIndex] : null;

  return (
    <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/90 shadow-xs h-full flex flex-col justify-between">
      {/* Header: Tiêu đề + số liệu tóm tắt + nút đổi range & kiểu chart */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Doanh thu định kỳ (MRR)
            </h3>
            {hasRevenue && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700">
                <TrendingUp className="w-3 h-3" />
                {totalOrders} đơn
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {totalRevenue > 0
              ? `Tổng ${formatVND(totalRevenue)} · Cập nhật theo thời gian thực`
              : 'Theo dõi doanh thu và xu hướng giao dịch'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Chế độ hiển thị Area / Bar */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200/70 text-slate-600">
            <button
              type="button"
              onClick={() => setChartMode('area')}
              title="Biểu đồ vùng (Area)"
              className={`p-1.5 rounded-md transition cursor-pointer ${
                chartMode === 'area' ? 'bg-white text-[#2f54eb] shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartMode('bar')}
              title="Biểu đồ cột (Bar)"
              className={`p-1.5 rounded-md transition cursor-pointer ${
                chartMode === 'bar' ? 'bg-white text-[#2f54eb] shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Chọn kỳ range */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200/70 text-xs font-semibold text-slate-600">
            {RANGE_LABELS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => onRangeChange?.(key)}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  timeRange === key
                    ? 'bg-[#2f54eb] text-white shadow-xs font-bold'
                    : 'hover:bg-white/80 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2f54eb] animate-pulse" />
          Đang đồng bộ dữ liệu...
        </div>
      )}

      {/* SVG Chart */}
      <div className="relative flex-1 min-h-[240px] w-full mt-2">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-full overflow-visible"
          role="img"
          aria-label="Biểu đồ doanh thu"
        >
          <defs>
            <linearGradient id="auroraAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f54eb" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#2f54eb" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="auroraBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f54eb" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#6b8cff" stopOpacity="0.75" />
            </linearGradient>
          </defs>

          {/* Recessive Grid Lines & Y-axis Labels */}
          {gridTicks.map(({ y, val }, i) => (
            <g key={i}>
              <line
                x1={PAD_LEFT}
                y1={y}
                x2={SVG_W - PAD_RIGHT}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray={i === 0 ? undefined : '3 3'}
              />
              <text
                x={PAD_LEFT - 8}
                y={y + 3.5}
                textAnchor="end"
                className="text-[10px] font-mono fill-slate-400 select-none"
              >
                {val >= 1_000_000
                  ? `${(val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1)}tr`
                  : val >= 1_000
                  ? `${Math.round(val / 1_000)}k`
                  : val}
              </text>
            </g>
          ))}

          {/* Area / Line Chart mode */}
          {chartMode === 'area' && (
            <>
              <path d={areaPath} fill="url(#auroraAreaFill)" />
              <path
                d={linePath}
                fill="none"
                stroke="#2f54eb"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Endpoint dot */}
              {coords.length > 0 && (
                <circle
                  cx={coords[coords.length - 1].x}
                  cy={coords[coords.length - 1].y}
                  r="4"
                  fill="#2f54eb"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              )}
            </>
          )}

          {/* Bar Chart mode */}
          {chartMode === 'bar' &&
            coords.map((c) => {
              const barW = Math.max(Math.min((iw / coords.length) * 0.55, 36), 4);
              const barH = PAD_TOP + ih - c.y;
              const isHov = hoveredIndex === c.index;
              return (
                <rect
                  key={c.index}
                  x={c.x - barW / 2}
                  y={c.y}
                  width={barW}
                  height={Math.max(barH, 3)}
                  rx={Math.min(barW / 2, 5)}
                  fill={isHov ? '#1d39c4' : 'url(#auroraBarGrad)'}
                  className="transition-all duration-200"
                />
              );
            })}

          {/* Hover Crosshair / Vertical highlight line */}
          {hovered && (
            <g>
              <line
                x1={hovered.x}
                y1={PAD_TOP}
                x2={hovered.x}
                y2={PAD_TOP + ih}
                stroke="#2f54eb"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.6"
              />
              <circle
                cx={hovered.x}
                cy={hovered.y}
                r="5"
                fill="#2f54eb"
                stroke="#ffffff"
                strokeWidth="2.5"
              />
            </g>
          )}

          {/* X-axis Ticks */}
          {coords
            .filter((_, i) => {
              const step = coords.length <= 8 ? 1 : coords.length <= 16 ? 2 : coords.length <= 24 ? 4 : 5;
              return i % step === 0 || i === coords.length - 1;
            })
            .map((c) => (
              <text
                key={c.index}
                x={c.x}
                y={SVG_H - 12}
                textAnchor="middle"
                className={`text-[11px] select-none font-semibold ${
                  hoveredIndex === c.index ? 'fill-[#2f54eb] font-bold' : 'fill-slate-400'
                }`}
              >
                {c.point.label || c.point.date}
              </text>
            ))}

          {/* Interactive Hit-Areas across columns */}
          {coords.map((c) => {
            const colW = iw / coords.length;
            return (
              <rect
                key={`hit-${c.index}`}
                x={c.x - colW / 2}
                y={PAD_TOP}
                width={colW}
                height={ih}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(c.index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>

        {/* Hover Tooltip Card */}
        {hovered && (
          <div
            className="absolute -translate-x-1/2 -translate-y-full pointer-events-none z-20 transition-all duration-75"
            style={{
              left: `${(hovered.x / SVG_W) * 100}%`,
              top: `${Math.max((hovered.y / SVG_H) * 100 - 4, 4)}%`,
            }}
          >
            <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-xl px-3.5 py-2.5 shadow-xl border border-slate-800 whitespace-nowrap text-left">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                {hovered.point.label || hovered.point.date}
              </p>
              <p className="text-sm font-black text-white">{formatVND(hovered.point.revenue)}</p>
              <p className="text-[11px] text-[#9bb2ff] font-semibold mt-0.5">
                {hovered.point.orders ?? 0} đơn hàng
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Empty state nếu chưa có dữ liệu */}
      {!hasRevenue && !loading && (
        <div className="text-center py-2">
          <span className="inline-block px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-400">
            Chưa có doanh thu phát sinh trong kỳ này
          </span>
        </div>
      )}
    </div>
  );
}
