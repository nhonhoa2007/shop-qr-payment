'use client';

import React from 'react';

export interface PaymentMethodDistribution {
  payosQrPercentage?: number;
  walletPercentage?: number;
  codPercentage?: number;
}

export interface AdminPaymentBreakdownProps {
  distribution?: PaymentMethodDistribution;
}

export function AdminPaymentBreakdown({ distribution }: AdminPaymentBreakdownProps) {
  // 100% REAL DATA FROM DATABASE - ZERO FABRICATED PERCENTAGES
  const qr = distribution?.payosQrPercentage ?? 0;
  const wallet = distribution?.walletPercentage ?? 0;
  const cod = distribution?.codPercentage ?? 0;
  const hasData = qr > 0 || wallet > 0 || cod > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-slate-900 text-sm">Cơ cấu thanh toán</h3>
        {!hasData && (
          <span className="text-[10px] text-slate-400 font-medium">Chưa có giao dịch</span>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Tỷ trọng các kênh thanh toán thực tế từ đơn hàng đã hoàn tất
      </p>

      <div className="space-y-3.5">
        {/* VietQR PayOS */}
        <div>
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className="text-slate-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#5433eb]" />
              <span>VietQR PayOS (Tự động)</span>
            </span>
            <span className="font-bold text-[#5433eb]">{qr}%</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#5433eb] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${qr}%` }}
            />
          </div>
        </div>

        {/* Ví nội bộ */}
        <div>
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className="text-slate-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Ví nội bộ Shop</span>
            </span>
            <span className="font-bold text-emerald-600">{wallet}%</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${wallet}%` }}
            />
          </div>
        </div>

        {/* COD */}
        <div>
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className="text-slate-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Thanh toán khi nhận (COD)</span>
            </span>
            <span className="font-bold text-amber-600">{cod}%</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${cod}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
