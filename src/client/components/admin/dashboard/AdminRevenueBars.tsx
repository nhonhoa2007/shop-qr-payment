'use client';

import React, { useMemo, useState } from 'react';
import { formatVND } from '@shared/utils';

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

const SVG_W = 700;
const SVG_H = 220;
const PAD_BOTTOM = 8;
const PAD_TOP = 14;

/**
 * Bar chart doanh thu lớn — thanh dọc bo tròn với fill hoa văn chấm bi
 * (ngôn ngữ thị giác đặc trưng của mẫu dashboard tham chiếu), hover highlight
 * + tooltip "doanh thu · số đơn".
 */
export function AdminRevenueBars({ trend, timeRange = '7days', loading = false, onRangeChange }: AdminRevenueBarsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const points = useMemo<RevenueBarPoint[]>(() => {
    if (trend && trend.length > 0) return trend;
    // Zero-filled baseline để biểu đồ không nhảy layout khi chưa có dữ liệu
    const count = timeRange === 'today' ? 24 : timeRange === 'month' ? 30 : 7;
    return Array.from({ length: count }, (_, i) => ({
      date: `slot-${i}`,
      revenue: 0,
      orders: 0,
    }));
  }, [trend, timeRange]);

  const maxRevenue = Math.max(...points.map((p) => p.revenue), 1);
  const totalRevenue = points.reduce((s, p) => s + p.revenue, 0);
  const totalOrders = points.reduce((s, p) => s + (p.orders ?? 0), 0);
  const hasRevenue = totalRevenue > 0;

  const chartH = SVG_H - PAD_BOTTOM - PAD_TOP;
  const slot = SVG_W / points.length;
  const barW = Math.min(slot * 0.55, timeRange === '7days' ? 64 : 26);
  const barRx = Math.min(barW / 2, 7);

  const hovered = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-slate-200/80 shadow-sm h-full flex flex-col">
      {/* Header: tiêu đề + chip chọn range riêng của chart */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Biểu đồ doanh thu</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {totalRevenue > 0
              ? `${formatVND(totalRevenue)} · ${totalOrders} đơn trong kỳ`
              : 'Theo dõi doanh thu theo thời gian thực'}
          </p>
        </div>
        <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/70 text-xs font-bold text-slate-600">
          {RANGE_LABELS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onRangeChange?.(key)}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                timeRange === key ? 'bg-[#5433eb] text-white shadow-sm' : 'hover:bg-white hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 mt-1 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse" />
          Đang đồng bộ...
        </div>
      )}

      {/* Biểu đồ SVG */}
      <div className="relative flex-1 min-h-[220px] mt-2">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="none"
          className="w-full h-full"
          role="img"
          aria-label="Biểu đồ cột doanh thu theo thời gian"
        >
          <defs>
            {/* Hoa văn chấm bi đặc trưng của mẫu dashboard */}
            <pattern id="violetDotPattern" width="5" height="5" patternUnits="userSpaceOnUse">
              <circle cx="1.6" cy="1.6" r="1.1" fill="#5433eb" opacity="0.4" />
            </pattern>
          </defs>

          {/* Lưới ngang đứt nét */}
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={0}
              x2={SVG_W}
              y1={PAD_TOP + chartH * f}
              y2={PAD_TOP + chartH * f}
              stroke="#f1f5f9"
              strokeDasharray="4 4"
            />
          ))}
          <line x1={0} x2={SVG_W} y1={SVG_H - PAD_BOTTOM} y2={SVG_H - PAD_BOTTOM} stroke="#e2e8f0" />

          {points.map((p, i) => {
            const h = Math.max((p.revenue / maxRevenue) * chartH, p.revenue > 0 ? 6 : 3);
            const x = i * slot + (slot - barW) / 2;
            const y = SVG_H - PAD_BOTTOM - h;
            const isHovered = hoveredIndex === i;
            const isMax = p.revenue === maxRevenue && p.revenue > 0;
            return (
              <g key={p.date + i}>
                {/* Hit-area full chiều cao cho hover */}
                <rect
                  x={i * slot}
                  y={0}
                  width={slot}
                  height={SVG_H}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
                {isHovered && (
                  <rect x={x - 3} y={PAD_TOP - 6} width={barW + 6} height={chartH + 6} rx={10} fill="#5433eb" opacity="0.08" />
                )}
                {/* Thân cột: chấm bi thường — đậm violet khi max, đậm hơn nữa khi hover */}
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={barRx}
                  fill={isHovered ? '#4628cb' : isMax ? '#5433eb' : 'url(#violetDotPattern)'}
                  className="transition-all duration-300"
                />
                {/* Đỉnh cột đậm hơn một chút cho khối 3D nhẹ */}
                {isHovered && (
                  <rect x={x} y={y} width={barW} height={Math.min(4, h)} rx={2} fill="#ffffff" opacity="0.5" />
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip nổi khi hover */}
        {hovered && (
          <div
            className="absolute -translate-x-1/2 -translate-y-full pointer-events-none z-10"
            style={{
              left: `${Math.min(Math.max(((hoveredIndex ?? 0) + 0.5) / points.length * 100, 10), 90)}%`,
              top: `${Math.max(((SVG_H - PAD_BOTTOM - (hovered.revenue / maxRevenue) * chartH) / SVG_H) * 100 - 4, 4)}%`,
            }}
          >
            <div className="bg-slate-900/95 backdrop-blur-sm text-white rounded-xl px-3 py-2 shadow-2xl border border-slate-800 whitespace-nowrap">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                {hovered.label || hovered.date}
              </p>
              <p className="text-sm font-black text-white">{formatVND(hovered.revenue)}</p>
              <p className="text-[10px] text-[#c0b5f3] font-semibold mt-0.5">
                {hovered.orders ?? 0} đơn hàng
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Trục X */}
      <div className="flex justify-between mt-2 px-1">
        {points
          .filter((_, i) => {
            const step = points.length <= 8 ? 1 : points.length <= 24 ? 4 : 6;
            return i % step === 0 || i === points.length - 1;
          })
          .map((p, idx, arr) => (
            <span
              key={p.date + idx}
              className={`text-[10px] font-bold ${
                idx === arr.length - 1 ? 'text-[#5433eb]' : 'text-slate-400'
              }`}
            >
              {p.label || ''}
            </span>
          ))}
      </div>

      {/* Empty state */}
      {!hasRevenue && !loading && (
        <div className="absolute inset-x-0 bottom-10 flex justify-center pointer-events-none">
          <span className="px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-500">
            Chưa có doanh thu phát sinh trong kỳ
          </span>
        </div>
      )}
    </div>
  );
}
