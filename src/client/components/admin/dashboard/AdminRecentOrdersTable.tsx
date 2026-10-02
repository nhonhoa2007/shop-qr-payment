'use client';

import React from 'react';
import Link from 'next/link';
import { formatVND } from '@shared/utils';
import { ArrowRight, Eye, Send, Check } from 'lucide-react';

export interface RecentOrderItem {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone?: string;
  itemsSummary: string;
  totalAmount: number;
  paymentStatus: string;
  status: string;
  createdAt: string;
}

export interface AdminRecentOrdersTableProps {
  orders?: RecentOrderItem[];
}

export function AdminRecentOrdersTable({ orders }: AdminRecentOrdersTableProps) {
  // 100% REAL DATA FROM DATABASE - ZERO FABRICATED ORDERS
  const displayOrders = orders && orders.length > 0 ? orders : [];

  const renderPaymentBadge = (paymentStatus: string) => {
    switch (paymentStatus.toUpperCase()) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            VietQR PAID
          </span>
        );
      case 'WALLET':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-100 text-[#5433eb] text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5433eb]" />
            Ví Shop
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Chờ thanh toán
          </span>
        );
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PROCESSING':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
            PROCESSING
          </span>
        );
      case 'PENDING':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
            PENDING
          </span>
        );
      case 'SHIPPING':
      case 'DELIVERING':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
            SHIPPING
          </span>
        );
      case 'COMPLETED':
      case 'DELIVERED':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
            COMPLETED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-slate-200/80 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">
            Đơn hàng mới nhất trong hệ thống
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Dữ liệu đơn hàng thực tế cập nhật tức thì qua WebSocket
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="text-xs font-bold text-[#5433eb] hover:underline flex items-center gap-1 shrink-0"
        >
          <span>Xem tất cả đơn hàng</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
        <table className="w-full text-left text-xs min-w-[650px]">
          <thead>
            <tr className="text-slate-400 uppercase text-[10px] font-bold border-b border-slate-100 pb-2">
              <th className="py-2.5 font-bold">Mã đơn</th>
              <th className="py-2.5 font-bold">Khách hàng</th>
              <th className="py-2.5 font-bold">Sản phẩm</th>
              <th className="py-2.5 font-bold">Tổng tiền</th>
              <th className="py-2.5 font-bold">Thanh toán</th>
              <th className="py-2.5 font-bold">Trạng thái</th>
              <th className="py-2.5 font-bold text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {displayOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                  Chưa có đơn hàng nào trong hệ thống.
                </td>
              </tr>
            ) : (
              displayOrders.map((order) => {
                const codeDisplay = order.orderCode.startsWith('#')
                  ? order.orderCode
                  : `#${order.orderCode}`;

                return (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition">
                    {/* Order Code */}
                    <td className="py-3 font-mono font-bold text-[#5433eb] whitespace-nowrap">
                      <Link
                        href={`/admin/orders?search=${encodeURIComponent(order.orderCode)}`}
                        className="hover:underline"
                      >
                        {codeDisplay}
                      </Link>
                    </td>

                    {/* Customer */}
                    <td className="py-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{order.customerName}</div>
                      {order.customerPhone && (
                        <div className="text-[11px] text-slate-400 font-mono">
                          {order.customerPhone}
                        </div>
                      )}
                    </td>

                    {/* Items Summary */}
                    <td className="py-3 text-slate-600 max-w-[220px] truncate" title={order.itemsSummary}>
                      {order.itemsSummary}
                    </td>

                    {/* Total Amount */}
                    <td className="py-3 font-bold text-slate-900 whitespace-nowrap">
                      {formatVND(order.totalAmount)}
                    </td>

                    {/* Payment Status */}
                    <td className="py-3 whitespace-nowrap">
                      {renderPaymentBadge(order.paymentStatus)}
                    </td>

                    {/* Order Status */}
                    <td className="py-3 whitespace-nowrap">
                      {renderStatusBadge(order.status)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 text-right space-x-1.5 whitespace-nowrap">
                      {order.status === 'PROCESSING' ? (
                        <Link
                          href="/admin/shipments"
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#5433eb] text-white font-bold text-[11px] hover:bg-[#4628cb] transition shadow-sm"
                        >
                          <Send className="w-3 h-3" />
                          <span>Đẩy GHN</span>
                        </Link>
                      ) : order.status === 'PENDING' ? (
                        <Link
                          href="/admin/orders"
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition shadow-sm"
                        >
                          <Check className="w-3 h-3" />
                          <span>Duyệt đơn</span>
                        </Link>
                      ) : null}

                      <Link
                        href={`/admin/orders?search=${encodeURIComponent(order.orderCode)}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-bold text-[11px] hover:bg-slate-200 transition"
                        title="Xem chi tiết đơn hàng"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Xem</span>
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
