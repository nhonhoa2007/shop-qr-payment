'use client';

import React, { useState } from 'react';

export interface DonutPaymentDistribution {
  vietqrPercentage?: number;
  walletPercentage?: number;
  codPercentage?: number;
}

export interface AdminDonutChartProps {
  distribution?: DonutPaymentDistribution;
  loading?: boolean;
}

interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export function AdminDonutChart({ distribution, loading = false }: AdminDonutChartProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const vietqr = distribution?.vietqrPercentage ?? 0;
  const wallet = distribution?.walletPercentage ?? 0;
  const cod = distribution?.codPercentage ?? 0;
  const total = vietqr + wallet + cod;
  const hasData = total > 0;

  // Màu sắc theo Aurora design system
  const segments: Segment[] = [
    { key: 'vietqr', label: 'VietQR Chuyển khoản', value: vietqr, color: '#2f54eb' },
    { key: 'wallet', label: 'Ví nội bộ Shop', value: wallet, color: '#0e7490' },
    { key: 'cod', label: 'Thanh toán COD', value: cod, color: '#7c3aed' },
  ];

  const size = 180;
  const sw = 22; // stroke width
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  let offsetAcc = 0;
  const arcs = segments.map((seg) => {
    const frac = hasData ? seg.value / total : 0;
    const len = frac * circ;
    const arc = {
      ...seg,
      len,
      offset: offsetAcc,
    };
    offsetAcc += len;
    return arc;
  });

  const dominant = [...segments].sort((a, b) => b.value - a.value)[0];
  const activeSegment = hoveredKey ? segments.find((s) => s.key === hoveredKey) || dominant : dominant;

  return (
    <div className="flex flex-col items-center justify-between h-full gap-4">
      {loading && !distribution ? (
        <div className="w-[150px] h-[150px] rounded-full bg-slate-100 animate-pulse my-2" aria-hidden="true" />
      ) : (
        <div
          className="relative w-[160px] h-[160px] flex items-center justify-center"
          role="img"
          aria-label="Biểu đồ phân bố phương thức thanh toán"
        >
          <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
            {/* Vòng nền mờ */}
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="#eef1f5"
              strokeWidth={sw}
            />

            {/* Các lát cắt stroke-dasharray */}
            {hasData &&
              arcs.map((arc) => {
                if (arc.len <= 0) return null;
                const isHovered = hoveredKey === arc.key;
                return (
                  <circle
                    key={arc.key}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={isHovered ? sw + 4 : sw}
                    strokeDasharray={`${Math.max(arc.len - 2, 0.5)} ${circ - Math.max(arc.len - 2, 0.5)}`}
                    strokeDashoffset={-arc.offset}
                    transform={`rotate(-90 ${cx} ${cy})`}
                    className="transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredKey(arc.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                  />
                );
              })}

            {/* Nhãn chính giữa tâm theo chuẩn Aurora */}
            <text
              x={cx}
              y={cy - 2}
              textAnchor="middle"
              className="font-extrabold fill-slate-900 text-[26px] tracking-tight select-none"
            >
              {hasData ? `${activeSegment.value}%` : '0%'}
            </text>
            <text
              x={cx}
              y={cy + 18}
              textAnchor="middle"
              className="text-[11px] font-semibold fill-slate-400 select-none uppercase tracking-wider"
            >
              {hasData ? activeSegment.label.split(' ')[0] : 'Chưa có'}
            </text>
          </svg>
        </div>
      )}

      {/* Danh sách chú giải (Legend) chuẩn Aurora */}
      <div className="w-full space-y-2 pt-2 border-t border-slate-100">
        {segments.map((seg) => {
          const isDominant = seg.key === dominant.key && hasData;
          const isHov = hoveredKey === seg.key;

          return (
            <div
              key={seg.key}
              onMouseEnter={() => setHoveredKey(seg.key)}
              onMouseLeave={() => setHoveredKey(null)}
              className={`flex items-center justify-between gap-3 text-xs p-1.5 rounded-lg transition-colors cursor-pointer ${
                isHov ? 'bg-slate-50' : ''
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className={`font-semibold truncate ${isHov ? 'text-slate-900' : 'text-slate-600'}`}>
                  {seg.label}
                </span>
              </div>
              <span
                className={`font-mono text-xs font-bold shrink-0 ${
                  isDominant ? 'text-[#2f54eb]' : 'text-slate-800'
                }`}
              >
                {seg.value}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
