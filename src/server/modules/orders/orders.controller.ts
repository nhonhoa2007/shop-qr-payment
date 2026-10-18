import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@server/database/prisma';
import { generateVietQRUrl, getBankInfo } from '@server/modules/payment/vietqr.service';
import { generateOrderCode } from '@shared/utils';
import { createNotification } from '@server/modules/notifications/notifications.service';
import { authOptions } from '@server/modules/auth/auth-options';
import { expireUnpaidOrders, reserveOrderStock } from '@server/modules/inventory/inventory.service';
import { normalizeEmail } from '@server/modules/auth/otp.service';
import { validateCoupon, type CouponValidationResult } from '@server/modules/admin/coupon.service';
import { calculateDiscountBigInt } from '@shared/utils/checkout';
import { checkDistributedRateLimit, getClientIp } from '@server/infrastructure/rate-limit';
import { pusherServer } from '@server/infrastructure/pusher';
import { resolveOperatorAccess } from '@server/modules/admin/guards';
import { formatNewOrderMessage, sendTelegramMessage } from '@server/infrastructure/telegram';
import { quoteShipping, QuoteError } from '@server/modules/shipping/shipping-quote.service';
import { buildOrderItemSnapshot } from '@server/modules/orders/order-item-snapshot.service';
import {
  serializeOrderDto,
  serializeMoneyVnd,
  parseMoneyVnd,
} from '@server/modules/money/money-serialization';

interface CreateOrderBody {
  items?: unknown;
  customerName?: unknown;
  customerPhone?: unknown;
  customerAddress?: unknown;
  customerEmail?: unknown;
  couponCode?: unknown;
  note?: unknown;
  toDistrictId?: unknown;
  toWardCode?: unknown;
  quotedShippingFee?: unknown;
  quotedSubtotal?: unknown;
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

    const validated = await quoteShipping(body);
    const validatedSubtotalBigInt = BigInt(validated.subtotal);
    const validatedShippingFeeBigInt = BigInt(validated.shippingFee);

    let quotedSubtotalBigInt: bigint | null = null;
    let quotedShippingFeeBigInt: bigint | null = null;
    try {
      if (body.quotedSubtotal !== undefined && body.quotedSubtotal !== null) {
        quotedSubtotalBigInt = parseMoneyVnd(body.quotedSubtotal, 'quotedSubtotal');
      }
      if (body.quotedShippingFee !== undefined && body.quotedShippingFee !== null) {
        quotedShippingFeeBigInt = parseMoneyVnd(body.quotedShippingFee, 'quotedShippingFee');
      }
    } catch {
      quotedSubtotalBigInt = null;
      quotedShippingFeeBigInt = null;
    }

    if (
      quotedSubtotalBigInt === null ||
      quotedShippingFeeBigInt === null ||
      quotedSubtotalBigInt !== validatedSubtotalBigInt ||
      quotedShippingFeeBigInt !== validatedShippingFeeBigInt
    ) {
      return NextResponse.json(
        {
          error: 'Giá hàng hoặc phí vận chuyển đã thay đổi. Vui lòng xác nhận tổng tiền mới.',
          shippingFee: serializeMoneyVnd(validatedShippingFeeBigInt),
          subtotal: serializeMoneyVnd(validatedSubtotalBigInt),
        },
        { status: 409 }
      );
    }

    // Handle Coupon discount
    let couponRecord: NonNullable<CouponValidationResult['coupon']> | null = null;
    let discountAmountBigInt = 0n;

    if (couponCodeInput) {
      const couponValidation = await validateCoupon(
        couponCodeInput,
        session?.user?.id || null,
        validatedSubtotalBigInt
      );

      if (!couponValidation.valid || !couponValidation.coupon) {
        return NextResponse.json({ error: couponValidation.error || 'Mã giảm giá không hợp lệ' }, { status: 400 });
      }

      couponRecord = couponValidation.coupon;
      discountAmountBigInt = calculateDiscountBigInt(
        couponRecord,
        validatedSubtotalBigInt,
        validatedShippingFeeBigInt
      );
    }

    const finalTotalAmountBigInt = validatedSubtotalBigInt + validatedShippingFeeBigInt - discountAmountBigInt;
    const finalTotalAmount = finalTotalAmountBigInt < 0n ? 0n : finalTotalAmountBigInt;
    const orderCode = generateOrderCode();
    const bankInfo = getBankInfo();
    const qrUrl = generateVietQRUrl({
      bankId: bankInfo.bankId,
      accountNo: bankInfo.accountNo,
      accountName: bankInfo.accountName,
      amount: Number(finalTotalAmount),
      orderId: orderCode,
    });

    const order = await prisma.$transaction(async (tx) => {
      const failedId = await reserveOrderStock(tx, validated.orderItems!);
      if (failedId) {
        throw new Error(`Sản phẩm hoặc biến thể không đủ tồn kho: ${failedId}`);
      }

      const productIds = [...new Set(validated.orderItems!.map((item) => item.productId))];
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        include: {
          variants: { where: { isActive: true } },
          categoryRef: true,
        },
      });
      const activeSources = await tx.dataSource.findMany({
        where: {
          status: 'ACTIVE',
          sourceType: { in: ['CATALOG', 'MANUFACTURER'] },
        },
      });

      const productMap = new Map(products.map((p) => [p.id, p]));
      const sourceMap = new Map<string, { id: string; version?: string | null; status: string }>();
      for (const s of activeSources) {
        if (s.payload && typeof s.payload === 'object' && 'mapping' in (s.payload as Record<string, unknown>)) {
          const mapping = (s.payload as { mapping?: { productId?: string } }).mapping;
          if (mapping && mapping.productId) {
            sourceMap.set(mapping.productId, { id: s.id, version: s.version, status: s.status });
          }
        }
      }

      const orderItemsCreate = validated.orderItems!.map((item) => {
        const prod = productMap.get(item.productId);
        const variant = item.variantId ? prod?.variants?.find((v) => v.id === item.variantId) : null;
        const activeSource = prod ? sourceMap.get(prod.id) : null;

        const snapshot = buildOrderItemSnapshot({
          product: prod ?? {
            id: item.productId,
            name: '',
            price: BigInt(item.price),
          },
          variant,
          activeSource,
          quantity: item.quantity,
        });

        return {
          productId: item.productId,
          variantId: item.variantId || null,
          variantTitle: item.variantTitle || null,
          quantity: item.quantity,
          price: BigInt(item.price),
          productName: snapshot.productName,
          sku: snapshot.sku,
          variantOptions: (snapshot.variantOptions as unknown as Prisma.InputJsonValue) ?? undefined,
          unitPrice: snapshot.unitPrice,
          warrantySnapshot: (snapshot.warrantySnapshot as unknown as Prisma.InputJsonValue) ?? undefined,
          packingLineSnapshot: (snapshot.packingLineSnapshot as unknown as Prisma.InputJsonValue) ?? undefined,
          schemaRevision: snapshot.schemaRevision,
          sourceRevision: snapshot.sourceRevision,
          returnedQuantity: 0,
        };
      });

      const createdOrder = await tx.order.create({
        data: {
          orderCode,
          userId: session?.user?.id || null,
          customerName,
          customerPhone,
          customerAddress,
          toDistrictId: validated.toDistrictId,
          toWardCode: validated.toWardCode,
          customerEmail: customerEmail ? normalizeEmail(customerEmail) : null,
          subtotal: validatedSubtotalBigInt,
          shippingFee: validatedShippingFeeBigInt,
          discountAmount: discountAmountBigInt,
          couponId: couponRecord?.id || null,
          couponCode: couponRecord?.code || null,
          totalAmount: finalTotalAmount,
          packingSnapshot: (validated.packingSnapshot as unknown as Prisma.InputJsonValue) ?? undefined,
          packingRevision: validated.packingRevision || null,
          qrContent: qrUrl,
          note: note || null,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          items: {
            create: orderItemsCreate,
          },
        },
        include: { items: { include: { product: true, variant: true } } },
      });

      if (couponRecord) {
        const claimed = await tx.coupon.updateMany({
          where: { id: couponRecord.id, isActive: true, usedCount: { lt: (await tx.coupon.findUniqueOrThrow({ where: { id: couponRecord.id }, select: { usageLimit: true } })).usageLimit } },
          data: { usedCount: { increment: 1 } },
        });
        if (claimed.count !== 1) throw new Error('Mã giảm giá đã hết lượt sử dụng');

        if (session?.user?.id) {
          const usageCount = await tx.couponUsage.count({ where: { couponId: couponRecord.id, userId: session.user.id } });
          if (usageCount >= couponRecord.perUserLimit) throw new Error('Bạn đã sử dụng hết lượt mã giảm giá này');
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

    // Bắn thông báo Telegram cho Admin (non-blocking)
    try {
      const telegramPayload = formatNewOrderMessage({
        orderCode,
        customerName,
        customerPhone,
        customerAddress,
        subtotal: Number(validatedSubtotalBigInt),
        shippingFee: Number(validatedShippingFeeBigInt),
        discountAmount: Number(discountAmountBigInt),
        couponCode: couponRecord?.code || null,
        totalAmount: Number(finalTotalAmount),
        items: validated.orderItems!.map((item) => ({
          name: item.variantTitle || 'Sản phẩm',
          quantity: item.quantity,
          price: Number(item.price),
          variantTitle: item.variantTitle ?? undefined,
        })),
      });
      void sendTelegramMessage(telegramPayload).catch((err) => {
        console.error('[Orders] Telegram notification error:', err);
      });
    } catch (telegramErr) {
      console.error('[Orders] Telegram format error:', telegramErr);
    }

    return NextResponse.json({
      orderId: order.id,
      orderCode,
      qrUrl,
      subtotal: serializeMoneyVnd(validatedSubtotalBigInt),
      shippingFee: serializeMoneyVnd(validatedShippingFeeBigInt),
      discountAmount: serializeMoneyVnd(discountAmountBigInt),
      totalAmount: serializeMoneyVnd(finalTotalAmount),
      expiresAt: order.expiresAt,
      bankInfo: {
        bankName: bankInfo.displayName,
        accountNo: bankInfo.accountNo,
        accountName: bankInfo.accountName,
      },
    });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Lỗi tạo đơn hàng' }, { status: error instanceof QuoteError ? error.status : 500 });
  }
}

export async function GET() {
  try {
    await expireUnpaidOrders(prisma);

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isOperator = resolveOperatorAccess(session.user, 'orders');
    const where = isOperator ? {} : { userId: session.user.id };
    const orders = await prisma.order.findMany({
      where,
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ orders: orders.map(serializeOrderDto) });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
