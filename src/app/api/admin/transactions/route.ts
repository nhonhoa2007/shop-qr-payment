import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

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

    const transactions = await prisma.transaction.findMany({
      where: {
        ...(verifiedParam === 'true' ? { verified: true } : {}),
        ...(verifiedParam === 'false' ? { verified: false } : {}),
        ...(search
          ? {
              OR: [
                { bankTransId: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { senderAccount: { contains: search, mode: 'insensitive' } },
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
    });

    return NextResponse.json({ transactions });
  } catch (error: unknown) {
    console.error('Fetch transactions error:', error);
    return NextResponse.json({ error: 'Lỗi tải danh sách giao dịch' }, { status: 500 });
  }
}
