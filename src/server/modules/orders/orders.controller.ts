import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@server/database/prisma';
import { generateVietQRUrl, getBankInfo } from '@server/modules/payment/vietqr.service';
import { generateOrderCode } from '@shared/utils';
import { createNotification } from '@server/modules/notifications/notifications.service';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { parseOrderItems, buildValidatedOrderItems } from '@/lib/order-validation';
import { expireUnpaidOrders, reserveOrderStock } from '@server/modules/inventory/inventory.service';
import { normalizeEmail } from '@/lib/otp';
import { validateCoupon } from '@/lib/coupon';
import { calculateDiscount } from '@/lib/checkout';
import { checkDistributedRateLimit, getClientIp } from '@server/infrastructure/rate-limit';
import { pusherServer } from '@server/infrastructure/pusher';

interface CreateOrderBody {
  items?: unknown;
  customerName?: unknown;
  customerPhone?: unknown;
  customerAddress?: unknown;
  customerEmail?: unknown;
  couponCode?: unknown;
  note?: unknown;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    const rateLimit = await checkDistributedRateLimit(`order:${clientIp}`, 10, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Bạn đang thao tác quá nhanh. Vui lòng thử lại sau 1 phút.' },
        { status: 429 }
      );
    }

    const session = await getServerSession(authOptions);
    const body = (await req.json()) as CreateOrderBody;
    const customerName = normalizeText(body.customerName);
    const customerPhone = normalizeText(body.customerPhone);
    const customerAddress = normalizeText(body.customerAddress);
    const customerEmail = normalizeText(body.customerEmail);
    const couponCodeInput = normalizeText(body.couponCode);
    const note = normalizeText(body.note);

    if (!customerName || !customerPhone || !customerAddress) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ thông tin' }, { status: 400 });
    }

    const parsed = parseOrderItems(body.items);
    if (parsed.error || !parsed.items) {
      return NextResponse.json({ error: parsed.error || 'Dữ liệu giỏ hàng không hợp lệ' }, { status: 400 });
    }

    const productIds = [...new Set(parsed.items.map((item) => item.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        variants: {
          where: { isActive: true },
        },
      },
    });
    const validated = buildValidatedOrderItems(parsed.items, products);
    if (validated.error || !validated.orderItems || validated.totalAmount === undefined) {
      return NextResponse.json({ error: validated.error || 'Dữ liệu giỏ hàng không hợp lệ' }, { status: 400 });
    }

    // Handle Coupon discount
    let couponRecord: { id: string; code: string; discountType: string; discountValue: number; maxDiscount: number | null; minOrderAmount: number } | null = null;
    let discountAmount = 0;

    if (couponCodeInput) {
      const couponValidation = await validateCoupon(
        couponCodeInput,
        session?.user?.id || null,
        validated.subtotal!
      );

      if (!couponValidation.valid || !couponValidation.coupon) {
        return NextResponse.json({ error: couponValidation.error || 'Mã giảm giá không hợp lệ' }, { status: 400 });
      }

      couponRecord = couponValidation.coupon;
      discountAmount = calculateDiscount(
        couponRecord,
        validated.subtotal!,
        validated.shippingFee!
      );
    }

    const finalTotalAmount = Math.max(0, validated.subtotal! + validated.shippingFee! - discountAmount);
    const orderCode = generateOrderCode();
    const bankInfo = getBankInfo();
    const qrUrl = generateVietQRUrl({
      bankId: bankInfo.bankId,
      accountNo: bankInfo.accountNo,
      accountName: bankInfo.accountName,
      amount: finalTotalAmount,
      orderId: orderCode,
    });

    const order = await prisma.$transaction(async (tx) => {
      const failedId = await reserveOrderStock(tx, validated.orderItems!);
      if (failedId) {
        throw new Error(`Sản phẩm hoặc biến thể không đủ tồn kho: ${failedId}`);
      }

      const createdOrder = await tx.order.create({
        data: {
          orderCode,
          userId: session?.user?.id || null,
          customerName,
          customerPhone,
          customerAddress,
          customerEmail: customerEmail ? normalizeEmail(customerEmail) : null,
          subtotal: validated.subtotal!,
          shippingFee: validated.shippingFee!,
          discountAmount,
          couponId: couponRecord?.id || null,
          couponCode: couponRecord?.code || null,
          totalAmount: finalTotalAmount,
          qrContent: qrUrl,
          note: note || null,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          items: {
            create: validated.orderItems!.map((item) => ({
              productId: item.productId,
              variantId: item.variantId || null,
              variantTitle: item.variantTitle || null,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
        include: { items: { include: { product: true, variant: true } } },
      });

      if (couponRecord) {
        await tx.coupon.update({
          where: { id: couponRecord.id },
          data: { usedCount: { increment: 1 } },
        });

        if (session?.user?.id) {
          await tx.couponUsage.create({
            data: {
              couponId: couponRecord.id,
              userId: session.user.id,
              orderId: createdOrder.id,
            },
          });
        }
      }

      return createdOrder;
    });

    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });

    if (session?.user?.id) {
      if (admins.length > 0) {
        const chatRoom = await prisma.chatRoom.create({
          data: {
            orderId: order.id,
            participants: {
              create: [{ userId: session.user.id }, ...admins.map((admin) => ({ userId: admin.id }))],
            },
          },
        });

        await prisma.message.create({
          data: {
            roomId: chatRoom.id,
            senderId: admins[0].id,
            content: `Đơn hàng ${orderCode} đã được tạo. Bạn có thể chat với shop tại đây!`,
            type: 'SYSTEM',
          },
        });
      }

      await createNotification({
        userId: session.user.id,
        type: 'ORDER_CREATED',
        title: 'Đơn hàng đã tạo',
        message: `Đơn hàng ${orderCode} - Vui lòng thanh toán trong 15 phút`,
        data: { orderId: order.id, orderCode },
      });
    }

    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        type: 'ORDER_CREATED',
        title: `Đơn hàng mới: ${orderCode}`,
        message: `${customerName} - ${finalTotalAmount.toLocaleString('vi-VN')}đ`,
        data: { orderId: order.id, orderCode },
      });
    }

    try {
      await pusherServer.trigger('private-admin-channel', 'analytics-updated', {
        type: 'ORDER_CREATED',
        timestamp: Date.now(),
      });
    } catch (pusherErr) {
      console.error('[Orders] Pusher admin trigger error:', pusherErr);
    }

    return NextResponse.json({
      orderId: order.id,
      orderCode,
      qrUrl,
      subtotal: validated.subtotal,
      shippingFee: validated.shippingFee,
      discountAmount,
      totalAmount: finalTotalAmount,
      expiresAt: order.expiresAt,
      bankInfo: {
        bankName: bankInfo.displayName,
        accountNo: bankInfo.accountNo,
        accountName: bankInfo.accountName,
      },
    });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Lỗi tạo đơn hàng' }, { status: 500 });
  }
}

export async function GET() {
  try {
    await expireUnpaidOrders(prisma);

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const where = session.user.role === 'ADMIN' ? {} : { userId: session.user.id };
    const orders = await prisma.order.findMany({
      where,
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
