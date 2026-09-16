import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { payOrderWithWallet } from '@/lib/wallet';
import { pusherServer } from '@/lib/pusher-server';
import { createNotification } from '@/lib/notifications';

interface PayWithWalletBody {
  orderId?: unknown;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Vui lòng đăng nhập để thanh toán bằng ví' }, { status: 401 });
    }

    const body = (await req.json()) as PayWithWalletBody;
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';

    if (!orderId) {
      return NextResponse.json({ error: 'Thiếu mã định danh đơn hàng' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      return await payOrderWithWallet(tx, session.user.id, orderId);
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Thanh toán thất bại' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { orderCode: true, totalAmount: true },
    });

    if (order) {
      // Bắn sự kiện realtime cho trang thanh toán QR
      await pusherServer.trigger(`private-user-${session.user.id}`, 'payment-success', {
        orderId,
        orderCode: order.orderCode,
        amount: result.paidAmount,
      });

      // Bắn sự kiện cập nhật số dư ví realtime
      await pusherServer.trigger(`private-user-${session.user.id}`, 'wallet-updated', {
        balance: result.newBalance,
      });

      // Tạo thông báo xác nhận thanh toán
      await createNotification({
        userId: session.user.id,
        type: 'PAYMENT_RECEIVED',
        title: 'Thanh toán ví thành công',
        message: `Đơn hàng ${order.orderCode} đã được thanh toán thành công bằng Ví Shop.`,
        data: { orderId, orderCode: order.orderCode, amount: result.paidAmount },
      });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Pay with wallet error:', error);
    return NextResponse.json({ error: 'Lỗi thực thi thanh toán qua ví' }, { status: 500 });
  }
}
