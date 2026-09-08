'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/stores/cart-store';
import { formatVND } from '@/lib/utils';
import { ProductReviews } from './ProductReviews';
import { ShoppingCart, Zap, Heart, ArrowLeft, ShieldCheck, Truck, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
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
    toast.success(`Đã thêm ${quantity} sản phẩm vào giỏ hàng`);
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
          toast.success('Đã thêm vào danh sách yêu thích!');
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
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Nút quay lại */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-blue-600 transition mb-6 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Quay lại trang chủ sản phẩm</span>
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {/* Ảnh Sản phẩm */}
        <div className="relative aspect-square bg-gray-50 rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <span className="text-sm">Chưa có ảnh</span>
            </div>
          )}

          {product.category && (
            <span className="absolute top-4 left-4 bg-blue-600/90 backdrop-blur text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
              {product.category}
            </span>
          )}

          <button
            onClick={handleToggleWishlist}
            disabled={togglingWishlist}
            className="absolute top-4 right-4 p-3 bg-white/90 backdrop-blur rounded-2xl shadow-md hover:scale-110 active:scale-95 transition"
            title="Thêm vào danh sách yêu thích"
          >
            <Heart
              className={`w-5 h-5 transition-colors ${
                isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-600 hover:text-red-500'
              }`}
            />
          </button>
        </div>

        {/* Thông tin Chi tiết Sản phẩm */}
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-snug">
              {product.name}
            </h1>

            <div className="flex items-baseline gap-4">
              <span className="text-3xl sm:text-4xl font-black text-blue-600 tracking-tight">
                {formatVND(product.price)}
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  product.stock > 0
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {product.stock > 0 ? `Còn hàng (${product.stock} sản phẩm)` : 'Tạm hết hàng'}
              </span>
            </div>

            {/* Mô tả tóm tắt */}
            <div className="border-t border-b border-gray-100 py-4 text-gray-600 text-sm leading-relaxed whitespace-pre-line">
              {product.description || 'Chưa có mô tả chi tiết cho sản phẩm này.'}
            </div>

            {/* Chọn số lượng */}
            {product.stock > 0 && (
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-700">Số lượng:</span>
                <div className="flex items-center border border-gray-200 rounded-xl bg-gray-50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="px-3.5 py-2 text-gray-600 hover:bg-gray-200 transition font-bold"
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-sm font-bold text-gray-800 bg-white py-2">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    className="px-3.5 py-2 text-gray-600 hover:bg-gray-200 transition font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Các nút hành động */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={product.stock <= 0}
                className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold py-3.5 px-6 rounded-2xl border border-blue-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart className="w-5 h-5" />
                <span>Thêm vào giỏ</span>
              </button>

              <button
                type="button"
                onClick={handleBuyNow}
                disabled={product.stock <= 0}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Zap className="w-5 h-5 fill-white" />
                <span>Mua ngay</span>
              </button>
            </div>

            {/* Cam kết của shop */}
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-100 text-center">
              <div className="p-2.5 rounded-xl bg-gray-50">
                <Truck className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                <span className="text-[11px] font-medium text-gray-600 block">Freeship từ 500k</span>
              </div>
              <div className="p-2.5 rounded-xl bg-gray-50">
                <ShieldCheck className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <span className="text-[11px] font-medium text-gray-600 block">Chính hãng 100%</span>
              </div>
              <div className="p-2.5 rounded-xl bg-gray-50">
                <RotateCcw className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                <span className="text-[11px] font-medium text-gray-600 block">Đổi trả 7 ngày</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Phân hệ Đánh giá & Bình luận */}
      <ProductReviews productId={product.id} />
    </div>
  );
}
