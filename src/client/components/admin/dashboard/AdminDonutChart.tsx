'use client';

export interface DonutPaymentDistribution {
  vietqrPercentage?: number;
  walletPercentage?: number;
  codPercentage?: number;
}

export interface AdminDonutChartProps {
  distribution?: DonutPaymentDistribution;
  sampleCount?: number;
  loading?: boolean;
}

export function AdminDonutChart({ distribution, sampleCount, loading = false }: AdminDonutChartProps) {
  const methods = [
    { key: 'vietqr', label: 'VietQR / SePay', value: distribution?.vietqrPercentage ?? 0, color: '#475569' },
    { key: 'wallet', label: 'Ví nội bộ Shop', value: distribution?.walletPercentage ?? 0, color: '#94a3b8' },
    { key: 'cod', label: 'COD đã thu', value: distribution?.codPercentage ?? 0, color: '#d6dce1' },
  ];
  const hasData = methods.some((method) => method.value > 0);
  const qrEnd = Math.max(0, Math.min(100, methods[0].value));
  const walletEnd = Math.max(qrEnd, Math.min(100, qrEnd + methods[1].value));

  if (loading && !distribution) return <div className="mx-auto size-44 rounded-full bg-slate-100" aria-hidden="true" />;
  if (!hasData) return <p className="py-8 text-center text-sm text-slate-500">Chưa có thanh toán trong kỳ</p>;

  return <div className="space-y-5">
    <div
      role="img"
      aria-label={`Tỷ trọng thanh toán: VietQR ${methods[0].value}%, ví Shop ${methods[1].value}%, COD ${methods[2].value}%`}
      className="mx-auto grid size-44 place-items-center rounded-full p-4"
      style={{ background: `conic-gradient(#475569 0% ${qrEnd}%, #94a3b8 ${qrEnd}% ${walletEnd}%, #d6dce1 ${walletEnd}% 100%)` }}
    >
      <div className="flex size-full flex-col items-center justify-center rounded-full bg-white text-center">
        {sampleCount !== undefined && <strong className="text-2xl font-semibold tabular-nums text-slate-900">{sampleCount.toLocaleString('vi-VN')}</strong>}
        <span className="max-w-24 text-[10px] leading-4 text-slate-500">đơn đã thanh toán</span>
      </div>
    </div>
    <ul className="space-y-2.5">
      {methods.map((method) => <li key={method.key} className="flex items-center gap-2 text-xs text-slate-600">
        <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: method.color }} aria-hidden="true" />
        <span className="flex-1">{method.label}</span>
        <strong className="font-semibold tabular-nums text-slate-900">{method.value}%</strong>
      </li>)}
    </ul>
  </div>;
}
