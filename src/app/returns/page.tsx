import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { redirect } from 'next/navigation';
import { prisma } from '@server/database/prisma';
import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Yêu cầu đổi trả của tôi | Shop QR',
};

export default async function CustomerReturnsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/returns');
  }

  const returns = await (prisma as any).returnRequest.findMany({
    where: { customerId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      order: {
        select: {
          orderCode: true,
          status: true,
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Đổi trả sản phẩm</h1>
          <p className="text-sm text-slate-500">Theo dõi trạng thái đổi trả và hoàn tiền của bạn.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {returns.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <RotateCcw className="h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-base font-semibold text-slate-800">Bạn chưa có yêu cầu đổi trả nào</h3>
            <p className="mt-1 text-sm text-slate-500">
              Bạn có thể tạo yêu cầu đổi trả một phần hoặc toàn bộ từ đơn hàng đã nhận.
            </p>
            <Link
              href="/orders"
              className="mt-4 inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Xem danh sách đơn hàng
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {returns.map((ret: any) => (
              <div key={ret.id} className="p-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-emerald-600">{ret.returnNumber}</span>
                  <span className="inline-flex rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                    {ret.status}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  Đơn hàng: #{ret.order?.orderCode} - Mặt hàng trả: {ret.items?.length || 0}
                </p>
                <p className="mt-1 text-xs text-slate-500">Lý do: {ret.reason}</p>
                {ret.disposition && (
                  <p className="mt-1 text-xs text-purple-600">Kiểm định: {ret.disposition}</p>
                )}
                <div className="mt-3 text-xs text-slate-400">
                  Ngày gửi: {new Date(ret.createdAt).toLocaleDateString('vi-VN')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
