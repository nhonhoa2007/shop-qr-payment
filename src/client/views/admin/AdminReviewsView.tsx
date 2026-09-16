'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Star,
  MessageSquare,
  Trash2,
  Search,
  Eye,
  EyeOff,
  CornerDownRight,
  Send,
  Loader2,
  CheckCircle,
} from 'lucide-react';

export interface AdminReviewItem {
  id: string;
  productId: string;
  userId: string;
  orderId: string | null;
  rating: number;
  comment: string | null;
  images: string[];
  reply: string | null;
  isApproved: boolean;
  createdAt: string;
  product: {
    id: string;
    name: string;
    image: string | null;
    price: number;
  };
  user: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
}

export function ReviewManager({ initialReviews }: { initialReviews: AdminReviewItem[] }) {
  const [reviews, setReviews] = useState<AdminReviewItem[]>(initialReviews);
  const [search, setSearch] = useState('');
  const [filterRating, setFilterRating] = useState<string>('ALL');
  const [filterApproved, setFilterApproved] = useState<'ALL' | 'APPROVED' | 'HIDDEN'>('ALL');
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filtered = reviews.filter((r) => {
    if (filterApproved === 'APPROVED' && !r.isApproved) return false;
    if (filterApproved === 'HIDDEN' && r.isApproved) return false;
    if (filterRating !== 'ALL' && r.rating !== Number(filterRating)) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchComment = r.comment?.toLowerCase().includes(q);
      const matchReply = r.reply?.toLowerCase().includes(q);
      const matchProduct = r.product.name.toLowerCase().includes(q);
      const matchUser = r.user.name?.toLowerCase().includes(q) || r.user.email.toLowerCase().includes(q);
      if (!matchComment && !matchReply && !matchProduct && !matchUser) return false;
    }
    return true;
  });

  const handleToggleApprove = async (review: AdminReviewItem) => {
    setActionLoading(review.id);
    const newStatus = !review.isApproved;
    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: review.id, isApproved: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setReviews((prev) =>
        prev.map((r) => (r.id === review.id ? { ...r, isApproved: newStatus } : r))
      );
      toast.success(newStatus ? 'Đã hiển thị đánh giá' : 'Đã ẩn đánh giá khỏi trang sản phẩm');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi cập nhật');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenReply = (review: AdminReviewItem) => {
    setReplyingId(review.id);
    setReplyText(review.reply || '');
  };

  const handleSaveReply = async (reviewId: string) => {
    setActionLoading(reviewId);
    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reviewId, reply: replyText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, reply: replyText } : r))
      );
      toast.success('Đã lưu phản hồi cho khách hàng!');
      setReplyingId(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi gửi phản hồi');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa vĩnh viễn đánh giá này?')) return;
    setActionLoading(reviewId);
    try {
      const res = await fetch(`/api/admin/reviews?id=${reviewId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      toast.success('Đã xóa đánh giá thành công');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi xóa');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">
              Admin
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-sm font-medium">Đánh giá</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Star className="w-7 h-7 text-amber-500 fill-amber-500" />
            Kiểm duyệt Đánh giá & Bình luận
          </h1>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tổng số nhận xét</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">{reviews.length}</h3>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Đang hiển thị công khai</p>
          <h3 className="text-2xl font-bold text-green-600 mt-1">
            {reviews.filter((r) => r.isApproved).length}
          </h3>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Đã phản hồi từ Shop</p>
          <h3 className="text-2xl font-bold text-blue-600 mt-1">
            {reviews.filter((r) => !!r.reply).length}
          </h3>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm bình luận, sản phẩm, khách hàng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="ALL">Tất cả đánh giá</option>
            <option value="5">5 Sao (Xuất sắc)</option>
            <option value="4">4 Sao (Tốt)</option>
            <option value="3">3 Sao (Bình thường)</option>
            <option value="2">2 Sao (Chưa hài lòng)</option>
            <option value="1">1 Sao (Kém)</option>
          </select>

          <select
            value={filterApproved}
            onChange={(e) => setFilterApproved(e.target.value as 'ALL' | 'APPROVED' | 'HIDDEN')}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="APPROVED">Đang hiển thị</option>
            <option value="HIDDEN">Đang ẩn (Cần duyệt)</option>
          </select>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-12 text-gray-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-600">Không tìm thấy đánh giá nào</p>
          </div>
        ) : (
          filtered.map((review) => (
            <div
              key={review.id}
              className={`bg-white rounded-2xl border p-5 shadow-sm transition ${
                review.isApproved ? 'border-gray-100' : 'border-amber-200 bg-amber-50/20'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2">
                  {/* User & Rating */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
                      {review.user.name?.[0]?.toUpperCase() || review.user.email[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm">
                          {review.user.name || review.user.email}
                        </span>
                        <span className="text-xs text-gray-400">({review.user.email})</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3.5 h-3.5 ${
                              star <= review.rating
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-gray-200 fill-gray-200'
                            }`}
                          />
                        ))}
                        <span className="text-xs text-gray-400 ml-2">
                          {formatDateTime(review.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Product Tag */}
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-700">
                    <span className="font-medium text-gray-500">Sản phẩm:</span>
                    <Link
                      href={`/products/${review.product.id}`}
                      target="_blank"
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      {review.product.name}
                    </Link>
                  </div>

                  {/* Comment */}
                  <p className="text-gray-800 text-sm leading-relaxed mt-2">
                    {review.comment || <span className="italic text-gray-400">Khách không để lại bình luận chữ</span>}
                  </p>

                  {/* Images */}
                  {review.images && review.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {review.images.map((img, idx) => (
                        <div key={idx} className="relative w-16 h-16 rounded-xl border border-gray-200 overflow-hidden">
                          <Image
                            src={img}
                            alt="Review attachment"
                            fill
                            sizes="64px"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Shop Reply Section */}
                  {review.reply && replyingId !== review.id && (
                    <div className="mt-3 pl-4 border-l-2 border-blue-500 bg-blue-50/40 p-3 rounded-r-xl">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800 mb-1">
                        <CornerDownRight className="w-3.5 h-3.5" />
                        Phản hồi từ Shop:
                      </div>
                      <p className="text-xs text-gray-700">{review.reply}</p>
                    </div>
                  )}

                  {/* Reply Form if active */}
                  {replyingId === review.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Nội dung phản hồi của Shop:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Nhập lời cảm ơn hoặc giải đáp thắc mắc..."
                          className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <button
                          onClick={() => handleSaveReply(review.id)}
                          disabled={actionLoading === review.id}
                          className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition"
                        >
                          {actionLoading === review.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          Gửi
                        </button>
                        <button
                          onClick={() => setReplyingId(null)}
                          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-medium transition"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                  {/* Status Badge */}
                  {review.isApproved ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Hiển thị
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                      <EyeOff className="w-3.5 h-3.5" />
                      Đang ẩn
                    </span>
                  )}

                  {/* Toggle Approve Button */}
                  <button
                    onClick={() => handleToggleApprove(review)}
                    disabled={actionLoading === review.id}
                    title={review.isApproved ? 'Ẩn đánh giá này' : 'Duyệt hiển thị đánh giá này'}
                    className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    {review.isApproved ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                        Ẩn đi
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-green-600" />
                        Duyệt
                      </>
                    )}
                  </button>

                  {/* Reply Button */}
                  {replyingId !== review.id && (
                    <button
                      onClick={() => handleOpenReply(review)}
                      className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs font-medium text-blue-600 hover:bg-blue-50 transition"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {review.reply ? 'Sửa phản hồi' : 'Trả lời'}
                    </button>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDelete(review.id)}
                    disabled={actionLoading === review.id}
                    title="Xóa đánh giá"
                    className="flex items-center gap-1 px-2 py-1.5 text-gray-400 hover:text-red-600 rounded-xl text-xs font-medium hover:bg-red-50 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
