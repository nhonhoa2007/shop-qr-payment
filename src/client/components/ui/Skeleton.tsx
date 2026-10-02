/**
 * Skeleton loading primitives dùng chung cho toàn ứng dụng.
 * Nền xám nhạt + animate-pulse, bo góc theo design system (28px card).
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#ececec] rounded-xl ${className}`} aria-hidden="true" />;
}

/** Skeleton lưới sản phẩm — khớp bố cục ProductGrid (4 cột desktop) */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-[28px] p-3 shadow-card">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="pt-4 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-9 w-9 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton trang chi tiết sản phẩm — 2 cột ảnh + thông tin */
export function ProductDetailSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8" aria-busy="true">
      <Skeleton className="h-4 w-48 mb-6" />
      <div className="bg-white rounded-[28px] p-6 sm:p-10 shadow-card grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-48" />
          <div className="space-y-2 pt-4">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
          <div className="flex gap-2 pt-4">
            <Skeleton className="h-10 w-14 rounded-full" />
            <Skeleton className="h-10 w-14 rounded-full" />
            <Skeleton className="h-10 w-14 rounded-full" />
          </div>
          <div className="flex gap-3 pt-4">
            <Skeleton className="h-12 flex-1 rounded-full" />
            <Skeleton className="h-12 flex-1 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Skeleton trang danh sách (đơn hàng, giao dịch...) — các thẻ card ngang */
export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-[28px] p-5 shadow-card flex items-center justify-between gap-4">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
