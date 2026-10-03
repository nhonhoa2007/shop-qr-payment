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

/**
 * Card "Top sản phẩm bán chạy" — tương đương card Top Contacts của mẫu tham chiếu:
 * avatar (ảnh SP) + tên + progress bar tỷ trọng + số lượng đã bán.
 */
export function AdminTopProducts({ products, loading = false }: AdminTopProductsProps) {
  const items = products || [];
  const maxSold = Math.max(...items.map((p) => p.totalSold), 1);

  return (
    <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-slate-200/80 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Top sản phẩm bán chạy</h3>
        <Link
          href="/admin/products"
          className="text-[11px] font-bold text-[#5433eb] hover:underline inline-flex items-center gap-1"
        >
          Sản phẩm
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {loading && !products ? (
        <div className="space-y-4 flex-1" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-2/3 bg-slate-100 rounded animate-pulse" />
                <div className="h-2 w-full bg-slate-100 rounded-full animate-pulse" />
              </div>
              <div className="w-10 h-4 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-2">
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300">
            <Package className="w-5 h-5" />
          </div>
          <p className="text-xs text-slate-400 font-medium">Chưa có đơn hàng nào được thanh toán</p>
        </div>
      ) : (
        <ul className="flex-1 space-y-3.5">
          {items.map((p, idx) => (
            <li key={p.productId} className="flex items-center gap-3">
              {/* Avatar sản phẩm */}
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-100 shrink-0 relative">
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
                  <p className="text-xs font-bold text-slate-800 truncate">
                    <span className="text-slate-300 font-black mr-1">{idx + 1}.</span>
                    {p.name}
                  </p>
                  <span className="text-[11px] font-black text-slate-900 shrink-0">{p.totalSold}</span>
                </div>
                {/* Progress bar tỷ trọng so với sản phẩm dẫn đầu */}
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#5433eb] to-[#8b7cf0] transition-all duration-700"
                    style={{ width: `${Math.max((p.totalSold / maxSold) * 100, 6)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium mt-1">
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
