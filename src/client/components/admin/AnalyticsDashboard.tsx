'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { formatVND } from '@/lib/utils';
import { Users, Package, ShoppingCart, TrendingUp, AlertTriangle } from 'lucide-react';

interface TopProduct {
  productId: string;
  name: string;
  price: number;
  image: string | null;
  totalSold: number;
}

interface AnalyticsData {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    totalPaidOrders: number;
    lowStockCount: number;
    totalCustomers: number;
  };
  ordersByStatus: Record<string, number>;
  topProducts: TopProduct[];
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then((res) => res.json())
      .then((d) => {
        if (!d.error) setData(d);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-32 bg-gray-100 rounded-2xl w-full"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl"></div>)}
      </div>
    </div>;
  }

  if (!data || !data.summary) return null;

  const { summary, ordersByStatus, topProducts } = data;

  return (
    <div className="space-y-6 mb-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Doanh thu thực tế (Đã thu)</p>
            <h3 className="text-2xl font-bold text-gray-900">{formatVND(summary.totalRevenue)}</h3>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Tổng số đơn hàng</p>
            <h3 className="text-2xl font-bold text-gray-900">
              {summary.totalOrders} <span className="text-sm font-normal text-gray-400">({summary.totalPaidOrders} đã thanh toán)</span>
            </h3>
          </div>
        </div>

        {/* Total Customers */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Tổng khách hàng</p>
            <h3 className="text-2xl font-bold text-gray-900">{summary.totalCustomers}</h3>
          </div>
        </div>

        {/* Low Stock Warning */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Cảnh báo tồn kho thấp</p>
            <h3 className="text-2xl font-bold text-amber-600">
              {summary.lowStockCount} <span className="text-sm font-normal text-gray-500">sản phẩm</span>
            </h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-gray-400" /> Top sản phẩm bán chạy
          </h3>
          <div className="space-y-4">
            {topProducts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Chưa có dữ liệu</p>
            ) : (
              topProducts.map((p, idx) => (
                <div key={p.productId} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl transition">
                  <span className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-600 font-bold rounded-full text-xs shrink-0">
                    {idx + 1}
                  </span>
                  <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0 relative">
                    {p.image ? (
                      <Image src={p.image} alt={p.name} fill sizes="40px" className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-50">
                        <Package className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">{formatVND(p.price)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-600">Đã bán {p.totalSold}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-lg text-gray-900 mb-4">Trạng thái đơn hàng</h3>
          <div className="space-y-3">
            <StatusRow label="Chờ thanh toán (PENDING)" count={ordersByStatus['PENDING'] || 0} color="bg-gray-100" />
            <StatusRow label="Đã xác nhận (CONFIRMED)" count={ordersByStatus['CONFIRMED'] || 0} color="bg-blue-100" />
            <StatusRow label="Đang xử lý (PROCESSING)" count={ordersByStatus['PROCESSING'] || 0} color="bg-indigo-100" />
            <StatusRow label="Đang giao (SHIPPING)" count={ordersByStatus['SHIPPING'] || 0} color="bg-amber-100" />
            <StatusRow label="Đã hoàn thành (COMPLETED)" count={ordersByStatus['COMPLETED'] || 0} color="bg-emerald-100" />
            <StatusRow label="Đã hủy (CANCELLED)" count={ordersByStatus['CANCELLED'] || 0} color="bg-red-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition border border-transparent hover:border-gray-100">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${color}`}></div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <span className="text-sm font-bold bg-gray-100 px-3 py-1 rounded-full text-gray-600">{count}</span>
    </div>
  );
}
