'use client';

import { useState } from 'react';
import { formatVND, formatDateTime, getStatusLabel, getStatusColor } from '@shared/utils';
import { toast } from 'sonner';
import Link from 'next/link';
import { Coins, Check, User, Phone, Mail, MapPin, FileText } from 'lucide-react';

export interface AdminOrder {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  note?: string;
  createdAt: string;
  items: {
    id: string;
    quantity: number;
    price: number;
    product: { name: string; image?: string };
  }[];
}

export function AdminOrdersView({ initialOrders }: { initialOrders: AdminOrder[] }) {
  const [orders, setOrders] = useState<AdminOrder[]>(initialOrders);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPayment, setFilterPayment] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleUpdate = async (orderId: string, payload: { status?: string; paymentStatus?: string }) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...payload } : o))
      );
      toast.success('Đã cập nhật trạng thái đơn hàng!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi cập nhật');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filterStatus !== 'ALL' && o.status !== filterStatus) return false;
    if (filterPayment !== 'ALL' && o.paymentStatus !== filterPayment) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCode = o.orderCode.toLowerCase().includes(q);
      const matchName = o.customerName.toLowerCase().includes(q);
      const matchPhone = o.customerPhone.toLowerCase().includes(q);
      if (!matchCode && !matchName && !matchPhone) return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">
              Admin
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-sm font-medium">Đơn hàng</span>
          </div>
          <h1 className="text-2xl font-bold">Quản lý đơn hàng</h1>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Tìm theo mã đơn, tên, SĐT..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none w-56"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="ALL">Tất cả tiến độ</option>
            <option value="PENDING">Chờ thanh toán</option>
            <option value="CONFIRMED">Đã xác nhận</option>
            <option value="PROCESSING">Đang xử lý</option>
            <option value="SHIPPING">Đang giao</option>
            <option value="COMPLETED">Hoàn thành</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>

          <select
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="ALL">Tất cả thanh toán</option>
            <option value="UNPAID">Chưa thanh toán</option>
            <option value="PAID">Đã thanh toán</option>
            <option value="EXPIRED">Hết hạn</option>
            <option value="REFUNDED">Hoàn tiền</option>
          </select>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100">
            Không có đơn hàng nào phù hợp với bộ lọc
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 transition hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-lg text-gray-900">{order.orderCode}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(order.paymentStatus)}`}>
                      {getStatusLabel(order.paymentStatus)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Ngày đặt: {formatDateTime(order.createdAt)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xl font-bold text-blue-600">
                    {formatVND(order.totalAmount)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {order.items.reduce((s, i) => s + i.quantity, 0)} món hàng
                  </p>
                </div>
              </div>

              {/* Customer and Items */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-gray-800">Thông tin người nhận:</p>
                  <p className="text-gray-600 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{order.customerName}</span>
                    <span className="text-slate-300">•</span>
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{order.customerPhone}</span>
                  </p>
                  {order.customerEmail && (
                    <p className="text-gray-600 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{order.customerEmail}</span>
                    </p>
                  )}
                  <p className="text-gray-600 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{order.customerAddress}</span>
                  </p>
                  {order.note && (
                    <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg mt-2 flex items-start gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>Ghi chú: {order.note}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="font-semibold text-sm text-gray-800">Chi tiết sản phẩm:</p>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-2">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-xs py-1 border-b border-gray-50">
                        <span className="text-gray-700 truncate max-w-[240px]">
                          {item.product.name} × {item.quantity}
                        </span>
                        <span className="font-medium text-gray-900">
                          {formatVND(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons for Admin */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100 bg-gray-50/50 -mx-6 -mb-6 p-4 rounded-b-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">Chuyển tiến độ:</span>
                  <button
                    type="button"
                    disabled={updatingId === order.id}
                    onClick={() => handleUpdate(order.id, { status: 'CONFIRMED' })}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-medium transition"
                  >
                    Xác nhận
                  </button>
                  <button
                    type="button"
                    disabled={updatingId === order.id}
                    onClick={() => handleUpdate(order.id, { status: 'SHIPPING' })}
                    className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-medium transition"
                  >
                    Đang giao
                  </button>
                  <button
                    type="button"
                    disabled={updatingId === order.id}
                    onClick={() => handleUpdate(order.id, { status: 'COMPLETED' })}
                    className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-xs font-medium transition"
                  >
                    Hoàn tất
                  </button>
                  <button
                    type="button"
                    disabled={updatingId === order.id}
                    onClick={() => handleUpdate(order.id, { status: 'CANCELLED' })}
                    className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-medium transition"
                  >
                    Hủy đơn
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {order.paymentStatus !== 'PAID' ? (
                    <button
                      type="button"
                      disabled={updatingId === order.id}
                      onClick={() => handleUpdate(order.id, { paymentStatus: 'PAID', status: 'CONFIRMED' })}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>Xác nhận đã nhận tiền</span>
                    </button>
                  ) : (
                    <span className="text-xs text-green-700 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Đã thanh toán đầy đủ</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export { AdminOrdersView as AdminOrderManager, AdminOrdersView as default };
