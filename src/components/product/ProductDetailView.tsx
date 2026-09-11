'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/stores/cart-store';
import { formatVND } from '@/lib/utils';
import { ProductReviews } from './ProductReviews';
import { ShoppingBag, Zap, Heart, ArrowLeft, ShieldCheck, Truck, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/types';

export function ProductDetailView({ product }: { product: Product }) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [togglingWishlist, setTogglingWishlist] = useState(false);

  const handleAddToCart = () => {
    if (product.stock <= 0) {
      toast.error('Sản phẩm đã hết hàng');
      return;
    }

    for (let i = 0; i < quantity; i++) {
      addItem({
        productId: product.id,
        name: product.name,
        price: product.price,
        image: product.image || undefined,
      });
    }
    toast.success(`Đã thêm ${quantity} sản phẩm vào giỏ`);
  };

  const handleBuyNow = () => {
    handleAddToCart();
    router.push('/checkout');
  };

  const handleToggleWishlist = async () => {
    setTogglingWishlist(true);
    try {
      if (isWishlisted) {
        const res = await fetch(`/api/wishlist?productId=${product.id}`, { method: 'DELETE' });
        if (res.ok) {
          setIsWishlisted(false);
          toast.info('Đã xóa khỏi danh sách yêu thích');
        }
      } else {
        const res = await fetch('/api/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: product.id }),
        });
        if (res.ok) {
          setIsWishlisted(true);
          toast.success('Đã thêm vào danh sách yêu thích');
        } else if (res.status === 401) {
          toast.error('Vui lòng đăng nhập để lưu sản phẩm yêu thích');
        }
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setTogglingWishlist(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
      {/* Back button */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#787574] hover:text-[#000000] transition mb-8 group tracking-[-0.014em]"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Quay lại danh sách sản phẩm</span>
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 bg-white rounded-[28px] p-6 sm:p-10 shadow-card-custom">
        {/* Product Image — 28px card with 20px inner image */}
        <div className="relative aspect-square bg-[#f2f4f5] rounded-[20px] overflow-hidden">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#cccccc]">
              <span className="text-sm">Chưa có ảnh</span>
            </div>
          )}

          {product.category && (
            <span className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm text-[#000000] text-xs font-medium px-3 py-1.5 rounded-full shadow-soft-sm-custom">
              {product.category}
            </span>
          )}

          <button
            onClick={handleToggleWishlist}
            disabled={togglingWishlist}
            className="absolute top-4 right-4 p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-soft-sm-custom hover:scale-105 active:scale-95 transition"
            title="Thêm vào danh sách yêu thích"
          >
            <Heart
              className={`w-5 h-5 transition-colors ${
                isWishlisted ? 'fill-[#5433eb] text-[#5433eb]' : 'text-[#787574] hover:text-[#000000]'
              }`}
            />
          </button>
        </div>

        {/* Product Info */}
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#000000] tracking-[-0.05em] leading-snug">
              {product.name}
            </h1>

            <div className="flex items-baseline gap-4">
              <span className="text-3xl font-semibold text-[#000000] tracking-[-0.05em]">
                {formatVND(product.price)}
              </span>
              <span
                className={`text-xs font-medium px-3 py-1 rounded-full ${
                  product.stock > 0
                    ? 'bg-[#f2f4f5] text-[#000000]'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {product.stock > 0 ? `Còn ${product.stock} sản phẩm` : 'Tạm hết hàng'}
              </span>
            </div>

            {/* Description */}
            <div className="border-t border-b border-[#ebebeb] py-4 text-[#787574] text-sm leading-relaxed tracking-[-0.014em] whitespace-pre-line">
              {product.description || 'Chưa có mô tả chi tiết cho sản phẩm này.'}
            </div>

            {/* Quantity Selector */}
            {product.stock > 0 && (
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-[#787574] tracking-[-0.014em]">Số lượng:</span>
                <div className="flex items-center border border-[#ebebeb] rounded-full bg-[#f2f4f5] overflow-hidden p-0.5">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-full text-[#000000] hover:bg-white transition font-medium flex items-center justify-center text-sm"
                  >
                    -
                  </button>
                  <span className="w-10 text-center text-xs font-semibold text-[#000000]">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    className="w-8 h-8 rounded-full text-[#000000] hover:bg-white transition font-medium flex items-center justify-center text-sm"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={product.stock <= 0}
                className="w-full flex items-center justify-center gap-2 bg-[#f2f4f5] text-[#000000] hover:bg-[#ebebeb] font-medium py-3.5 px-6 rounded-full transition text-sm tracking-[-0.014em] disabled:opacity-40"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Thêm vào giỏ</span>
              </button>

              <button
                type="button"
                onClick={handleBuyNow}
                disabled={product.stock <= 0}
                className="w-full flex items-center justify-center gap-2 bg-[#5433eb] hover:bg-[#4428d4] text-white font-medium py-3.5 px-6 rounded-full shadow-violet-custom transition text-sm tracking-[-0.014em] disabled:opacity-40"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>Mua ngay</span>
              </button>
            </div>

            {/* Commitments */}
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-[#ebebeb] text-center">
              <div className="p-2.5 rounded-[20px] bg-[#f2f4f5]">
                <Truck className="w-4 h-4 text-[#000000] mx-auto mb-1" />
                <span className="text-[11px] font-medium text-[#787574] block">Freeship từ 500k</span>
              </div>
              <div className="p-2.5 rounded-[20px] bg-[#f2f4f5]">
                <ShieldCheck className="w-4 h-4 text-[#000000] mx-auto mb-1" />
                <span className="text-[11px] font-medium text-[#787574] block">Chính hãng 100%</span>
              </div>
              <div className="p-2.5 rounded-[20px] bg-[#f2f4f5]">
                <RotateCcw className="w-4 h-4 text-[#000000] mx-auto mb-1" />
                <span className="text-[11px] font-medium text-[#787574] block">Đổi trả 7 ngày</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Reviews */}
      <ProductReviews productId={product.id} />
    </div>
  );
}
