import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CouponManager } from './coupon-manager';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminCouponsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-blue-600 transition mb-3"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Quay lại Dashboard Quản trị</span>
        </Link>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">🏷️ Quản trị Mã giảm giá & Ưu đãi</h1>
      </div>

      <CouponManager />
    </div>
  );
}
