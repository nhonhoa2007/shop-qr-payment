import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { QRPayment } from '@/components/payment/QRPayment';
import { getBankInfo } from '@/lib/vietqr';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const session = await getServerSession(authOptions);

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) notFound();

  const bankInfo = getBankInfo();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <QRPayment
        orderId={order.id}
        orderCode={order.orderCode}
        qrUrl={order.qrContent || ''}
        totalAmount={order.totalAmount}
        expiresAt={order.expiresAt.toISOString()}
        bankInfo={{
          bankName: bankInfo.displayName,
          accountNo: bankInfo.accountNo,
          accountName: bankInfo.accountName,
        }}
        userId={session?.user?.id}
      />
    </div>
  );
}
