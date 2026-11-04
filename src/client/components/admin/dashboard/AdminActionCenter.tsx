'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export interface UrgentActionItem {
  id: string;
  type: 'TRANSACTION_MISMATCH' | 'LOW_STOCK' | 'NEW_ORDER' | 'SHIPMENT_ISSUE';
  title: string;
  description: string;
  link: string;
}

export interface AdminActionCenterProps {
  urgentActions?: UrgentActionItem[];
  loading?: boolean;
  lowStockCount?: number;
  unmatchedTxCount?: number;
}

export function AdminActionCenter({ urgentActions, loading = false }: AdminActionCenterProps) {
  if (loading && !urgentActions) return <div className="my-3 h-16 rounded-md bg-slate-100" aria-hidden="true" />;
  if (!urgentActions?.length) {
    return <p className="py-5 text-sm text-slate-500">Không có việc cần xử lý ngay.</p>;
  }

  return <ul className="mt-3 grid gap-3 md:grid-cols-3">
    {urgentActions.map((action) => <li key={action.id}>
      <Link href={action.link} className="group flex h-full items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-700">
        <span className="min-w-0">
          <span className="block font-medium text-slate-900">{action.title}</span>
          <span className="mt-0.5 block text-xs leading-5 text-slate-500">{action.description}</span>
        </span>
        <ArrowRight className="mt-0.5 size-4 shrink-0 text-slate-400 group-hover:text-slate-700" aria-hidden="true" />
      </Link>
    </li>)}
  </ul>;
}
