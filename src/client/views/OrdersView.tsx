'use client';

import { formatVND, formatDateTime, getStatusLabel, getStatusColor } from '@/lib/utils';
import Link from 'next/link';
import { Package } from 'lucide-react';

export interface SerializedOrderItem {
  id: string;
  quantity: number;
  price: number;
  product: {
    name: string;
  };
}

export interface SerializedOrder {
  id: string;
  orderCode: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  items: SerializedOrderItem[];
}

export interface OrdersViewProps {
  orders: SerializedOrder[];
}

export function OrdersView({ orders }: OrdersViewProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Đơn hàng của tôi</h1>
      {orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Package className="w-8 h-8 stroke-[1.5]" />
          </div>
          <p className="font-semibold text-slate-700 mb-1">Chưa có đơn hàng nào</p>
          <Link href="/" className="text-blue-600 hover:underline">
            Mua sắm ngay
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-bold text-lg">{order.orderCode}</h3>
                  <p className="text-sm text-gray-500">{formatDateTime(order.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.paymentStatus)}`}>
                    {getStatusLabel(order.paymentStatus)}
                  </span>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {item.product.name} x{item.quantity}
                    </span>
                    <span>{formatVND(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center border-t pt-4">
                <span className="font-bold text-lg text-blue-600">{formatVND(order.totalAmount)}</span>
                {order.paymentStatus === 'UNPAID' && (
                  <Link
                    href={`/payment/${order.id}`}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                  >
                    Thanh toán
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default OrdersView;
