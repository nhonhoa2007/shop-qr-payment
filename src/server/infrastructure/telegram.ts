import { formatDate } from '@shared/utils';

export interface TelegramItemInfo {
  name: string;
  quantity: number;
  price: number;
  variantTitle?: string | null;
}

export interface NewOrderMessageParams {
  orderCode: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  couponCode?: string | null;
  totalAmount: number;
  items: TelegramItemInfo[];
}

export interface PaidOrderMessageParams {
  id: string;
  orderCode: string;
  customerName: string;
  totalAmount: number;
  paymentMethod?: string;
}

export interface ApprovedOrderMessageParams {
  orderCode: string;
  customerName: string;
  totalAmount: number;
  trackingCode: string;
  shippingFee: number;
  expectedDeliveryTime?: Date | null;
  paymentMethod?: string;
}

export interface SendTelegramMessageParams {
  text: string;
  chatId?: string;
  replyMarkup?: Record<string, unknown>;
}

export interface EditTelegramMessageParams {
  chatId: string | number;
  messageId: number;
  text: string;
  replyMarkup?: Record<string, unknown>;
}

export interface AnswerCallbackQueryParams {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
}

export interface TelegramApiResponse {
  ok: boolean;
  messageId?: number;
  description?: string;
}

/**
 * Escape an toàn các ký tự đặc biệt theo chuẩn HTML Parse Mode của Telegram
 */
export function escapeTelegramHtml(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getAdminOrderUrl(orderCode: string): string {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${baseUrl.replace(/\/$/, '')}/admin/orders?search=${encodeURIComponent(orderCode)}`;
}

/**
 * Định dạng tin nhắn thông báo khi đơn hàng vừa được tạo (PENDING)
 */
export function formatNewOrderMessage(order: NewOrderMessageParams): {
  text: string;
  replyMarkup: Record<string, unknown>;
} {
  const itemsText = order.items
    .map((item) => {
      const variant = item.variantTitle ? ` (${escapeTelegramHtml(item.variantTitle)})` : '';
      return `• ${escapeTelegramHtml(item.name)}${variant} x ${item.quantity} — ${(
        item.price * item.quantity
      ).toLocaleString('vi-VN')}đ`;
    })
    .join('\n');

  const discountLine =
    order.discountAmount > 0
      ? `🎟️ <b>Giảm giá:</b> -${order.discountAmount.toLocaleString('vi-VN')}đ${
          order.couponCode ? ` (${escapeTelegramHtml(order.couponCode)})` : ''
        }\n`
      : '';

  const text = `🛒 <b>ĐƠN HÀNG MỚI #${escapeTelegramHtml(order.orderCode)}</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Khách hàng:</b> ${escapeTelegramHtml(order.customerName)}
📞 <b>SĐT:</b> ${escapeTelegramHtml(order.customerPhone)}
📍 <b>Địa chỉ:</b> ${escapeTelegramHtml(order.customerAddress)}

📦 <b>Sản phẩm:</b>
${itemsText}

💰 <b>Tạm tính:</b> ${order.subtotal.toLocaleString('vi-VN')}đ
🚚 <b>Phí ship:</b> ${order.shippingFee.toLocaleString('vi-VN')}đ
${discountLine}💵 <b>TỔNG CỘNG:</b> ${order.totalAmount.toLocaleString('vi-VN')}đ
⏰ <i>Hạn thanh toán: 15 phút</i>`;

  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: '🔍 Xem đơn hàng trên Web',
          url: getAdminOrderUrl(order.orderCode),
        },
      ],
    ],
  };

  return { text, replyMarkup };
}

/**
 * Định dạng tin nhắn khi đơn hàng đã thanh toán thành công (PAID)
 */
export function formatPaidOrderMessage(order: PaidOrderMessageParams): {
  text: string;
  replyMarkup: Record<string, unknown>;
} {
  const method = order.paymentMethod || 'Chuyển khoản VietQR';
  const text = `💰 <b>ĐƠN HÀNG ĐÃ THANH TOÁN #${escapeTelegramHtml(order.orderCode)}</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Khách hàng:</b> ${escapeTelegramHtml(order.customerName)}
💵 <b>Số tiền:</b> ${order.totalAmount.toLocaleString('vi-VN')}đ
💳 <b>Phương thức:</b> ${escapeTelegramHtml(method)}
⚡ <b>Trạng thái:</b> Đã xác nhận tiền về tài khoản`;

  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: '🚚 Duyệt & Tạo vận đơn GHN',
          callback_data: `approve_order:${order.id}`,
        },
        {
          text: '🔍 Xem trên Web',
          url: getAdminOrderUrl(order.orderCode),
        },
      ],
    ],
  };

  return { text, replyMarkup };
}

/**
 * Định dạng tin nhắn cập nhật sau khi đơn hàng được duyệt & tạo vận đơn GHN thành công
 */
export function formatApprovedOrderMessage(order: ApprovedOrderMessageParams): {
  text: string;
  replyMarkup: Record<string, unknown>;
} {
  const method = order.paymentMethod || 'Chuyển khoản VietQR';
  const dateFormatted = order.expectedDeliveryTime
    ? formatDate(order.expectedDeliveryTime)
    : 'Chờ GHN cập nhật';

  const text = `💰 <b>ĐƠN HÀNG ĐÃ THANH TOÁN #${escapeTelegramHtml(order.orderCode)}</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Khách hàng:</b> ${escapeTelegramHtml(order.customerName)}
💵 <b>Số tiền:</b> ${order.totalAmount.toLocaleString('vi-VN')}đ
💳 <b>Phương thức:</b> ${escapeTelegramHtml(method)}
⚡ <b>Trạng thái:</b> Đã xác nhận tiền về tài khoản
━━━━━━━━━━━━━━━━━━━━
✅ <b>ĐÃ DUYỆT &amp; TẠO VẬN ĐƠN GHN</b>
📦 <b>Mã vận đơn:</b> <code>${escapeTelegramHtml(order.trackingCode)}</code>
🚚 <b>Cước GHN:</b> ${order.shippingFee.toLocaleString('vi-VN')}đ
📅 <b>Dự kiến giao:</b> ${dateFormatted}`;

  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: '🔍 Xem trên Web',
          url: getAdminOrderUrl(order.orderCode),
        },
      ],
    ],
  };

  return { text, replyMarkup };
}

/**
 * Gửi tin nhắn mới tới Telegram Chat ID
 */
export async function sendTelegramMessage(
  params: SendTelegramMessageParams
): Promise<TelegramApiResponse> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = params.chatId || process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return { ok: false, description: 'Telegram credentials missing' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: params.text,
        parse_mode: 'HTML',
        reply_markup: params.replyMarkup,
      }),
    });

    const data = await response.json();
    if (data.ok) {
      return { ok: true, messageId: data.result?.message_id };
    }
    console.error('[Telegram API] sendMessage error:', data);
    return { ok: false, description: data.description || 'Telegram API error' };
  } catch (error) {
    console.error('[Telegram API] sendMessage fetch failed:', error);
    return {
      ok: false,
      description: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Cập nhật lại nội dung và nút bấm của một tin nhắn cũ trên Telegram
 */
export async function editTelegramMessage(
  params: EditTelegramMessageParams
): Promise<TelegramApiResponse> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, description: 'Telegram credentials missing' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: params.chatId,
        message_id: params.messageId,
        text: params.text,
        parse_mode: 'HTML',
        reply_markup: params.replyMarkup,
      }),
    });

    const data = await response.json();
    if (data.ok) {
      return { ok: true };
    }
    console.error('[Telegram API] editMessageText error:', data);
    return { ok: false, description: data.description || 'Telegram API error' };
  } catch (error) {
    console.error('[Telegram API] editMessageText fetch failed:', error);
    return {
      ok: false,
      description: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Phản hồi callback query (tắt icon loading nút bấm trên client Telegram và hiện pop-up)
 */
export async function answerCallbackQuery(
  params: AnswerCallbackQueryParams
): Promise<TelegramApiResponse> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, description: 'Telegram credentials missing' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: params.callbackQueryId,
        text: params.text,
        show_alert: params.showAlert,
      }),
    });

    const data = await response.json();
    if (data.ok) {
      return { ok: true };
    }
    console.error('[Telegram API] answerCallbackQuery error:', data);
    return { ok: false, description: data.description || 'Telegram API error' };
  } catch (error) {
    console.error('[Telegram API] answerCallbackQuery fetch failed:', error);
    return {
      ok: false,
      description: error instanceof Error ? error.message : 'Network error',
    };
  }
}
