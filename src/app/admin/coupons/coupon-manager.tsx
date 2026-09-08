'use client';

import { useState, useEffect } from 'react';
import { formatVND } from '@/lib/utils';
import { Tag, Plus, Trash2, Calendar, Percent, DollarSign, Truck } from 'lucide-react';
import { toast } from 'sonner';

interface CouponItem {
  id: string;
  code: string;
  description: string | null;
  discountType: 'FIXED' | 'PERCENTAGE' | 'FREE_SHIPPING';
  discountValue: number;
  maxDiscount: number | null;
  minOrderAmount: number;
  usageLimit: number | null;
  usedCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  _count?: {
    userUsages: number;
  };
}

function getDefaultFormData() {
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    code: '',
    description: '',
    discountType: 'FIXED' as 'FIXED' | 'PERCENTAGE' | 'FREE_SHIPPING',
    discountValue: 20000,
    maxDiscount: '',
    minOrderAmount: 0,
    usageLimit: 100,
    perUserLimit: 1,
    startDate: now.toISOString().split('T')[0],
    endDate: nextMonth.toISOString().split('T')[0],
  };
}

export function CouponManager() {
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState(getDefaultFormData);

  useEffect(() => {
    let ignore = false;
    fetch('/api/admin/coupons')
      .then((res) => res.json())
      .then((data) => {
        if (!ignore && data.coupons) {
          setCoupons(data.coupons);
        }
      })
      .catch(() => {
        if (!ignore) toast.error('Lỗi khi tải danh sách voucher');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      toast.error('Vui lòng nhập mã coupon');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          maxDiscount: formData.maxDiscount ? Number(formData.maxDiscount) : null,
          discountValue: Number(formData.discountValue),
          minOrderAmount: Number(formData.minOrderAmount),
          usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
          perUserLimit: Number(formData.perUserLimit),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Tạo coupon thất bại');
      }

      toast.success('Đã tạo mã giảm giá thành công!');
      setShowCreateModal(false);
      setFormData(getDefaultFormData());
      setCoupons((prev) => [data, ...prev]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tạo coupon');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !currentStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCoupons((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isActive: !currentStatus } : c))
      );
      toast.success(!currentStatus ? 'Đã kích hoạt mã ưu đãi!' : 'Đã tạm dừng mã ưu đãi!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi cập nhật');
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa mã "${code}"?`)) return;

    try {
      const res = await fetch(`/api/admin/coupons?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể xóa coupon');

      if (data.softDeactivated) {
        toast.info(data.message);
        setCoupons((prev) =>
          prev.map((c) => (c.id === id ? { ...c, isActive: false } : c))
        );
      } else {
        toast.success(`Đã xóa mã "${code}"`);
        setCoupons((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi xóa voucher');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-600" />
            <span>Danh sách Mã khuyến mại & Voucher</span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">Cấu hình các chương trình ưu đãi, giảm giá và miễn phí vận chuyển</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo mã mới</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100">
          Đang tải danh sách voucher...
        </div>
      ) : coupons.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-700">Chưa có mã giảm giá nào</p>
          <p className="text-sm text-gray-500 mt-1">Hãy bấm nút &quot;Tạo mã mới&quot; để phát hành mã ưu đãi cho khách hàng.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-100">
                <tr>
                  <th className="py-3.5 px-4">Mã Code</th>
                  <th className="py-3.5 px-4">Loại giảm giá</th>
                  <th className="py-3.5 px-4">Mức giảm</th>
                  <th className="py-3.5 px-4">Đơn tối thiểu</th>
                  <th className="py-3.5 px-4">Đã dùng / Giới hạn</th>
                  <th className="py-3.5 px-4">Hiệu lực</th>
                  <th className="py-3.5 px-4 text-center">Trạng thái</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {coupons.map((c) => {
                  const isExpired = new Date(c.endDate) < new Date();
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-4 px-4">
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                          {c.code}
                        </span>
                        {c.description && <p className="text-xs text-gray-500 mt-1">{c.description}</p>}
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {c.discountType === 'FIXED' && <DollarSign className="w-3.5 h-3.5 text-emerald-600" />}
                          {c.discountType === 'PERCENTAGE' && <Percent className="w-3.5 h-3.5 text-amber-600" />}
                          {c.discountType === 'FREE_SHIPPING' && <Truck className="w-3.5 h-3.5 text-blue-600" />}
                          {c.discountType}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-semibold text-gray-900">
                        {c.discountType === 'FIXED' && formatVND(c.discountValue)}
                        {c.discountType === 'PERCENTAGE' && `${c.discountValue}%`}
                        {c.discountType === 'FREE_SHIPPING' && 'Free ship 100%'}
                        {c.maxDiscount && (
                          <span className="block text-xs font-normal text-gray-500 mt-0.5">
                            (Tối đa: {formatVND(c.maxDiscount)})
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        {c.minOrderAmount > 0 ? formatVND(c.minOrderAmount) : 'Không yêu cầu'}
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-semibold text-gray-900">{c.usedCount}</span>
                        <span className="text-gray-400"> / {c.usageLimit || '∞'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>{new Date(c.startDate).toLocaleDateString('vi-VN')} - {new Date(c.endDate).toLocaleDateString('vi-VN')}</span>
                        </div>
                        {isExpired && (
                          <span className="inline-block text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded mt-1">
                            Đã hết hạn
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleToggleActive(c.id, c.isActive)}
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                            c.isActive
                              ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200'
                          }`}
                          title="Bấm để Bật / Tắt voucher"
                        >
                          {c.isActive ? 'Đang bật' : 'Tạm dừng'}
                        </button>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => handleDelete(c.id, c.code)}
                          className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition"
                          title="Xóa voucher"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Tạo Mã Giảm Giá */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl animate-scale-up">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5 text-blue-600" />
              <span>Phát hành Mã Voucher Mới</span>
            </h3>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Mã Coupon *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: CHAOHAY20"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl uppercase font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Mô tả ưu đãi</label>
                <input
                  type="text"
                  placeholder="VD: Giảm 20k cho đơn từ 100k"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Loại giảm giá</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value as 'FIXED' | 'PERCENTAGE' | 'FREE_SHIPPING' })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="FIXED">Tiền cố định (VND)</option>
                    <option value="PERCENTAGE">Phần trăm (%)</option>
                    <option value="FREE_SHIPPING">Miễn phí vận chuyển</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    {formData.discountType === 'PERCENTAGE' ? 'Tỉ lệ giảm (%)' : 'Số tiền giảm (VND)'}
                  </label>
                  <input
                    type="number"
                    disabled={formData.discountType === 'FREE_SHIPPING'}
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-100"
                  />
                </div>
              </div>

              {formData.discountType === 'PERCENTAGE' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Giảm tối đa (VND - để trống nếu không giới hạn)</label>
                  <input
                    type="number"
                    placeholder="VD: 50000"
                    value={formData.maxDiscount}
                    onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Đơn tối thiểu (VND)</label>
                  <input
                    type="number"
                    value={formData.minOrderAmount}
                    onChange={(e) => setFormData({ ...formData, minOrderAmount: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Số lượt dùng tối đa</label>
                  <input
                    type="number"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({ ...formData, usageLimit: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Ngày bắt đầu</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Ngày kết thúc</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition disabled:opacity-50"
                >
                  {creating ? 'Đang tạo...' : 'Tạo voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
