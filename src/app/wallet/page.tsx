import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { getWalletDetails } from '@/lib/wallet';
import { WalletView } from '@client/views/WalletView';
import type { Metadata } from 'next';
import type { WalletTransaction } from '@/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ví Shop QR - Trung tâm Số dư & Hoàn tiền',
  description: 'Quản lý số dư ví nội bộ, lịch sử hoàn tiền và thanh toán nhanh 1-chạm',
};

export default async function WalletPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/wallet');
  }

  const wallet = await getWalletDetails(session.user.id);

  const serializedWallet = {
    id: wallet.id,
    userId: session.user.id,
    balance: wallet.balance,
    createdAt: new Date().toISOString(),
    updatedAt: wallet.updatedAt.toISOString(),
    transactions: wallet.transactions.map((t) => ({
      id: t.id,
      walletId: t.walletId,
      amount: t.amount,
      type: t.type,
      orderId: t.orderId,
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    })) as WalletTransaction[],
  };

  return (
    <WalletView
      initialWallet={serializedWallet}
      userName={session.user.name || 'Khách hàng'}
      userId={session.user.id}
    />
  );
}
