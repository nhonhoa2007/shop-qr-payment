'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';

export interface AdminWarrantiesViewProps {
  initialClaims: any[];
}

export function AdminWarrantiesView({ initialClaims }: AdminWarrantiesViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quản lý bảo hành</h1>
          <p className="text-sm text-slate-500">
            Theo dõi, tiếp nhận kỹ thuật và giải quyết hồ sơ bảo hành thiết bị điện tử.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <span className="font-semibold text-slate-800">Danh sách hồ sơ bảo hành ({initialClaims.length})</span>
        </div>

        {initialClaims.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <ShieldCheck className="h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-base font-semibold text-slate-800">Chưa có hồ sơ bảo hành nào</h3>
            <p className="mt-1 text-sm text-slate-500">Các yêu cầu bảo hành từ khách hàng sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {initialClaims.map((claim) => (
              <div key={claim.id} className="flex items-center justify-between p-6 hover:bg-slate-50/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-blue-600">{claim.claimNumber}</span>
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                      {claim.status}
                    </span>
                    {claim.resolutionOutcome && (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-700/10">
                        {claim.resolutionOutcome}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 font-medium">
                    {claim.orderItem?.productName || 'Sản phẩm'} - Đơn hàng: #{claim.order?.orderCode}
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-1">Mô tả lỗi: {claim.issueDescription}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">
                    {new Date(claim.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
