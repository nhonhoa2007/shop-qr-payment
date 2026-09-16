'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, MessageSquare, Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  reply: string | null;
  createdAt: string;
  user: {
    name: string | null;
    image: string | null;
  };
}

export function ProductReviews({ productId }: { productId: string }) {
  const { data: session } = useSession();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Review Form state
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');

  const refreshReviews = useCallback(() => {
    fetch(`/api/products/${productId}/reviews`)
      .then((res) => res.json())
      .then((data) => {
        if (data.reviews) setReviews(data.reviews);
      })
      .catch((err) => console.error('Fetch reviews error:', err));
  }, [productId]);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/products/${productId}/reviews`)
      .then((res) => res.json())
      .then((data) => {
        if (!ignore && data.reviews) {
          setReviews(data.reviews);
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

    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          comment: comment.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gửi đánh giá không thành công');
      }

      toast.success('Cảm ơn bạn đã đánh giá sản phẩm!');
      setComment('');
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
    <div className="space-y-8 mt-12 pt-8 border-t border-gray-100">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-blue-600" />
            <span>Đánh giá & Nhận xét từ khách hàng</span>
          </h3>
          <p className="text-sm text-gray-500 mt-1">Trải nghiệm thực tế từ người mua đã thanh toán đơn hàng</p>
        </div>

        {reviews.length > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 px-4 py-2 rounded-2xl border border-amber-200">
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
      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
        <h4 className="font-bold text-gray-900 text-base mb-3">Chia sẻ cảm nhận của bạn về sản phẩm</h4>
        {session?.user ? (
          <form onSubmit={handleSubmitReview} className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Chấm điểm:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 text-amber-400 hover:scale-110 transition"
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
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !comment.trim()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-sm disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Đang gửi...' : 'Gửi nhận xét'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="text-sm text-gray-500">
            Vui lòng <a href="/login" className="text-blue-600 font-semibold underline">đăng nhập</a> tài khoản đã mua sản phẩm này để gửi đánh giá.
          </div>
        )}
      </div>

      {/* Danh sách các đánh giá */}
      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Đang tải đánh giá...</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
          <Star className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="font-medium text-gray-700">Chưa có đánh giá nào cho sản phẩm này</p>
          <p className="text-xs text-gray-400 mt-1">Hãy là người đầu tiên mua và chia sẻ trải nghiệm nhé!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
                    {r.user.name ? r.user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{r.user.name || 'Khách hàng'}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <span className="flex items-center gap-0.5 text-emerald-600 font-medium">
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

              {r.comment && <p className="text-gray-700 text-sm leading-relaxed">{r.comment}</p>}

              {r.reply && (
                <div className="bg-gray-50 border-l-4 border-blue-600 p-3 rounded-r-xl mt-3 text-xs">
                  <span className="font-bold text-blue-900 block mb-1">Phản hồi từ người bán:</span>
                  <p className="text-gray-600">{r.reply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
