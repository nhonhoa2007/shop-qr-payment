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

    const users = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        orders: {
          select: {
            id: true,
            orderCode: true,
            totalAmount: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const customers = users.map((u) => {
      const paidOrders = u.orders.filter((o) => o.paymentStatus === 'PAID');
      const totalSpent = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        address: u.address,
        avatar: u.avatar,
        isVerified: u.isVerified,
        createdAt: u.createdAt,
        orderCount: u.orders.length,
        paidOrderCount: paidOrders.length,
        totalSpent,
        recentOrders: u.orders.slice(0, 3),
      };
    });

    return NextResponse.json({ customers });
  } catch (error: unknown) {
    console.error('Fetch customers error:', error);
    return NextResponse.json({ error: 'Lỗi tải danh sách khách hàng' }, { status: 500 });
  }
}
