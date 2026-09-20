import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@server/database/prisma';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import type { ShipmentStatus } from '@/types';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    const shipments = await prisma.shipment.findMany({
      where: {
        ...(status ? { status: status as ShipmentStatus } : {}),
        ...(search
          ? {
              OR: [
                { trackingCode: { contains: search, mode: 'insensitive' } },
                { order: { orderCode: { contains: search, mode: 'insensitive' } } },
                { order: { customerName: { contains: search, mode: 'insensitive' } } },
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
            customerAddress: true,
            totalAmount: true,
            status: true,
            paymentStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      shipments,
    });
  } catch (error) {
    console.error('Get shipments error:', error);
    return NextResponse.json({ error: 'Lỗi lấy danh sách vận đơn' }, { status: 500 });
  }
}
