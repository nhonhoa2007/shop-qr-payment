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
  // 100% REAL DATA FROM DATABASE - ZERO FABRICATED ALERTS
  const actions = urgentActions && urgentActions.length > 0 ? urgentActions : [];

  if (actions.length === 0) {
    return (
      <div className="mt-4 p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/70">
        <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold mb-1">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Hệ thống vận hành tối ưu</span>
        </div>
        <p className="text-[11px] text-emerald-900">
          Không có cảnh báo nghiệp vụ nào cần xử lý ngay bây giờ.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2.5">
      <div className="flex items-center gap-2 text-amber-800 text-xs font-bold px-1">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <span>Cảnh báo cần xử lý ({actions.length})</span>
      </div>

      <div className="space-y-2">
        {actions.slice(0, 3).map((action) => (
          <div
            key={action.id}
            className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/70 hover:bg-amber-100/60 transition"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-amber-950 leading-tight">
                  {action.title}
                </p>
                <p className="text-[11px] text-amber-900 mt-1 leading-relaxed">
                  {action.description}
                </p>
              </div>
              <Link
                href={action.link}
                className="p-1.5 rounded-lg bg-white/80 hover:bg-white text-amber-800 shadow-xs shrink-0 transition"
                title="Xử lý ngay"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
