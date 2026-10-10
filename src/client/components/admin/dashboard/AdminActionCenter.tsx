'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

export interface UrgentActionItem {
  id: string;
  type: 'TRANSACTION_MISMATCH' | 'LOW_STOCK' | 'NEW_ORDER' | 'SHIPMENT_ISSUE';
  title: string;
  description: string;
  link: string;
}

export interface AdminActionCenterProps {
  urgentActions?: UrgentActionItem[];
  lowStockCount?: number;
  unmatchedTxCount?: number;
}

export function AdminActionCenter({ urgentActions }: AdminActionCenterProps) {
  const actions = urgentActions && urgentActions.length > 0 ? urgentActions : [];

  if (actions.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/60 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-bold text-emerald-900">Hệ thống vận hành ổn định</p>
          <p className="text-[11px] text-emerald-700 mt-0.5">
            Không có cảnh báo tồn kho, giao dịch lệch hay đơn hàng quá hạn cần can thiệp.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-amber-800 text-xs font-bold px-0.5">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <span>Có {actions.length} cảnh báo vận hành cần xử lý</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {actions.slice(0, 3).map((action) => (
          <div
            key={action.id}
            className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 hover:bg-amber-50 hover:border-amber-300 transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <p className="text-xs font-bold text-amber-950 truncate">
                  {action.title}
                </p>
              </div>
              <p className="text-[11px] text-amber-900/80 leading-relaxed line-clamp-2">
                {action.description}
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-amber-200/50 flex justify-end">
              <Link
                href={action.link}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 hover:text-amber-950 transition"
              >
                <span>Xử lý ngay</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
