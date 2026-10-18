import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { redirect } from 'next/navigation';
import { prisma } from '@server/database/prisma';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Hồ sơ bảo hành của tôi | Shop QR',
};

export default async function CustomerWarrantiesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/warranties');
  }

  const claims = await (prisma as any).warrantyClaim.findMany({
    where: { customerId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      order: {
        select: {
          orderCode: true,
          status: true,
        },
      },
      orderItem: {
        select: {
          productName: true,
          quantity: true,
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bảo hành thiết bị</h1>
          <p className="text-sm text-slate-500">Tra cứu và theo dõi tiến độ xử lý bảo hành sản phẩm của bạn.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {claims.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <ShieldCheck className="h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-base font-semibold text-slate-800">Bạn chưa có yêu cầu bảo hành nào</h3>
            <p className="mt-1 text-sm text-slate-500">
              Bạn có thể tạo yêu cầu bảo hành từ chi tiết các đơn hàng đã hoàn tất.
            </p>
            <Link
              href="/orders"
              className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Xem danh sách đơn hàng
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {claims.map((claim: any) => (
              <div key={claim.id} className="p-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-blue-600">{claim.claimNumber}</span>
                  <span className="inline-flex rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                    {claim.status}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {claim.orderItem?.productName || 'Sản phẩm'} - Đơn hàng: #{claim.order?.orderCode}
                </p>
                <p className="mt-1 text-xs text-slate-500">Lỗi mô tả: {claim.issueDescription}</p>
                <div className="mt-3 text-xs text-slate-400">
                  Ngày gửi: {new Date(claim.createdAt).toLocaleDateString('vi-VN')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
