import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { prisma } from '@server/database/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const verifiedParam = searchParams.get('verified');

    const statusFilter =
      verifiedParam === 'true'
        ? { status: 'APPLIED_ORDER' as const }
        : verifiedParam === 'false'
        ? { status: 'PENDING_REVIEW' as const }
        : { status: { in: ['APPLIED_ORDER' as const, 'PENDING_REVIEW' as const] } };

    const bankTransfers = await prisma.bankTransfer.findMany({
      where: {
        ...statusFilter,
        ...(search
          ? {
              OR: [
                { bankTransId: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                {
                  order: {
                    OR: [
                      { orderCode: { contains: search, mode: 'insensitive' } },
                      { customerName: { contains: search, mode: 'insensitive' } },
                      { customerPhone: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              ],
            }
          : {}),
      },
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
      take: 100,
    });

    const transactions = bankTransfers.map((b: any) => ({
      id: b.id,
      orderId: b.orderId,
      bankTransId: b.bankTransId,
      amount: b.amount,
      description: b.description,
      bankName: b.bankName,
      senderAccount: b.senderAccount ?? null,
      receivedAt: b.receivedAt,
      verified: b.status === 'APPLIED_ORDER',
      order: b.order,
      createdAt: b.createdAt,
    }));

    return NextResponse.json({ transactions });
  } catch (error: unknown) {
    console.error('Fetch transactions error:', error);
    return NextResponse.json({ error: 'Lỗi tải danh sách giao dịch' }, { status: 500 });
  }
}
