import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeTelegramHtml,
  formatNewOrderMessage,
  formatPaidOrderMessage,
  formatApprovedOrderMessage,
  sendTelegramMessage,
  editTelegramMessage,
  answerCallbackQuery,
} from '@server/infrastructure/telegram';

describe('Telegram Infrastructure - HTML Escaping', () => {
  it('should escape HTML sensitive characters correctly', () => {
    const raw = '<b>Test & "Quote" <script>alert(1)</script></b>';
    const escaped = escapeTelegramHtml(raw);
    assert.equal(
      escaped,
      '&lt;b&gt;Test &amp; &quot;Quote&quot; &lt;script&gt;alert(1)&lt;/script&gt;&lt;/b&gt;'
    );
  });

  it('should return empty string for null, undefined, or empty values', () => {
    assert.equal(escapeTelegramHtml(''), '');
    assert.equal(escapeTelegramHtml(null as unknown as string), '');
    assert.equal(escapeTelegramHtml(undefined as unknown as string), '');
  });
});

describe('Telegram Infrastructure - Message Formatting', () => {
  const originalEnv = process.env.NEXTAUTH_URL;

  beforeEach(() => {
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    process.env.NEXTAUTH_URL = originalEnv;
  });

  it('should format new order message with proper HTML structure and inline URL button', () => {
    const orderData = {
      orderCode: 'DH123456',
      customerName: 'Nguyễn <Văn> A & Con',
      customerPhone: '0901234567',
      customerAddress: '123 Đường Lê Lợi, Q.1',
      subtotal: 500000,
      shippingFee: 30000,
      discountAmount: 50000,
      couponCode: 'SALE50',
      totalAmount: 480000,
      items: [
        { name: 'Áo thun <Cool>', quantity: 2, price: 200000, variantTitle: 'Đen / L' },
        { name: 'Nón kết', quantity: 1, price: 100000, variantTitle: null },
      ],
    };

    const formatted = formatNewOrderMessage(orderData);

    assert.match(formatted.text, /🛒 <b>ĐƠN HÀNG MỚI #DH123456<\/b>/);
    assert.match(formatted.text, /Nguyễn &lt;Văn&gt; A &amp; Con/);
    assert.match(formatted.text, /Áo thun &lt;Cool&gt; \(Đen \/ L\) x 2/);
    assert.match(formatted.text, /🎟️ <b>Giảm giá:<\/b> -50\.000đ \(SALE50\)/);
    assert.match(formatted.text, /💵 <b>TỔNG CỘNG:<\/b> 480\.000đ/);

    const markup = formatted.replyMarkup as { inline_keyboard: Array<Array<{ text: string; url: string }>> };
    assert.ok(markup?.inline_keyboard);
    assert.equal(markup.inline_keyboard[0][0].text, '🔍 Xem đơn hàng trên Web');
    assert.equal(markup.inline_keyboard[0][0].url, 'http://localhost:3000/admin/orders?search=DH123456');
  });

  it('should format paid order message with approve callback button and web url button', () => {
    const paidData = {
      id: 'order_uuid_123',
      orderCode: 'DH999888',
      customerName: 'Trần Thị B',
      totalAmount: 750000,
      paymentMethod: 'Chuyển khoản VietQR',
    };

    const formatted = formatPaidOrderMessage(paidData);

    assert.match(formatted.text, /💰 <b>ĐƠN HÀNG ĐÃ THANH TOÁN #DH999888<\/b>/);
    assert.match(formatted.text, /Trần Thị B/);
    assert.match(formatted.text, /750\.000đ/);
    assert.match(formatted.text, /Chuyển khoản VietQR/);

    const markup = formatted.replyMarkup as {
      inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
    };
    assert.ok(markup?.inline_keyboard);
    assert.equal(markup.inline_keyboard[0][0].text, '🚚 Duyệt & Tạo vận đơn GHN');
    assert.equal(markup.inline_keyboard[0][0].callback_data, 'approve_order:order_uuid_123');
    assert.equal(markup.inline_keyboard[0][1].text, '🔍 Xem trên Web');
    assert.equal(markup.inline_keyboard[0][1].url, 'http://localhost:3000/admin/orders?search=DH999888');
  });

  it('should format approved order message with tracking code and removed approval button', () => {
    const approvedData = {
      orderCode: 'DH999888',
      customerName: 'Trần Thị B',
      totalAmount: 750000,
      trackingCode: 'GY999XYZ',
      shippingFee: 32000,
      expectedDeliveryTime: new Date('2026-10-15T12:00:00Z'),
    };

    const formatted = formatApprovedOrderMessage(approvedData);

    assert.match(formatted.text, /✅ <b>ĐÃ DUYỆT &amp; TẠO VẬN ĐƠN GHN<\/b>/);
    assert.match(formatted.text, /<code>GY999XYZ<\/code>/);
    assert.match(formatted.text, /32\.000đ/);
    assert.match(formatted.text, /15\/10\/2026/);

    const markup = formatted.replyMarkup as {
      inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
    };
    assert.equal(markup.inline_keyboard.length, 1);
    assert.equal(markup.inline_keyboard[0][0].text, '🔍 Xem trên Web');
    assert.equal(markup.inline_keyboard[0][0].url, 'http://localhost:3000/admin/orders?search=DH999888');
  });
});

describe('Telegram Infrastructure - API Communication', () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.TELEGRAM_CHAT_ID;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
    process.env.TELEGRAM_CHAT_ID = originalChatId;
    globalThis.fetch = originalFetch;
  });

  it('should return no-op result when credentials are missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;

    const res = await sendTelegramMessage({ text: 'Hello' });
    assert.equal(res.ok, false);
    assert.equal(res.description, 'Telegram credentials missing');
  });

  it('should send message to Telegram API when credentials are present', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'mock_bot_token';
    process.env.TELEGRAM_CHAT_ID = 'mock_chat_id';

    let calledUrl = '';
    let calledBody: any = null;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      calledUrl = String(input);
      calledBody = JSON.parse(String(init?.body || '{}'));
      return new Response(
        JSON.stringify({ ok: true, result: { message_id: 42 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const res = await sendTelegramMessage({
      text: 'Test message',
      replyMarkup: { inline_keyboard: [] },
    });

    assert.equal(res.ok, true);
    assert.equal(res.messageId, 42);
    assert.equal(calledUrl, 'https://api.telegram.org/botmock_bot_token/sendMessage');
    assert.equal(calledBody.chat_id, 'mock_chat_id');
    assert.equal(calledBody.text, 'Test message');
    assert.equal(calledBody.parse_mode, 'HTML');
  });

  it('should edit message on Telegram API correctly', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'mock_bot_token';

    let calledUrl = '';
    let calledBody: any = null;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      calledUrl = String(input);
      calledBody = JSON.parse(String(init?.body || '{}'));
      return new Response(
        JSON.stringify({ ok: true, result: { message_id: 101 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const res = await editTelegramMessage({
      chatId: '12345',
      messageId: 101,
      text: 'Updated message',
    });

    assert.equal(res.ok, true);
    assert.equal(calledUrl, 'https://api.telegram.org/botmock_bot_token/editMessageText');
    assert.equal(calledBody.chat_id, '12345');
    assert.equal(calledBody.message_id, 101);
  });

  it('should answer callback query correctly', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'mock_bot_token';

    let calledUrl = '';
    let calledBody: any = null;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      calledUrl = String(input);
      calledBody = JSON.parse(String(init?.body || '{}'));
      return new Response(
        JSON.stringify({ ok: true, result: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const res = await answerCallbackQuery({
      callbackQueryId: 'query_777',
      text: 'Đã duyệt đơn!',
      showAlert: true,
    });

    assert.equal(res.ok, true);
    assert.equal(calledUrl, 'https://api.telegram.org/botmock_bot_token/answerCallbackQuery');
    assert.equal(calledBody.callback_query_id, 'query_777');
    assert.equal(calledBody.text, 'Đã duyệt đơn!');
    assert.equal(calledBody.show_alert, true);
  });
});
