'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@client/stores/cart-store';
import { formatVND } from '@shared/utils';
import { ProductReviews } from '@client/components/product/ProductReviews';
import { ShoppingBag, Zap, Heart, ArrowLeft, ShieldCheck, Truck, RotateCcw, Check } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@shared/types';

export function ProductDetailView({ product }: { product: Product }) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [togglingWishlist, setTogglingWishlist] = useState(false);

  // Active variants
  const activeVariants = useMemo(() => {
    return (product.variants || []).filter((v) => v.isActive);
  }, [product.variants]);
  const hasVariants = activeVariants.length > 0;

  // Selected variant state: auto-select first in-stock or first active variant
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(() => {
    if (!product.variants || product.variants.length === 0) return null;
    const firstInStock = product.variants.find((v) => v.isActive && v.stock > 0);
    return firstInStock ? firstInStock.id : (product.variants.find((v) => v.isActive)?.id || null);
  });

  const selectedVariant = useMemo(() => {
    if (!hasVariants) return null;
    return activeVariants.find((v) => v.id === selectedVariantId) || null;
  }, [hasVariants, activeVariants, selectedVariantId]);

  // Extract dimensions: colors and sizes
  const colors = useMemo(() => {
    const list: string[] = [];
    for (const v of activeVariants) {
      if (v.color && v.color.trim() && !list.includes(v.color.trim())) {
        list.push(v.color.trim());
      }
    }
    return list;
  }, [activeVariants]);

  const sizes = useMemo(() => {
    const list: string[] = [];
    for (const v of activeVariants) {
      if (v.size && v.size.trim() && !list.includes(v.size.trim())) {
        list.push(v.size.trim());
      }
    }
    return list;
  }, [activeVariants]);

  // Dynamic preview image: null means follow selectedVariant?.image || product.image
  const [activeImageOverride, setActiveImageOverride] = useState<string | null>(null);

  const displayImage = activeImageOverride || selectedVariant?.image || product.image;
  const currentPrice = selectedVariant ? selectedVariant.price : product.price;
  const currentStock = selectedVariant ? selectedVariant.stock : product.stock;
  const isOutOfStock = hasVariants ? (!selectedVariant || selectedVariant.stock <= 0) : product.stock <= 0;
  const effectiveQuantity = currentStock > 0 ? Math.min(quantity, currentStock) : 1;

  // Select color
  const handleSelectColor = (newColor: string) => {
    setActiveImageOverride(null);
    const currentSize = selectedVariant?.size;
    let match = activeVariants.find((v) => v.color === newColor && v.size === currentSize);
    if (!match) {
      match = activeVariants.find((v) => v.color === newColor && v.stock > 0);
    }
    if (!match) {
      match = activeVariants.find((v) => v.color === newColor);
    }
    if (match) {
      setSelectedVariantId(match.id);
    }
  };

  // Select size
  const handleSelectSize = (newSize: string) => {
    setActiveImageOverride(null);
    const currentColor = selectedVariant?.color;
    let match = activeVariants.find((v) => v.color === currentColor && v.size === newSize);
    if (!match) {
      match = activeVariants.find((v) => v.size === newSize && v.stock > 0);
    }
    if (!match) {
      match = activeVariants.find((v) => v.size === newSize);
    }
    if (match) {
      setSelectedVariantId(match.id);
    }
  };

  // Gallery thumbnails
  const galleryThumbnails = useMemo(() => {
    const list: { url: string; label: string; variantId?: string }[] = [];
    if (product.image) {
      list.push({ url: product.image, label: 'Mặc định' });
    }
    for (const v of activeVariants) {
      if (v.image && !list.some((item) => item.url === v.image)) {
        list.push({ url: v.image, label: v.title, variantId: v.id });
      }
    }
    return list;
  }, [product.image, activeVariants]);

  const handleAddToCart = () => {
    if (hasVariants && !selectedVariant) {
      toast.error('Vui lòng chọn phân loại sản phẩm');
      return;
    }

    if (currentStock <= 0) {
      toast.error('Phân loại này đã hết hàng');
      return;
    }

    addItem(
      {
        productId: product.id,
        name: product.name,
        price: currentPrice,
        image: displayImage || undefined,
        variantId: selectedVariant?.id || null,
        variantTitle: selectedVariant?.title || null,
      },
      effectiveQuantity
    );

    const variantLabel = selectedVariant ? ` (${selectedVariant.title})` : '';
    toast.success(`Đã thêm ${effectiveQuantity} × "${product.name}${variantLabel}" vào giỏ`);
  };

  const handleBuyNow = () => {
    if (hasVariants && !selectedVariant) {
      toast.error('Vui lòng chọn phân loại sản phẩm');
      return;
    }
    if (currentStock <= 0) {
      toast.error('Phân loại này đã hết hàng');
      return;
    }

    addItem(
      {
        productId: product.id,
        name: product.name,
        price: currentPrice,
        image: displayImage || undefined,
        variantId: selectedVariant?.id || null,
        variantTitle: selectedVariant?.title || null,
      },
      effectiveQuantity
    );

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
        {/* Product Image & Thumbnail Gallery */}
        <div className="space-y-4">
          <div className="relative aspect-square bg-[#f2f4f5] rounded-[20px] overflow-hidden">
            {displayImage ? (
              <Image
                src={displayImage}
                alt={selectedVariant?.title ? `${product.name} - ${selectedVariant.title}` : product.name}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition-opacity duration-300"
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

          {/* Thumbnail Strip */}
          {galleryThumbnails.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
              {galleryThumbnails.map((thumb, idx) => {
                const isActive = displayImage === thumb.url;
                return (
                  <button
                    key={`${thumb.url}-${idx}`}
                    type="button"
                    onClick={() => {
                      setActiveImageOverride(thumb.url);
                      if (thumb.variantId) {
                        setSelectedVariantId(thumb.variantId);
                      }
                    }}
                    className={`relative w-16 h-16 rounded-[14px] overflow-hidden border-2 flex-shrink-0 transition ${
                      isActive ? 'border-[#5433eb] ring-2 ring-[#5433eb]/20' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <Image src={thumb.url} alt={thumb.label} fill sizes="64px" className="object-cover" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-[#000000] tracking-[-0.05em] leading-snug">
                {product.name}
              </h1>
              {selectedVariant?.title && (
                <p className="text-xs font-medium text-[#5433eb] mt-1 tracking-[-0.014em]">
                  Đang chọn: {selectedVariant.title}
                </p>
              )}
            </div>

            {/* Price and Stock Badge */}
            <div className="flex items-baseline gap-4">
              <span className="text-3xl font-semibold text-[#000000] tracking-[-0.05em]">
                {formatVND(currentPrice)}
              </span>
              <span
                className={`text-xs font-medium px-3 py-1 rounded-full ${
                  currentStock > 0
                    ? 'bg-[#f2f4f5] text-[#000000]'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {currentStock > 0 ? `Còn ${currentStock} sản phẩm` : 'Tạm hết hàng'}
              </span>
            </div>

            {/* Description */}
            <div className="border-t border-b border-[#ebebeb] py-4 text-[#787574] text-sm leading-relaxed tracking-[-0.014em] whitespace-pre-line">
              {product.description || 'Chưa có mô tả chi tiết cho sản phẩm này.'}
            </div>

            {/* Multi-attribute Variant Selectors */}
            {hasVariants && (
              <div className="space-y-4 py-1">
                {/* 2-Dimension: Colors & Sizes */}
                {colors.length > 0 && sizes.length > 0 ? (
                  <>
                    {/* Colors */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#787574] tracking-[-0.014em]">
                          Màu sắc: <strong className="text-[#000000]">{selectedVariant?.color || 'Chọn màu'}</strong>
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {colors.map((c) => {
                          const isSelected = selectedVariant?.color === c;
                          const isColorAvailable = activeVariants.some((v) => v.color === c && v.stock > 0);
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => handleSelectColor(c)}
                              className={`px-4 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-[#000000] text-white shadow-soft-sm-custom'
                                  : 'bg-[#f2f4f5] text-[#000000] hover:bg-[#ebebeb]'
                              } ${!isColorAvailable ? 'opacity-50' : ''}`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                              <span>{c}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sizes */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#787574] tracking-[-0.014em]">
                          Kích thước: <strong className="text-[#000000]">{selectedVariant?.size || 'Chọn kích thước'}</strong>
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sizes.map((s) => {
                          const isSelected = selectedVariant?.size === s;
                          const variantForSize = activeVariants.find(
                            (v) => v.size === s && (!selectedVariant?.color || v.color === selectedVariant.color)
                          );
                          const isSizeInStock = variantForSize ? variantForSize.stock > 0 : false;
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => handleSelectSize(s)}
                              className={`min-w-[44px] px-4 py-2 rounded-full text-xs font-medium transition-all text-center ${
                                isSelected
                                  ? 'bg-[#5433eb] text-white shadow-violet-custom'
                                  : 'bg-[#f2f4f5] text-[#000000] hover:bg-[#ebebeb]'
                              } ${!isSizeInStock ? 'opacity-40 line-through' : ''}`}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : colors.length > 0 ? (
                  /* Only Colors */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#787574] tracking-[-0.014em]">
                        Màu sắc: <strong className="text-[#000000]">{selectedVariant?.color || 'Chọn màu'}</strong>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {colors.map((c) => {
                        const isSelected = selectedVariant?.color === c;
                        const variantForColor = activeVariants.find((v) => v.color === c);
                        const isAvailable = variantForColor ? variantForColor.stock > 0 : false;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => handleSelectColor(c)}
                            className={`px-4 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-[#5433eb] text-white shadow-violet-custom'
                                : 'bg-[#f2f4f5] text-[#000000] hover:bg-[#ebebeb]'
                            } ${!isAvailable ? 'opacity-40 line-through' : ''}`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                            <span>{c}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : sizes.length > 0 ? (
                  /* Only Sizes */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#787574] tracking-[-0.014em]">
                        Kích thước: <strong className="text-[#000000]">{selectedVariant?.size || 'Chọn kích thước'}</strong>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sizes.map((s) => {
                        const isSelected = selectedVariant?.size === s;
                        const variantForSize = activeVariants.find((v) => v.size === s);
                        const isAvailable = variantForSize ? variantForSize.stock > 0 : false;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => handleSelectSize(s)}
                            className={`min-w-[44px] px-4 py-2 rounded-full text-xs font-medium transition-all text-center ${
                              isSelected
                                ? 'bg-[#5433eb] text-white shadow-violet-custom'
                                : 'bg-[#f2f4f5] text-[#000000] hover:bg-[#ebebeb]'
                            } ${!isAvailable ? 'opacity-40 line-through' : ''}`}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Custom Variant Titles */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#787574] tracking-[-0.014em]">
                        Phân loại: <strong className="text-[#000000]">{selectedVariant?.title || 'Chọn phân loại'}</strong>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeVariants.map((v) => {
                        const isSelected = selectedVariant?.id === v.id;
                        const isAvailable = v.stock > 0;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setSelectedVariantId(v.id)}
                            className={`px-4 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-[#5433eb] text-white shadow-violet-custom'
                                : 'bg-[#f2f4f5] text-[#000000] hover:bg-[#ebebeb]'
                            } ${!isAvailable ? 'opacity-40 line-through' : ''}`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                            <span>{v.title}</span>
                            <span className={`text-[11px] ${isSelected ? 'text-white/80' : 'text-[#787574]'}`}>
                              ({formatVND(v.price)})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Variant Status Pill */}
                {selectedVariant && (
                  <div className="flex items-center gap-3 text-xs text-[#787574] bg-[#f8f9fa] px-4 py-2.5 rounded-[16px] border border-[#ebebeb]">
                    <span className="font-medium text-[#000000]">{selectedVariant.title}</span>
                    {selectedVariant.sku && (
                      <span>
                        • SKU: <code className="font-mono text-[11px] text-[#000000]">{selectedVariant.sku}</code>
                      </span>
                    )}
                    <span>
                      • Tồn kho:{' '}
                      <strong className={selectedVariant.stock > 0 ? 'text-[#000000]' : 'text-red-600'}>
                        {selectedVariant.stock > 0 ? `${selectedVariant.stock} món` : 'Hết hàng'}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Quantity Selector */}
            {currentStock > 0 && (
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-[#787574] tracking-[-0.014em]">Số lượng:</span>
                <div className="flex items-center border border-[#ebebeb] rounded-full bg-[#f2f4f5] overflow-hidden p-0.5">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, effectiveQuantity - 1))}
                    className="w-8 h-8 rounded-full text-[#000000] hover:bg-white transition font-medium flex items-center justify-center text-sm"
                  >
                    -
                  </button>
                  <span className="w-10 text-center text-xs font-semibold text-[#000000]">
                    {effectiveQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(currentStock, effectiveQuantity + 1))}
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
                disabled={isOutOfStock}
                className="w-full flex items-center justify-center gap-2 bg-[#f2f4f5] text-[#000000] hover:bg-[#ebebeb] font-medium py-3.5 px-6 rounded-full transition text-sm tracking-[-0.014em] disabled:opacity-40"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Thêm vào giỏ</span>
              </button>

              <button
                type="button"
                onClick={handleBuyNow}
                disabled={isOutOfStock}
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
