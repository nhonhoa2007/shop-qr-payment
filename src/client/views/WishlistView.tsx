'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCartStore } from '@client/stores/cart-store';
import { useWishlistStore } from '@client/stores/wishlist-store';
import { ConfirmDialog } from '@client/components/ui/ConfirmDialog';
import { formatVND } from '@shared/utils';
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
  const [removeTarget, setRemoveTarget] = useState<WishlistProduct | null>(null);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    let ignore = false;
    fetch('/api/wishlist')
      .then((res) => res.json())
      .then((data) => {
        const raw = data.wishlist || data.items;
        if (!ignore && raw) {
          setItems(raw);
          const ids: string[] = raw
            .map((i: Record<string, unknown>) => {
              const product = i.product as Record<string, unknown> | undefined;
              return i.productId || product?.id || i.id;
            })
            .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
          useWishlistStore.getState().setWishlistIds(ids);
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
        useWishlistStore.getState().removeFromWishlist(productId);
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
      <div className="text-center py-20 text-muted-gray text-sm tracking-[-0.014em]">
        <p>Đang tải danh sách yêu thích...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-[28px] p-12 text-center shadow-card max-w-md mx-auto">
        <div className="w-14 h-14 bg-canvas-mist text-ink-black rounded-full flex items-center justify-center mx-auto mb-4">
          <Heart className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-semibold text-ink-black tracking-[-0.05em] mb-1">
          Danh sách yêu thích đang trống
        </h2>
        <p className="text-xs text-muted-gray tracking-[-0.014em] mb-6">
          Hãy thả tim các sản phẩm bạn thích khi dạo shop để lưu lại mua sau nhé!
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-ink-black text-white text-xs font-medium px-5 py-2.5 rounded-full hover:bg-slate-ink transition tracking-[-0.014em]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Khám phá ngay</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 space-y-8">
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
        <p className="text-xs text-muted-gray tracking-[-0.014em]">
          Bạn đang lưu <strong className="text-ink-black">{items.length}</strong> sản phẩm
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {items.map(({ id, product }) => (
          <div
            key={id}
            className="bg-white rounded-[28px] shadow-card p-2.5 overflow-hidden flex flex-col justify-between hover:shadow-card-hover transition-all duration-300"
          >
            <div className="relative aspect-square bg-canvas-mist rounded-[20px] overflow-hidden group">
              {product.image ? (
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-cool-stone">
                  <span className="text-xs">Không có ảnh</span>
                </div>
              )}
              {product.category && (
                <span className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-sm text-ink-black text-[11px] font-medium px-2.5 py-1 rounded-full shadow-soft-sm">
                  {product.category}
                </span>
              )}
              <button
                onClick={() => setRemoveTarget(product)}
                className="absolute top-2.5 right-2.5 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-soft-sm text-muted-gray hover:text-red-500 transition"
                aria-label={`Xóa ${product.name} khỏi yêu thích`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="pt-3 pb-1 px-1.5 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <Link
                  href={`/products/${product.id}`}
                  className="font-semibold text-xs text-ink-black hover:text-shop-violet transition line-clamp-2 tracking-[-0.014em]"
                >
                  {product.name}
                </Link>
                <p className="text-sm font-semibold text-ink-black tracking-tight-display mt-1">
                  {formatVND(product.price)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleAddToCart(product)}
                disabled={product.stock <= 0}
                className="w-full flex items-center justify-center gap-1.5 bg-canvas-mist hover:bg-ink-black hover:text-white text-ink-black font-medium py-2 px-3 rounded-full transition text-xs tracking-[-0.014em] disabled:opacity-30"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{product.stock > 0 ? 'Thêm vào giỏ' : 'Hết hàng'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) {
            handleRemove(removeTarget.id, removeTarget.name);
          }
          setRemoveTarget(null);
        }}
        title="Bỏ khỏi yêu thích?"
        description={removeTarget ? `"${removeTarget.name}" sẽ được gỡ khỏi danh sách lưu của bạn.` : undefined}
        confirmLabel="Bỏ khỏi yêu thích"
        cancelLabel="Giữ lại"
      />
    </div>
  );
}

export default WishlistView;
