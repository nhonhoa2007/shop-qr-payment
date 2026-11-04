'use client';

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
  previousTrend?: RevenueBarPoint[];
  timeRange?: RevenueBarRange;
  loading?: boolean;
}

const W = 720;
const H = 226;
const LEFT = 45;
const RIGHT = 14;
const TOP = 14;
const BOTTOM = 31;

export function AdminRevenueBars({ trend, previousTrend, timeRange = 'today', loading = false }: AdminRevenueBarsProps) {
  const points = trend ?? [];
  const previousPoints = previousTrend ?? [];
  const chartWidth = W - LEFT - RIGHT;
  const chartHeight = H - TOP - BOTTOM;
  const max = Math.max(1, ...points.map((point) => point.revenue), ...previousPoints.map((point) => point.revenue));
  const total = points.reduce((sum, point) => sum + point.revenue, 0);
  const label = timeRange === 'today' ? 'hôm nay' : timeRange === '7days' ? '7 ngày' : '30 ngày';
  const tickStep = Math.max(1, Math.ceil(points.length / 7));

  return (
    <section className="flex h-full min-h-[330px] flex-col rounded-lg border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="admin-revenue-title">
      <div className="mb-4">
        <h2 id="admin-revenue-title" className="text-sm font-semibold text-slate-900">Doanh thu theo thời gian</h2>
        <p className="mt-1 text-xs text-slate-500">Tiền đã thu từ đơn hàng, chưa trừ hoàn tiền.</p>
        <p className="mt-4 text-xl font-semibold tabular-nums tracking-tight text-slate-900">{loading && !trend ? 'Đang tải dữ liệu' : formatVND(total)}</p>
      </div>
      {loading && !trend ? (
        <div className="flex-1 rounded-md bg-slate-100" aria-hidden="true" />
      ) : points.length === 0 || (total === 0 && previousPoints.every((point) => point.revenue === 0)) ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Chưa có doanh thu trong kỳ</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="min-h-[210px] w-full flex-1" role="img" aria-label={`Biểu đồ doanh thu ${label} so với kỳ trước`}>
          {[0, 0.5, 1].map((part) => {
            const y = TOP + chartHeight * (1 - part);
            const value = max * part;
            return <g key={part}>
              <line x1={LEFT} x2={W - RIGHT} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />
              <text x={LEFT - 7} y={y + 4} textAnchor="end" fill="#64748b" fontSize="10">{value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}tr` : value >= 1_000 ? `${Math.round(value / 1_000)}k` : Math.round(value)}</text>
            </g>;
          })}
          {points.map((point, index) => {
            const slot = chartWidth / points.length;
            const width = Math.max(2, Math.min(20, slot * 0.34));
            const x = LEFT + slot * index + (slot - width * 2 - 3) / 2;
            const height = (point.revenue / max) * chartHeight;
            const previous = previousPoints[index];
            const previousHeight = ((previous?.revenue ?? 0) / max) * chartHeight;
            const showTick = index % tickStep === 0 || index === points.length - 1;
            return <g key={`${point.date}-${index}`}>
              {previous && <rect x={x} y={TOP + chartHeight - previousHeight} width={width} height={Math.max(previousHeight, 1)} rx="2" fill="#d7dde2">
                <title>{`Kỳ trước: ${formatVND(previous.revenue)}`}</title>
              </rect>}
              <rect x={x + width + 3} y={TOP + chartHeight - height} width={width} height={Math.max(height, 1)} rx="2" fill="#475569">
                <title>{`${point.label ?? point.date}: ${formatVND(point.revenue)}`}</title>
              </rect>
              {showTick && <text x={x + width + 1} y={H - 10} textAnchor="middle" fill="#64748b" fontSize="10">{point.label ?? point.date}</text>}
            </g>;
          })}
        </svg>
      )}
      {previousPoints.length > 0 && <div className="mt-2 flex items-center gap-5 text-[11px] text-slate-600"><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-sm bg-slate-600" />Kỳ đang chọn</span><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-sm bg-slate-300" />Kỳ trước tương ứng</span></div>}
    </section>
  );
}
