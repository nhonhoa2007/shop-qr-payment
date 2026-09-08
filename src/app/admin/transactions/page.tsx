import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { TransactionManager } from './transaction-manager';

export const dynamic = 'force-dynamic';

export default async function AdminTransactionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const transactions = await prisma.transaction.findMany({
    include: {
      order: {
        select: {
          id: true,
          orderCode: true,
          customerName: true,
          customerPhone: true,
          customerEmail: true,
          totalAmount: true,
          status: true,
          paymentStatus: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <TransactionManager
        initialTransactions={JSON.parse(JSON.stringify(transactions))}
      />
    </div>
  );
}
