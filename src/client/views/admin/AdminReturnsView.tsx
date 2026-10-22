'use client';

import React from 'react';
import { RotateCcw } from 'lucide-react';

export interface AdminReturnsViewProps {
  initialReturns: any[];
}

export function AdminReturnsView({ initialReturns }: AdminReturnsViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quản lý đổi trả</h1>
          <p className="text-sm text-slate-500">
            Kiểm duyệt yêu cầu đổi trả hàng, tiếp nhận vào kho cách ly và kiểm định sản phẩm.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <span className="font-semibold text-slate-800">Danh sách yêu cầu đổi trả ({initialReturns.length})</span>
        </div>

        {initialReturns.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <RotateCcw className="h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-base font-semibold text-slate-800">Chưa có yêu cầu đổi trả nào</h3>
            <p className="mt-1 text-sm text-slate-500">Các yêu cầu đổi trả từ khách hàng sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {initialReturns.map((ret) => (
              <div key={ret.id} className="flex items-center justify-between p-6 hover:bg-slate-50/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-emerald-600">{ret.returnNumber}</span>
                    <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-700/10">
                      {ret.status}
                    </span>
                    {ret.disposition && (
                      <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">
                        {ret.disposition}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 font-medium">
                    Đơn hàng: #{ret.order?.orderCode} - Số mặt hàng trả: {ret.items?.length || 0}
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-1">Lý do: {ret.reason}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">
                    {new Date(ret.createdAt).toLocaleDateString('vi-VN')}
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
