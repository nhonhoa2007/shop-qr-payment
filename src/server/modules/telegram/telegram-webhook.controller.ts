import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@server/database/prisma';
import { approveAndFulfillOrder } from '@server/modules/orders/order-fulfillment.service';
import {
  answerCallbackQuery,
  editTelegramMessage,
  formatApprovedOrderMessage,
} from '@server/infrastructure/telegram';

interface TelegramUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    message?: {
      message_id: number;
      chat: {
        id: number | string;
        title?: string;
        type: string;
      };
      text?: string;
    };
    data?: string;
  };
}

function safeCompareSecret(provided: string, expected: string): boolean {
  const bufA = Buffer.from(provided);
  const bufB = Buffer.from(expected);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: Request) {
  try {
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expectedSecret) {
      const providedSecret = req.headers.get('x-telegram-bot-api-secret-token');
      if (!providedSecret || !safeCompareSecret(providedSecret, expectedSecret)) {
        return NextResponse.json(
          { error: 'Unauthorized: secret token mismatch' },
          { status: 401 }
        );
      }
    }

    const update = (await req.json()) as TelegramUpdate;
    const callback = update.callback_query;

    if (!callback) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const data = callback.data || '';
    if (!data.startsWith('approve_order:')) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Xác thực người bấm callback (chỉ cho phép ADMIN / Chat ID được cấu hình - Fail Closed)
    const fromId = String(callback.from?.id || '');
    const chatId = String(callback.message?.chat?.id || '');
    const configuredChatId = String(process.env.TELEGRAM_CHAT_ID || '').trim();

    const isAuthorized =
      Boolean(configuredChatId) && (fromId === configuredChatId || chatId === configuredChatId);

    if (!isAuthorized) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Bạn không có quyền thực hiện thao tác duyệt đơn này!',
        showAlert: true,
      });
      return NextResponse.json({ ok: false, error: 'Unauthorized user' }, { status: 200 });
    }

    const orderId = data.slice('approve_order:'.length).trim();
    if (!orderId) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Lỗi: Không tìm thấy mã đơn hàng cần duyệt.',
        showAlert: true,
      });
      return NextResponse.json({ ok: false, error: 'Missing orderId' }, { status: 400 });
    }

    // Thực hiện duyệt đơn và tạo vận đơn GHN
    const result = await approveAndFulfillOrder(orderId);

    if (!result.success) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: `Lỗi: ${result.error || 'Không thể duyệt đơn'}`,
        showAlert: true,
      });
      return NextResponse.json({ ok: false, error: result.error });
    }

    // Thông báo pop-up trên Telegram
    const alertText = result.isAlreadyProcessed
      ? 'Đơn hàng này đã được duyệt và tạo vận đơn trước đó!'
      : '✅ Đã duyệt đơn và tạo vận đơn GHN thành công!';

    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: alertText,
      showAlert: false,
    });

    // Cập nhật lại tin nhắn Telegram (gỡ nút duyệt, gắn mã vận đơn GHN)
    if (callback.message) {
      try {
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          select: { customerName: true, totalAmount: true },
        });

        if (order) {
          const formatted = formatApprovedOrderMessage({
            orderCode: result.orderCode,
            customerName: order.customerName,
            totalAmount: Number(order.totalAmount),
            trackingCode: result.trackingCode || 'GHN',
            shippingFee: result.shippingFee || 30000,
            expectedDeliveryTime: result.expectedDeliveryTime,
          });

          await editTelegramMessage({
            chatId: callback.message.chat.id,
            messageId: callback.message.message_id,
            text: formatted.text,
            replyMarkup: formatted.replyMarkup,
          });
        }
      } catch (editErr) {
        console.error('[Telegram Webhook] Lỗi cập nhật giao diện tin nhắn:', editErr);
      }
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('[Telegram Webhook] Unhandled error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
