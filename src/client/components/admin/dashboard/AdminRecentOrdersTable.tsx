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

const AVATAR_COLORS = [
  '#2f54eb',
  '#0e7490',
  '#7c3aed',
  '#b45309',
  '#15803d',
  '#be123c',
  '#0891b2',
  '#4f46e5',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'KH';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase();
}

function getAvatarColor(name: string): string {
  let s = 0;
  for (let i = 0; i < name.length; i++) {
    s += name.charCodeAt(i);
  }
  return AVATAR_COLORS[s % AVATAR_COLORS.length];
}

export function AdminRecentOrdersTable({ orders }: AdminRecentOrdersTableProps) {
  const displayOrders = orders && orders.length > 0 ? orders : [];

  const renderPaymentBadge = (paymentStatus: string) => {
    switch (paymentStatus.toUpperCase()) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            VietQR PAID
          </span>
        );
      case 'WALLET':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Ví Shop
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
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
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-[#2f54eb]">
            ĐANG XỬ LÝ
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700">
            CHỜ XÁC NHẬN
          </span>
        );
      case 'SHIPPING':
      case 'DELIVERING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700">
            ĐANG GIAO
          </span>
        );
      case 'COMPLETED':
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700">
            HOÀN THÀNH
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700">
            ĐÃ HỦY
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/90 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
            Đơn hàng mới nhất trong hệ thống
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Dữ liệu giao dịch được cập nhật tự động theo thời gian thực
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="text-xs font-bold text-[#2f54eb] hover:underline flex items-center gap-1 shrink-0"
        >
          <span>Xem tất cả đơn hàng</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Bảng dữ liệu phong cách Aurora Console */}
      <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
        <table className="w-full text-left text-xs min-w-[700px]">
          <thead>
            <tr className="text-slate-400 uppercase text-[11px] font-bold border-b border-slate-100 tracking-wider">
              <th className="py-3 font-bold">Mã đơn</th>
              <th className="py-3 font-bold">Khách hàng</th>
              <th className="py-3 font-bold">Sản phẩm</th>
              <th className="py-3 font-bold text-right">Tổng tiền</th>
              <th className="py-3 font-bold text-center">Thanh toán</th>
              <th className="py-3 font-bold text-center">Trạng thái</th>
              <th className="py-3 font-bold text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {displayOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                  Chưa có đơn hàng nào trong hệ thống.
                </td>
              </tr>
            ) : (
              displayOrders.map((order) => {
                const codeDisplay = order.orderCode.startsWith('#')
                  ? order.orderCode
                  : `#${order.orderCode}`;

                const initials = getInitials(order.customerName);
                const avatarColor = getAvatarColor(order.customerName);

                return (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Order Code */}
                    <td className="py-3 font-mono font-bold text-[#2f54eb] whitespace-nowrap">
                      <Link
                        href={`/admin/orders?search=${encodeURIComponent(order.orderCode)}`}
                        className="hover:underline"
                      >
                        {codeDisplay}
                      </Link>
                    </td>

                    {/* Customer với Initial Avatar */}
                    <td className="py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-7 h-7 rounded-full text-white font-bold text-[11px] flex items-center justify-center shrink-0 tracking-wide"
                          style={{ backgroundColor: avatarColor }}
                        >
                          {initials}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900 leading-tight">
                            {order.customerName}
                          </div>
                          {order.customerPhone && (
                            <div className="text-[11px] text-slate-400 font-mono">
                              {order.customerPhone}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Items Summary */}
                    <td className="py-3 text-slate-600 max-w-[220px] truncate" title={order.itemsSummary}>
                      {order.itemsSummary}
                    </td>

                    {/* Total Amount */}
                    <td className="py-3 font-mono font-bold text-slate-900 text-right whitespace-nowrap">
                      {formatVND(order.totalAmount)}
                    </td>

                    {/* Payment Status */}
                    <td className="py-3 text-center whitespace-nowrap">
                      {renderPaymentBadge(order.paymentStatus)}
                    </td>

                    {/* Order Status */}
                    <td className="py-3 text-center whitespace-nowrap">
                      {renderStatusBadge(order.status)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 text-right space-x-1.5 whitespace-nowrap">
                      {order.status === 'PROCESSING' ? (
                        <Link
                          href="/admin/shipments"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2f54eb] text-white font-bold text-[11px] hover:bg-[#1d39c4] transition shadow-xs"
                        >
                          <Send className="w-3 h-3" />
                          <span>Đẩy GHN</span>
                        </Link>
                      ) : order.status === 'PENDING' ? (
                        <Link
                          href="/admin/orders"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition shadow-xs"
                        >
                          <Check className="w-3 h-3" />
                          <span>Duyệt đơn</span>
                        </Link>
                      ) : (
                        <Link
                          href="/admin/orders"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px] hover:bg-slate-200 transition"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Chi tiết</span>
                        </Link>
                      )}
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
