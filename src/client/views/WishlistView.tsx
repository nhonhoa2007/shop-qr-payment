'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCartStore } from '@/client/stores/cart-store';
import { formatVND } from '@/lib/utils';
import { Heart, Trash2, ArrowLeft, Plus } from 'lucide-react';
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
    toast.success(`Đã thêm "${product.name}" vào giỏ`);
  };

  if (loading) {
    return (
      <div className="text-center py-20 text-[#787574] text-sm tracking-[-0.014em]">
        <p>Đang tải danh sách yêu thích...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-[28px] p-12 text-center shadow-card-custom max-w-md mx-auto">
        <div className="w-14 h-14 bg-[#f2f4f5] text-[#000000] rounded-full flex items-center justify-center mx-auto mb-4">
          <Heart className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-semibold text-[#000000] tracking-[-0.05em] mb-1">
          Danh sách yêu thích đang trống
        </h2>
        <p className="text-xs text-[#787574] tracking-[-0.014em] mb-6">
          Hãy thả tim các sản phẩm bạn thích khi dạo shop để lưu lại mua sau nhé!
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-[#000000] text-white text-xs font-medium px-5 py-2.5 rounded-full hover:bg-[#332f2d] transition tracking-[-0.014em]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Khám phá ngay</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center">
          <Heart className="w-5 h-5 fill-red-500" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Sản phẩm yêu thích
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Danh sách các sản phẩm bạn đã lưu để theo dõi và mua sắm sau
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-[#787574] tracking-[-0.014em]">
          Bạn đang lưu <strong className="text-[#000000]">{items.length}</strong> sản phẩm
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {items.map(({ id, product }) => (
          <div
            key={id}
            className="bg-white rounded-[28px] shadow-card-custom p-2.5 overflow-hidden flex flex-col justify-between hover:shadow-card-hover-custom transition-all duration-300"
          >
            <div className="relative aspect-square bg-[#f2f4f5] rounded-[20px] overflow-hidden group">
              {product.image ? (
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#cccccc]">
                  <span className="text-xs">Không có ảnh</span>
                </div>
              )}
              {product.category && (
                <span className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-sm text-[#000000] text-[11px] font-medium px-2.5 py-1 rounded-full shadow-soft-sm-custom">
                  {product.category}
                </span>
              )}
              <button
                onClick={() => handleRemove(product.id, product.name)}
                className="absolute top-2.5 right-2.5 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-soft-sm-custom text-[#787574] hover:text-red-500 transition"
                title="Xóa khỏi yêu thích"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="pt-3 pb-1 px-1.5 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <Link
                  href={`/products/${product.id}`}
                  className="font-semibold text-xs text-[#000000] hover:text-[#5433eb] transition line-clamp-2 tracking-[-0.014em]"
                >
                  {product.name}
                </Link>
                <p className="text-sm font-semibold text-[#000000] tracking-tight-display mt-1">
                  {formatVND(product.price)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleAddToCart(product)}
                disabled={product.stock <= 0}
                className="w-full flex items-center justify-center gap-1.5 bg-[#f2f4f5] hover:bg-[#000000] hover:text-white text-[#000000] font-medium py-2 px-3 rounded-full transition text-xs tracking-[-0.014em] disabled:opacity-30"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{product.stock > 0 ? 'Thêm vào giỏ' : 'Hết hàng'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WishlistView;
