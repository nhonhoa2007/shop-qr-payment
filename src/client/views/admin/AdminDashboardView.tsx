'use client';

import Link from 'next/link';
import { AnalyticsDashboard } from '@/client/components/admin/AnalyticsDashboard';
import {
  LayoutDashboard,
  Package,
  Truck,
  CreditCard,
  ShoppingBag,
  Tag,
  Star,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';

export function AdminDashboardView() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Bảng điều khiển Quản trị
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Tổng quan báo cáo doanh thu, sản phẩm và thống kê đơn hàng real-time
            </p>
          </div>
        </div>
      </div>

      <AnalyticsDashboard />

      <h2 className="text-xl font-bold text-slate-900 mb-4 mt-8">Thao tác nghiệp vụ & Quản lý</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <Link
          href="/admin/orders"
          className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 hover:shadow-md hover:border-indigo-200 transition-all text-center group"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3 text-blue-600 group-hover:scale-110 transition-transform">
            <Package className="w-6 h-6" />
          </div>
          <p className="font-semibold text-slate-900">Quản lý đơn hàng</p>
          <p className="text-xs text-slate-500 mt-1">Duyệt đơn, cập nhật tiến độ giao nhận</p>
        </Link>

        <Link
          href="/admin/shipments"
          className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 hover:shadow-md hover:border-indigo-200 transition-all text-center group"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-3 text-amber-600 group-hover:scale-110 transition-transform">
            <Truck className="w-6 h-6" />
          </div>
          <p className="font-semibold text-slate-900">Vận đơn GHN</p>
          <p className="text-xs text-slate-500 mt-1">Hành trình giao nhận, mã tracking OpenAPI v2</p>
        </Link>

        <Link
          href="/admin/transactions"
          className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 hover:shadow-md hover:border-indigo-200 transition-all text-center group"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-3 text-emerald-600 group-hover:scale-110 transition-transform">
            <CreditCard className="w-6 h-6" />
          </div>
          <p className="font-semibold text-slate-900">Đối soát giao dịch</p>
          <p className="text-xs text-slate-500 mt-1">Khớp tiền VietQR, kiểm tra webhook ngân hàng</p>
        </Link>

        <Link
          href="/admin/products"
          className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 hover:shadow-md hover:border-indigo-200 transition-all text-center group"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-3 text-purple-600 group-hover:scale-110 transition-transform">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <p className="font-semibold text-slate-900">Quản lý sản phẩm</p>
          <p className="text-xs text-slate-500 mt-1">Thêm mới, sửa giá, kho hàng, danh mục</p>
        </Link>

        <Link
          href="/admin/coupons"
          className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 hover:shadow-md hover:border-indigo-200 transition-all text-center group"
        >
          <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center mx-auto mb-3 text-rose-600 group-hover:scale-110 transition-transform">
            <Tag className="w-6 h-6" />
          </div>
          <p className="font-semibold text-slate-900">Mã giảm giá (Coupon)</p>
          <p className="text-xs text-slate-500 mt-1">Tạo voucher, bật/tắt, freeship, chiết khấu</p>
        </Link>

        <Link
          href="/admin/reviews"
          className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 hover:shadow-md hover:border-indigo-200 transition-all text-center group"
        >
          <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center mx-auto mb-3 text-yellow-600 group-hover:scale-110 transition-transform">
            <Star className="w-6 h-6" />
          </div>
          <p className="font-semibold text-slate-900">Kiểm duyệt đánh giá</p>
          <p className="text-xs text-slate-500 mt-1">Duyệt/ẩn nhận xét, phản hồi khách hàng</p>
        </Link>

        <Link
          href="/admin/customers"
          className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 hover:shadow-md hover:border-indigo-200 transition-all text-center group"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto mb-3 text-indigo-600 group-hover:scale-110 transition-transform">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <p className="font-semibold text-slate-900">Người dùng & Phân quyền</p>
          <p className="text-xs text-slate-500 mt-1">Phân quyền vai trò (Admin/Staff/User), khóa/mở tài khoản</p>
        </Link>

        <Link
          href="/admin/chat"
          className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 hover:shadow-md hover:border-indigo-200 transition-all text-center group"
        >
          <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center mx-auto mb-3 text-sky-600 group-hover:scale-110 transition-transform">
            <MessageSquare className="w-6 h-6" />
          </div>
          <p className="font-semibold text-slate-900">Chat với khách hàng</p>
          <p className="text-xs text-slate-500 mt-1">Hỗ trợ tư vấn, giải đáp thắc mắc đơn hàng</p>
        </Link>
      </div>
    </div>
  );
}

export default AdminDashboardView;
