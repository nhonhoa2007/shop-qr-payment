'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Package,
  Truck,
  Copy,
  Check,
  ExternalLink,
  Calendar,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  MapPin,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  formatVND,
  formatDateTime,
  formatDate,
  getStatusLabel,
  getStatusColor,
  getShipmentStatusLabel,
  getShipmentStatusColor,
} from '@shared/utils';
import type {
  SerializedOrder,
  SerializedOrderItem,
  SerializedShipment,
  SerializedShipmentLog,
} from '@shared/types';
import { pusherClient } from '@/lib/pusher-client';

export type {
  SerializedOrder,
  SerializedOrderItem,
  SerializedShipment,
  SerializedShipmentLog,
};

export interface OrdersViewProps {
  orders: SerializedOrder[];
  currentUserId?: string;
}

export function OrdersView({ orders: initialOrders, currentUserId }: OrdersViewProps) {
  const [orders, setOrders] = useState<SerializedOrder[]>(initialOrders);
  const [cancellingOrder, setCancellingOrder] = useState<SerializedOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedRoutes, setExpandedRoutes] = useState<Record<string, boolean>>({});

  // Lắng nghe sự kiện cập nhật trạng thái đơn hàng thời gian thực qua Pusher
  useEffect(() => {
    if (!currentUserId) return;

    const channel = pusherClient.subscribe(`private-user-${currentUserId}`);

    channel.bind('order-status-changed', (data: { orderId: string; status: string }) => {
      if (data?.orderId && data?.status) {
        setOrders((prev) =>
          prev.map((o) => (o.id === data.orderId ? { ...o, status: data.status } : o))
        );
      }
    });

    return () => {
      pusherClient.unsubscribe(`private-user-${currentUserId}`);
    };
  }, [currentUserId]);

  // Cập nhật khi initialOrders thay đổi từ server
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrders(initialOrders);
  }, [initialOrders]);

  // Sao chép mã vận đơn GHN
  const handleCopyCode = async (trackingCode: string) => {
    try {
      await navigator.clipboard.writeText(trackingCode);
      setCopiedCode(trackingCode);
      toast.success(`Đã sao chép mã vận đơn: ${trackingCode}`);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      toast.error('Không thể sao chép mã vận đơn');
    }
  };

  // Đóng/Mở accordion lộ trình bưu phẩm
  const toggleRoute = (orderId: string) => {
    setExpandedRoutes((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // Xử lý hủy đơn hàng an toàn qua PATCH /api/orders/[id]
  const handleConfirmCancel = async () => {
    if (!cancellingOrder || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${cancellingOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi hủy đơn hàng');
      }

      // Cập nhật trạng thái tức thời trên UI
      setOrders((prev) =>
        prev.map((o) => (o.id === cancellingOrder.id ? { ...o, status: 'CANCELLED' } : o))
      );

      toast.success(`Đã hủy thành công đơn hàng ${cancellingOrder.orderCode}`);
      setCancellingOrder(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra khi hủy đơn hàng');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Tiêu đề trang */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Đơn hàng của tôi</h1>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi chi tiết các đơn đặt hàng, lộ trình vận chuyển GHN và quản lý trạng thái
          </p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Package className="w-8 h-8 stroke-[1.5]" />
          </div>
          <p className="font-semibold text-slate-700 mb-1">Chưa có đơn hàng nào</p>
          <p className="text-xs text-slate-400 mb-4">Các sản phẩm bạn đặt mua sẽ hiển thị tại đây</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition shadow-sm shadow-blue-200"
          >
            Mua sắm ngay
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const hasShipment = Boolean(order.shipment);
            const isPending = order.status === 'PENDING';
            const isUnpaid = order.paymentStatus === 'UNPAID';

            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
              >
                {/* Header đơn hàng */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-100">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-400">Mã đơn:</span>
                      <h3 className="font-bold text-base text-slate-900 font-mono tracking-tight">
                        {order.orderCode}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatDateTime(order.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {getStatusLabel(order.status)}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        order.paymentStatus
                      )}`}
                    >
                      {getStatusLabel(order.paymentStatus)}
                    </span>
                  </div>
                </div>

                {/* Danh sách sản phẩm trong đơn */}
                <div className="space-y-3 mb-5">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-sm py-2 px-3 rounded-2xl bg-slate-50/70 hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/60 flex items-center justify-center text-slate-400 shrink-0 overflow-hidden relative">
                          {item.product.image ? (
                            <Image
                              src={item.product.image}
                              alt={item.product.name}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : (
                            <Package className="w-5 h-5 stroke-[1.5]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 text-xs sm:text-sm truncate">
                            {item.product.name}
                          </p>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            {item.variantTitle && (
                              <span className="text-slate-600 bg-slate-200/60 px-1.5 py-0.5 rounded">
                                {item.variantTitle}
                              </span>
                            )}
                            <span>Số lượng: {item.quantity}</span>
                          </div>
                        </div>
                      </div>
                      <span className="font-semibold text-slate-700 text-xs sm:text-sm shrink-0 ml-2">
                        {formatVND(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Khối hiển thị thông tin Vận đơn GHN & Lộ trình giao hàng trực tiếp */}
                {hasShipment && order.shipment && (
                  <div className="mb-5 rounded-2xl bg-gradient-to-br from-amber-50/60 via-orange-50/30 to-slate-50/60 border border-amber-200/70 p-4 sm:p-5">
                    {/* Header Vận đơn */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200/50">
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-sm shrink-0">
                          <Truck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-slate-900">
                              Giao Hàng Nhanh (GHN)
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getShipmentStatusColor(
                                order.shipment.status
                              )}`}
                            >
                              {getShipmentStatusLabel(order.shipment.status)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500">Mã vận đơn:</span>
                            <code className="px-2 py-0.5 bg-white border border-slate-200/80 rounded-lg font-mono font-bold text-xs text-slate-900 select-all">
                              {order.shipment.trackingCode}
                            </code>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(order.shipment!.trackingCode)}
                              className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-white px-2 py-0.5 rounded-lg border border-transparent hover:border-slate-200 transition cursor-pointer"
                              title="Sao chép mã vận đơn"
                            >
                              {copiedCode === order.shipment.trackingCode ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-600 font-medium">Đã chép</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Sao chép</span>
                                </>
                              )}
                            </button>
                            <a
                              href={`https://donhang.ghn.vn/?order_code=${order.shipment.trackingCode}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline hover:text-blue-700 font-medium"
                              title="Xem trực tiếp trên cổng tra cứu GHN"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Tra cứu GHN</span>
                            </a>
                          </div>
                        </div>
                      </div>

                      {order.shipment.estimatedArrival && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white/90 px-3 py-1.5 rounded-xl border border-amber-200/60 self-start sm:self-center shadow-xs">
                          <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>
                            Dự kiến giao: <strong>{formatDate(order.shipment.estimatedArrival)}</strong>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Lộ trình giao hàng trực tiếp (Shipping Logs Timeline) */}
                    <div className="mt-3.5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                          <MapPin className="w-3.5 h-3.5 text-orange-500" />
                          <span>Lộ trình giao hàng trực tiếp</span>
                        </div>
                        {order.shipment.shippingLogs && order.shipment.shippingLogs.length > 2 && (
                          <button
                            type="button"
                            onClick={() => toggleRoute(order.id)}
                            className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 font-medium transition cursor-pointer"
                          >
                            <span>
                              {expandedRoutes[order.id] ? 'Thu gọn' : `Xem toàn bộ (${order.shipment.shippingLogs.length} mốc)`}
                            </span>
                            {expandedRoutes[order.id] ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>

                      {order.shipment.shippingLogs && order.shipment.shippingLogs.length > 0 ? (
                        <div className="relative pl-6 space-y-3.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-amber-200">
                          {(expandedRoutes[order.id]
                            ? order.shipment.shippingLogs
                            : order.shipment.shippingLogs.slice(-3)
                          ).map((log, idx, arr) => {
                            const isLatest = idx === arr.length - 1;
                            return (
                              <div key={idx} className="relative group">
                                <div
                                  className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full transition-transform ${
                                    isLatest
                                      ? 'bg-orange-500 ring-4 ring-orange-200'
                                      : 'bg-slate-300'
                                  }`}
                                />
                                <div className="text-xs font-semibold text-slate-900">
                                  {log.description || log.status}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>{log.timestamp ? formatDateTime(log.timestamp) : ''}</span>
                                  {log.location && <span className="text-slate-400">• {log.location}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic bg-white/70 p-3 rounded-xl border border-amber-100/80">
                          Vận đơn đã được khởi tạo tự động qua GHN OpenAPI v2. Đang chờ bưu tá GHN cập nhật lộ trình di chuyển.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Chú thích thông minh nếu chưa tạo vận đơn GHN */}
                {!hasShipment && (order.status === 'PENDING' || order.status === 'CONFIRMED') && (
                  <div className="mb-4 text-[11px] text-slate-400 flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl">
                    <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      Mã vận đơn GHN và lộ trình giao hàng sẽ tự động cập nhật khi đơn hàng chuyển sang trạng thái <strong>Đang xử lý</strong>.
                    </span>
                  </div>
                )}

                {/* Footer đơn hàng: Tổng tiền & Các nút hành động */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
                  <div>
                    <span className="text-xs text-slate-400 block mb-0.5">Tổng tiền thanh toán</span>
                    <span className="font-bold text-xl text-blue-600 tracking-tight">
                      {formatVND(order.totalAmount)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Nút Hủy đơn an toàn: Chỉ hiển thị khi đơn ở trạng thái PENDING */}
                    {isPending && (
                      <button
                        type="button"
                        onClick={() => setCancellingOrder(order)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-rose-200 text-rose-600 bg-white hover:bg-rose-50 hover:border-rose-300 active:bg-rose-100 transition shadow-xs cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Hủy đơn</span>
                      </button>
                    )}

                    {/* Nút Thanh toán: Chỉ hiển thị khi đơn UNPAID và ở trạng thái PENDING */}
                    {isUnpaid && isPending && (
                      <Link
                        href={`/payment/${order.id}`}
                        className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs cursor-pointer"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Thanh toán</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Hủy đơn an toàn (Safe Order Cancellation Modal) */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-6 h-6 stroke-[1.8]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 text-lg">Xác nhận hủy đơn hàng</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mã đơn:{' '}
                  <span className="font-mono font-semibold text-slate-800">
                    {cancellingOrder.orderCode}
                  </span>
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 text-xs text-slate-600 space-y-2 border border-slate-100">
              <p>
                Bạn có chắc chắn muốn hủy đơn hàng này không? Sau khi xác nhận hủy, đơn hàng sẽ không thể khôi phục lại.
              </p>
              {cancellingOrder.paymentStatus === 'PAID' ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl text-xs font-medium">
                  💰 Đơn hàng đã được thanh toán. Toàn bộ số tiền{' '}
                  <strong>{formatVND(cancellingOrder.totalAmount)}</strong> sẽ được hoàn trả 100% vào Ví Shop ngay sau khi hủy.
                </div>
              ) : (
                <p className="text-slate-500">
                  Tồn kho của sản phẩm và mã giảm giá đã áp dụng sẽ được tự động hoàn lại cho hệ thống.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setCancellingOrder(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                Không, giữ lại
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmCancel}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm shadow-rose-200 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang hủy...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>Xác nhận hủy đơn</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrdersView;
