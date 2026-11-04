'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export interface TopProductItem {
  productId: string;
  name: string;
  price: number;
  image: string | null;
  category?: string | null;
  totalSold: number;
}

export interface AdminTopProductsProps {
  products?: TopProductItem[];
  loading?: boolean;
}

export function AdminTopProducts({ products, loading = false }: AdminTopProductsProps) {
  const items = products ?? [];
  return <section className="h-full rounded-lg border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="top-products-title">
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h3 id="top-products-title" className="text-sm font-semibold text-slate-900">Sản phẩm bán chạy</h3>
        <p className="mt-1 text-xs text-slate-500">Xếp theo số lượng đã bán</p>
      </div>
      <Link href="/admin/products" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline">Xem kho <ArrowRight className="size-3" /></Link>
    </div>
    {loading && !products ? <div className="h-32 rounded-md bg-slate-100" aria-hidden="true" /> : items.length === 0 ? <p className="py-8 text-sm text-slate-500">Chưa có sản phẩm nào được thanh toán.</p> : <ol className="divide-y divide-slate-100">
      {items.map((product, index) => <li key={product.productId} className="flex items-center gap-3 py-3 text-xs">
        <span className="w-6 shrink-0 tabular-nums text-slate-400">{String(index + 1).padStart(2, '0')}</span>
        <span className="min-w-0 flex-1 truncate font-medium text-slate-800" title={product.name}>{product.name}</span>
        <span className="shrink-0 tabular-nums text-slate-600">{product.totalSold.toLocaleString('vi-VN')} đã bán</span>
      </li>)}
    </ol>}
  </section>;
}
