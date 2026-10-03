'use client';

import React from 'react';

export interface DonutPaymentDistribution {
  payosQrPercentage?: number;
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
  trackColor: string;
}

/**
 * Donut chart cơ cấu kênh thanh toán — SVG stroke-dasharray thuần,
 * cùng ngôn ngữ thị giác với mẫu dashboard tham chiếu (3 phân khúc + legend pill).
 */
export function AdminDonutChart({ distribution, loading = false }: AdminDonutChartProps) {
  const payos = distribution?.payosQrPercentage ?? 0;
  const wallet = distribution?.walletPercentage ?? 0;
  const cod = distribution?.codPercentage ?? 0;
  const total = payos + wallet + cod;
  const hasData = total > 0;

  const segments: Segment[] = [
    { key: 'payos', label: 'VietQR PayOS', value: payos, color: '#5433eb', trackColor: 'bg-[#5433eb]' },
    { key: 'wallet', label: 'Ví nội bộ Shop', value: wallet, color: '#10b981', trackColor: 'bg-emerald-500' },
    { key: 'cod', label: 'Thanh toán khi nhận', value: cod, color: '#f59e0b', trackColor: 'bg-amber-500' },
  ];

  // Donut SVG: 3 cung stroke-dasharray trên đường tròn r=54, chu vi ≈ 339.3
  const R = 54;
  const CIRC = 2 * Math.PI * R;
  const STROKE = 16;

  let offsetAcc = 0;
  const arcs = segments.map((seg) => {
    const frac = hasData ? seg.value / total : 0;
    const arc = {
      ...seg,
      dash: frac * CIRC,
      offset: offsetAcc * CIRC,
      frac,
    };
    offsetAcc += frac;
    return arc;
  });

  // Phân khúc lớn nhất hiển thị ở tâm
  const dominant = [...segments].sort((a, b) => b.value - a.value)[0];

  return (
    <div className="flex flex-col items-center gap-4">
      {loading && !distribution ? (
        <div className="w-[124px] h-[124px] rounded-full bg-slate-100 animate-pulse mt-2" aria-hidden="true" />
      ) : (
        <div className="relative w-[124px] h-[124px]" role="img" aria-label="Biểu đồ tròn cơ cấu kênh thanh toán">
          <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
            {/* Track nền */}
            <circle cx="70" cy="70" r={R} fill="none" stroke="#f1f5f9" strokeWidth={STROKE} />
            {hasData &&
              arcs.map((arc) =>
                arc.dash > 0 ? (
                  <circle
                    key={arc.key}
                    cx="70"
                    cy="70"
                    r={R}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={STROKE}
                    strokeDasharray={`${Math.max(arc.dash - 2, 0.5)} ${CIRC - Math.max(arc.dash - 2, 0.5)}`}
                    strokeDashoffset={-arc.offset}
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                ) : null
              )}
          </svg>
          {/* Nhãn tâm: phân khúc lớn nhất */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {hasData ? (
              <>
                <span className="text-lg font-black text-slate-900 leading-none">{dominant.value}%</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-0.5 max-w-[80px] leading-tight">
                  {dominant.label}
                </span>
              </>
            ) : (
              <span className="text-[10px] font-bold text-slate-400 px-3">Chưa có giao dịch</span>
            )}
          </div>
        </div>
      )}

      {/* Legend với pill % */}
      <div className="w-full space-y-2">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="font-semibold text-slate-600 truncate">{seg.label}</span>
            </div>
            {loading && !distribution ? (
              <span className="w-10 h-4 rounded bg-slate-100 animate-pulse" aria-hidden="true" />
            ) : (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  seg.value === dominant.value && hasData
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {seg.value}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
