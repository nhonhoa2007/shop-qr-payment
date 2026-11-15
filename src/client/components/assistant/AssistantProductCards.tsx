'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, Package, ArrowUpRight, Scale } from 'lucide-react';
import type { AssistantProductCard } from '@shared/types/assistant-commerce';
import { formatVND } from '@shared/utils';
import { assistantRefKey, type AssistantSelection } from '@client/lib/assistant-selection';

function ProductImage({ product }: { product: AssistantProductCard }) {
  const [failed, setFailed] = useState(false);
  return <div className="relative flex h-[86px] w-[86px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-muted-gray ring-1 ring-slate-200/70">
    {product.image && !failed ? <Image src={product.image} alt="" fill sizes="80px" className="object-contain p-1" onError={() => setFailed(true)} /> : <Package aria-hidden="true" className="h-7 w-7" />}
  </div>;
}
export function AssistantProductCards({ products, selected, onSelect, disabled }: {
  products: AssistantProductCard[]; selected: AssistantSelection[];
  onSelect: (product: AssistantProductCard) => void; disabled?: boolean;
}) {
  return <div className="w-full min-w-0 space-y-3" aria-label="Sản phẩm tìm được">
    {products.map(product => {
      const chosen = selected.some(ref => assistantRefKey(ref) === assistantRefKey(product));
      return <article key={assistantRefKey(product)} className={`min-w-0 rounded-[22px] border bg-white p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition ${chosen ? 'border-violet-400 ring-2 ring-violet-100' : 'border-slate-200/80'}`}>
        <div className="flex items-start gap-3.5">
          <Link href={product.href} aria-label={`Xem ${product.name}`}><ProductImage product={product} /></Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{product.brand || product.categoryName}</p>
            {product.isDemo && <p className="mt-0.5 text-[10px] font-medium text-amber-700">Dữ liệu demo · Ảnh minh họa</p>}
            <Link href={product.href} className="mt-1 block line-clamp-2 text-sm font-semibold leading-snug text-slate-900 hover:text-shop-violet focus-visible:outline-shop-violet">{product.name}</Link>
            {product.variantName && <p className="mt-1 truncate text-[11px] text-slate-500">{product.variantName}</p>}
            <p className="mt-1.5 text-[15px] font-bold tracking-tight text-shop-violet">{product.price.min !== product.price.max ? 'Từ ' : ''}{formatVND(product.price.min)}</p>
            <p className={`mt-0.5 text-[11px] font-medium ${product.stock > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>{product.stock > 0 ? '● Còn hàng' : '● Tạm hết hàng'}</p>
          </div>
        </div>
        {product.specs.some(s => s.state === 'KNOWN') && <p className="mt-3 rounded-xl bg-slate-50 px-2.5 py-2 text-[11px] leading-relaxed text-slate-500">{product.specs.filter(s => s.state === 'KNOWN').slice(0, 3).map(s => `${s.label}: ${s.formatted}`).join(' · ')}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
          <Link href={product.href} className="inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-shop-violet">Xem <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></Link>
          <button type="button" aria-pressed={chosen} aria-label={`${chosen ? 'Bỏ chọn' : 'Chọn so sánh'} ${product.name}${product.variantName ? ` ${product.variantName}` : ''}`} disabled={disabled || !product.categoryId} onClick={() => onSelect(product)} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${chosen ? 'bg-shop-violet text-white shadow-sm shadow-violet-200' : 'bg-slate-900 text-white hover:bg-violet-700'}`}>
            {chosen ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Scale aria-hidden="true" className="h-3.5 w-3.5" />}{chosen ? 'Đã chọn' : 'Chọn so sánh'}
          </button>
        </div>
      </article>;
    })}
  </div>;
}
