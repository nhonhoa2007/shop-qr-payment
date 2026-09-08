'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCartStore } from '@/stores/cart-store';
import { formatVND } from '@/lib/utils';
import { Heart, ShoppingCart, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface WishlistProduct {
  id: string;
  name: string;
  price: number;
  image: string | null;
  category: string | null;
  stock: number;
}

interface WishlistItem {
  id: string;
  productId: string;
  createdAt: string;
  product: WishlistProduct;
}

export function WishlistView() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    let ignore = false;
    fetch('/api/wishlist')
      .then((res) => res.json())
      .then((data) => {
        if (!ignore && data.wishlist) {
          setItems(data.wishlist);
        }
      })
      .catch(() => {
        if (!ignore) toast.error('Lỗi khi tải danh sách yêu thích');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleRemove = async (productId: string, name: string) => {
    try {
      const res = await fetch(`/api/wishlist?productId=${productId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.info(`Đã bỏ "${name}" khỏi yêu thích`);
        setItems((prev) => prev.filter((item) => item.productId !== productId));
      }
    } catch {
      toast.error('Lỗi khi xóa sản phẩm');
    }
  };

  const handleAddToCart = (product: WishlistProduct) => {
    if (product.stock <= 0) {
      toast.error('Sản phẩm đã hết hàng');
      return;
    }
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image || undefined,
    });
    toast.success(`Đã thêm "${product.name}" vào giỏ hàng`);
  };

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>Đang tải danh sách yêu thích...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm max-w-lg mx-auto">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Heart className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Danh sách yêu thích đang trống</h2>
        <p className="text-sm text-gray-500 mb-6">
          Hãy thả tim những sản phẩm bạn thích khi dạo shop để lưu lại và mua sau nhé!
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-2xl transition shadow-md"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Khám phá sản phẩm ngay</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Bạn đang lưu <strong className="text-gray-900">{items.length}</strong> sản phẩm
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {items.map(({ id, product }) => (
          <div
            key={id}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col justify-between hover:shadow-md transition"
          >
            <div className="relative aspect-square bg-gray-50 overflow-hidden group">
              {product.image ? (
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <span className="text-xs">Không có ảnh</span>
                </div>
              )}
              {product.category && (
                <span className="absolute top-3 left-3 bg-blue-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full shadow-sm">
                  {product.category}
                </span>
              )}
              <button
                onClick={() => handleRemove(product.id, product.name)}
                className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white rounded-full shadow-sm text-gray-400 hover:text-red-500 transition"
                title="Xóa khỏi yêu thích"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <Link
                  href={`/products/${product.id}`}
                  className="font-semibold text-gray-900 hover:text-blue-600 transition line-clamp-2 text-sm"
                >
                  {product.name}
                </Link>
                <p className="text-base font-bold text-blue-600 mt-1">
                  {formatVND(product.price)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleAddToCart(product)}
                disabled={product.stock <= 0}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-xl transition text-xs disabled:opacity-50"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{product.stock > 0 ? 'Thêm vào giỏ' : 'Hết hàng'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
