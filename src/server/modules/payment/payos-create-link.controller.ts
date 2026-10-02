import { NextResponse } from 'next/server';
import { prisma } from '@server/database/prisma';
import { createPayOSPaymentLink, parsePayOSOrderCode } from '@server/modules/payment/payos.service';

interface CreatePayOSLinkBody {
  orderId?: unknown;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreatePayOSLinkBody;
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';

    if (!orderId) {
      return NextResponse.json({ error: 'Thiếu mã đơn hàng' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      return NextResponse.json({ error: 'Không tìm thấy đơn hàng' }, { status: 404 });
    }

    if (order.paymentStatus === 'PAID') {
      return NextResponse.json({ error: 'Đơn hàng này đã được thanh toán' }, { status: 400 });
    }

    if (order.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Đơn hàng đã bị hủy' }, { status: 400 });
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${host}`;

    const payOSOrderCode = parsePayOSOrderCode(order.orderCode);
    const returnUrl = `${baseUrl}/payment/${order.id}?payos=success`;
    const cancelUrl = `${baseUrl}/payment/${order.id}?payos=cancelled`;

    const payOSResult = await createPayOSPaymentLink({
      orderCode: payOSOrderCode,
      amount: order.totalAmount,
      description: `ShopQR ${order.orderCode}`,
      returnUrl,
      cancelUrl,
      items: order.items.map((i) => ({
        name: i.product.name,
        quantity: i.quantity,
        price: i.price,
      })),
    });

    if (!payOSResult.success) {
      return NextResponse.json(
        { error: payOSResult.error || 'Cổng thanh toán PayOS tạm thời không khả dụng' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: payOSResult,
    });
  } catch (error) {
    console.error('Create PayOS link error:', error);
    return NextResponse.json({ error: 'Lỗi khởi tạo cổng thanh toán PayOS' }, { status: 500 });
  }
}
