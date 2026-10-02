import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PaymentView } from '@client/views/PaymentView';
import { CustomerOrderService } from '@/server/modules/orders/customer-orders.service';
import { getBankInfo } from '@/lib/vietqr';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const session = await getServerSession(authOptions);

  const order = await CustomerOrderService.getOrderForPayment(orderId);
  if (!order) notFound();

  const bankInfo = getBankInfo();

  return (
    <PaymentView
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
      initialPaymentStatus={
        order.paymentStatus === 'PAID'
          ? 'paid'
          : order.paymentStatus === 'EXPIRED'
          ? 'expired'
          : 'waiting'
      }
    />
  );
}
