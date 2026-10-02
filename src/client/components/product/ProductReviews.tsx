'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, MessageSquare, Send, CheckCircle2, ShoppingBag, Store } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  reply: string | null;
  createdAt: string;
  user: {
    name: string | null;
    avatar?: string | null;
    image?: string | null;
  };
}

interface EligibleOrder {
  id: string;
  orderCode: string;
  createdAt: string;
}

export function ProductReviews({
  productId,
  orderId: propOrderId,
}: {
  productId: string;
  orderId?: string;
}) {
  const { data: session } = useSession();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Review Form state
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');

  // Eligibility & Order state
  const [eligibleOrders, setEligibleOrders] = useState<EligibleOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [canReview, setCanReview] = useState<boolean | null>(null);
  const [alreadyReviewedAll, setAlreadyReviewedAll] = useState(false);

  // Derived effective order ID: propOrderId > user manually selected > first eligible order
  const activeOrderId = propOrderId || selectedOrderId || (eligibleOrders[0]?.id ?? '');

  const refreshReviews = useCallback(() => {
    fetch(`/api/products/${productId}/reviews`)
      .then((res) => res.json())
      .then((data) => {
        if (data.reviews) setReviews(data.reviews);
        if (typeof data.canReview === 'boolean') setCanReview(data.canReview);
        if (typeof data.alreadyReviewedAll === 'boolean') {
          setAlreadyReviewedAll(data.alreadyReviewedAll);
        }
        if (Array.isArray(data.eligibleOrders)) {
          setEligibleOrders(data.eligibleOrders);
        }
      })
      .catch((err) => console.error('Fetch reviews error:', err));
  }, [productId]);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/products/${productId}/reviews`)
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) {
          if (data.reviews) setReviews(data.reviews);
          if (typeof data.canReview === 'boolean') setCanReview(data.canReview);
          if (typeof data.alreadyReviewedAll === 'boolean') {
            setAlreadyReviewedAll(data.alreadyReviewedAll);
          }
          if (Array.isArray(data.eligibleOrders)) {
            setEligibleOrders(data.eligibleOrders);
          }
        }
      })
      .catch((err) => console.error('Fetch reviews error:', err))
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [productId]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) {
      toast.error('Vui lòng đăng nhập để gửi đánh giá sản phẩm');
      return;
    }

    if (!comment.trim()) {
      toast.error('Vui lòng nhập nội dung nhận xét');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          comment: comment.trim(),
          ...(activeOrderId ? { orderId: activeOrderId } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gửi đánh giá không thành công');
      }

      toast.success('Cảm ơn bạn đã đánh giá sản phẩm!');
      setComment('');
      setRating(5);
      refreshReviews();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi gửi đánh giá');
    } finally {
      setSubmitting(false);
    }
  };

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-8 mt-12 pt-8 border-t border-faint-border">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2 tracking-tight">
            <MessageSquare className="w-6 h-6 text-shop-violet" />
            <span>Đánh giá & Nhận xét từ khách hàng</span>
          </h3>
          <p className="text-sm text-muted-gray mt-1">Trải nghiệm thực tế từ người mua đã thanh toán đơn hàng</p>
        </div>

        {reviews.length > 0 && (
          <div className="flex items-center gap-3 bg-amber-50/80 px-4 py-2 rounded-2xl border border-amber-200/70 shadow-xs">
            <div className="text-3xl font-black text-amber-600">{avgRating}</div>
            <div>
              <div className="flex text-amber-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${star <= Math.round(Number(avgRating)) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                  />
                ))}
              </div>
              <span className="text-xs text-amber-800 font-medium mt-0.5 block">{reviews.length} lượt đánh giá</span>
            </div>
          </div>
        )}
      </div>

      {/* Form viết đánh giá */}
      <div className="bg-white rounded-[24px] p-6 sm:p-7 border border-faint-border shadow-sm">
        <h4 className="font-bold text-gray-900 text-base mb-3">Chia sẻ cảm nhận của bạn về sản phẩm</h4>

        {!session?.user ? (
          <div className="text-sm text-muted-gray py-2">
            Vui lòng{' '}
            <Link href="/login" className="text-shop-violet hover:text-[#4628cb] font-semibold underline transition">
              đăng nhập
            </Link>{' '}
            tài khoản đã mua sản phẩm này để gửi đánh giá.
          </div>
        ) : canReview === false ? (
          <div className="p-4 rounded-2xl bg-canvas-mist border border-faint-border flex items-start gap-3 text-sm text-muted-gray">
            {alreadyReviewedAll ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-shop-violet shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900">Bạn đã hoàn tất đánh giá cho sản phẩm này</p>
                  <p className="text-xs text-muted-gray mt-0.5">
                    Cảm ơn bạn đã chia sẻ trải nghiệm thực tế với cộng đồng người mua!
                  </p>
                </div>
              </>
            ) : (
              <>
                <ShoppingBag className="w-5 h-5 text-shop-violet shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900">Chỉ khách hàng đã mua sản phẩm mới có thể đánh giá</p>
                  <p className="text-xs text-muted-gray mt-0.5">
                    Đơn hàng cần đạt trạng thái Hoàn thành. Nếu bạn vừa mua hàng, hãy quay lại đánh giá sau khi nhận hàng thành công nhé!
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmitReview} className="space-y-4">
            {/* Order Selection Badge / Selector */}
            {eligibleOrders.length > 1 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-muted-gray">Chọn đơn hàng:</span>
                <select
                  value={activeOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="px-3 py-1.5 bg-canvas-mist border border-faint-border rounded-xl text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-shop-violet/30 focus:border-shop-violet"
                >
                  {eligibleOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      #{order.orderCode} ({new Date(order.createdAt).toLocaleDateString('vi-VN')})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {eligibleOrders.length === 1 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f0edfe] text-shop-violet text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Đánh giá cho đơn hàng #{eligibleOrders[0].orderCode}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700" id="review-rating-label">
                Chấm điểm:
              </span>
              <div className="flex gap-1" role="radiogroup" aria-labelledby="review-rating-label">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    role="radio"
                    aria-checked={rating === star}
                    aria-label={`${star} sao`}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1.5 text-amber-400 hover:scale-110 transition cursor-pointer"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= (hoverRating || rating) ? 'fill-amber-400' : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <span className="text-sm font-semibold text-gray-600 ml-2">
                {rating === 5 && 'Tuyệt vời'}
                {rating === 4 && 'Hài lòng'}
                {rating === 3 && 'Bình thường'}
                {rating === 2 && 'Không hài lòng'}
                {rating === 1 && 'Rất tệ'}
              </span>
            </div>

            <div>
              <textarea
                required
                rows={3}
                placeholder="Chia sẻ chất lượng sản phẩm, độ bền, đóng gói, thái độ giao hàng..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full px-4 py-3 bg-canvas-mist/60 hover:bg-canvas-mist focus:bg-white border border-faint-border rounded-2xl text-sm outline-none transition focus:ring-2 focus:ring-shop-violet/30 focus:border-shop-violet text-gray-900 placeholder-[#787574]"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !comment.trim()}
                className="flex items-center gap-2 bg-shop-violet hover:bg-[#4628cb] active:scale-[0.98] text-white text-sm font-semibold px-6 py-2.5 rounded-full transition shadow-sm shadow-[#5433eb]/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Đang gửi...' : 'Gửi nhận xét'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Danh sách các đánh giá */}
      {loading ? (
        <div className="text-center py-8 text-muted-gray text-sm animate-pulse">Đang tải đánh giá...</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-[24px] border border-faint-border p-8 shadow-xs">
          <Star className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="font-semibold text-gray-800">Chưa có đánh giá nào cho sản phẩm này</p>
          <p className="text-xs text-muted-gray mt-1">Hãy là người đầu tiên mua và chia sẻ trải nghiệm nhé!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white p-5 sm:p-6 rounded-[24px] border border-faint-border shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {r.user.avatar || r.user.image ? (
                    <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-shop-violet/10">
                      <Image
                        src={r.user.avatar || r.user.image || ''}
                        alt={r.user.name || 'Khách hàng'}
                        fill
                        sizes="40px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#f0edfe] text-shop-violet font-bold flex items-center justify-center text-sm ring-2 ring-shop-violet/10">
                      {r.user.name ? r.user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{r.user.name || 'Khách hàng'}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-gray mt-0.5">
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Đã mua hàng
                      </span>
                      <span>•</span>
                      <span>{new Date(r.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex text-amber-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${star <= r.rating ? 'fill-amber-400' : 'text-gray-200'}`}
                    />
                  ))}
                </div>
              </div>

              {r.comment && <p className="text-gray-800 text-sm leading-relaxed">{r.comment}</p>}

              {r.reply && (
                <div className="bg-[#f0edfe]/50 border-l-4 border-shop-violet p-3.5 rounded-r-2xl mt-3 text-xs">
                  <span className="font-bold text-shop-violet flex items-center gap-1.5 mb-1">
                    <Store className="w-3.5 h-3.5" />
                    <span>Phản hồi từ người bán:</span>
                  </span>
                  <p className="text-gray-700 leading-relaxed font-normal">{r.reply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
