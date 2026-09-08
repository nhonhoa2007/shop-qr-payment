import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">🛠️ Bảng điều khiển Quản trị</h1>
          <p className="text-gray-500 text-sm mt-1">Tổng quan báo cáo doanh thu, sản phẩm và thống kê đơn hàng real-time</p>
        </div>
      </div>

      <AnalyticsDashboard />

      <h2 className="text-xl font-bold text-gray-900 mb-4">Thao tác nghiệp vụ & Quản lý</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <Link href="/admin/orders" className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition text-center group">
          <span className="text-3xl inline-block group-hover:scale-110 transition-transform">📦</span>
          <p className="font-semibold text-gray-900 mt-2">Quản lý đơn hàng</p>
          <p className="text-xs text-gray-500 mt-1">Duyệt đơn, cập nhật tiến độ giao nhận</p>
        </Link>
        <Link href="/admin/transactions" className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition text-center group">
          <span className="text-3xl inline-block group-hover:scale-110 transition-transform">💳</span>
          <p className="font-semibold text-gray-900 mt-2">Đối soát giao dịch</p>
          <p className="text-xs text-gray-500 mt-1">Khớp tiền VietQR, kiểm tra webhook ngân hàng</p>
        </Link>
        <Link href="/admin/products" className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition text-center group">
          <span className="text-3xl inline-block group-hover:scale-110 transition-transform">🛒</span>
          <p className="font-semibold text-gray-900 mt-2">Quản lý sản phẩm</p>
          <p className="text-xs text-gray-500 mt-1">Thêm mới, sửa giá, kho hàng, danh mục</p>
        </Link>
        <Link href="/admin/coupons" className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition text-center group">
          <span className="text-3xl inline-block group-hover:scale-110 transition-transform">🏷️</span>
          <p className="font-semibold text-gray-900 mt-2">Mã giảm giá (Coupon)</p>
          <p className="text-xs text-gray-500 mt-1">Tạo voucher, bật/tắt, freeship, chiết khấu</p>
        </Link>
        <Link href="/admin/reviews" className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition text-center group">
          <span className="text-3xl inline-block group-hover:scale-110 transition-transform">⭐</span>
          <p className="font-semibold text-gray-900 mt-2">Kiểm duyệt đánh giá</p>
          <p className="text-xs text-gray-500 mt-1">Duyệt/ẩn nhận xét, phản hồi khách hàng</p>
        </Link>
        <Link href="/admin/customers" className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition text-center group">
          <span className="text-3xl inline-block group-hover:scale-110 transition-transform">👥</span>
          <p className="font-semibold text-gray-900 mt-2">Quản lý khách hàng</p>
          <p className="text-xs text-gray-500 mt-1">Danh sách thành viên, lịch sử chi tiêu</p>
        </Link>
        <Link href="/chat" className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition text-center group">
          <span className="text-3xl inline-block group-hover:scale-110 transition-transform">💬</span>
          <p className="font-semibold text-gray-900 mt-2">Chat với khách hàng</p>
          <p className="text-xs text-gray-500 mt-1">Hỗ trợ tư vấn, giải đáp thắc mắc đơn hàng</p>
        </Link>
      </div>
    </div>
  );
}
