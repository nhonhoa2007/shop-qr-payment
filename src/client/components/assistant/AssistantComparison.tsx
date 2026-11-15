'use client';

import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, GitCompareArrows } from 'lucide-react';
import type { AssistantComparison as Comparison } from '@shared/types/assistant-commerce';
export function AssistantComparison({ comparison }: { comparison: Comparison }) {
  return <section className="w-full min-w-0 overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]" aria-label="Bảng so sánh hai sản phẩm">
    <div className="flex items-center gap-2 border-b border-slate-100 px-3.5 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-shop-violet"><GitCompareArrows aria-hidden="true" className="h-4 w-4" /></span><div><p className="text-xs font-bold text-slate-900">So sánh sản phẩm</p><p className="mt-0.5 text-[10px] text-slate-500">Đối chiếu theo dữ liệu hiện có tại shop</p></div></div>
    <div className="overflow-x-auto overscroll-x-contain" tabIndex={0} role="region" aria-label="Cuộn ngang bảng so sánh">
      <table className="w-full min-w-[440px] border-collapse text-left text-xs">
        <thead className="bg-slate-50"><tr><th scope="col" className="sticky left-0 z-10 w-28 bg-slate-50 p-3 font-semibold text-slate-500">Tiêu chí</th>{comparison.products.map((p, i) => <th scope="col" key={i} className="min-w-36 p-3 align-top font-bold text-slate-900"><Link href={p.href} className="group inline-flex gap-1 hover:text-shop-violet hover:underline">{p.name}{p.variantName ? ` — ${p.variantName}` : ''}<ArrowUpRight aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 opacity-40 group-hover:opacity-100" /></Link></th>)}</tr></thead>
        <tbody>{comparison.rows.map(row => <tr key={row.code} className="border-t border-slate-100"><th scope="row" className={`sticky left-0 z-[1] bg-white p-3 align-top font-semibold ${row.code === 'price' ? 'text-shop-violet' : 'text-slate-500'}`}>{row.label}</th>{row.values.map((value, i) => <td key={i} className={`p-3 align-top font-medium ${row.code === 'price' ? 'text-shop-violet' : value === 'Chưa có dữ liệu' ? 'text-slate-500' : 'text-slate-700'}`}>{row.code === 'stock' && value === 'Còn hàng' ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />{value}</span> : value}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </section>;
}
