'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatVND } from '@shared/utils';
import { ArrowRight, Package } from 'lucide-react';

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
  const items = products || [];
  const maxSold = Math.max(...items.map((p) => p.totalSold), 1);

  return (
    <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/90 shadow-xs h-full flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Top sản phẩm bán chạy</h3>
          <p className="text-xs text-slate-400 mt-0.5">Xếp hạng theo số lượng đã bán</p>
        </div>
        <Link
          href="/admin/products"
          className="text-xs font-bold text-[#2f54eb] hover:underline inline-flex items-center gap-1"
        >
          <span>Xem kho</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading && !products ? (
        <div className="space-y-4 flex-1" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-2/3 bg-slate-100 rounded animate-pulse" />
                <div className="h-1.5 w-full bg-slate-100 rounded-full animate-pulse" />
              </div>
              <div className="w-8 h-4 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-2">
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300">
            <Package className="w-5 h-5" />
          </div>
          <p className="text-xs text-slate-400 font-medium">Chưa có sản phẩm nào được thanh toán</p>
        </div>
      ) : (
        <ul className="flex-1 space-y-3.5">
          {items.map((p, idx) => (
            <li key={p.productId} className="flex items-center gap-3">
              {/* Ảnh sản phẩm */}
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200/60 shrink-0 relative">
                {p.image ? (
                  <Image src={p.image} alt={p.name} fill sizes="40px" className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Package className="w-4 h-4" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    <span className="text-slate-400 font-bold mr-1.5">{idx + 1}.</span>
                    {p.name}
                  </p>
                  <span className="font-mono text-xs font-extrabold text-[#2f54eb] shrink-0">
                    {p.totalSold} <span className="text-[10px] text-slate-400 font-normal">đã bán</span>
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#2f54eb] to-[#6b8cff] transition-all duration-700"
                    style={{ width: `${Math.max((p.totalSold / maxSold) * 100, 6)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-1 font-mono">
                  {formatVND(p.price)}
                  {p.category ? ` · ${p.category}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
