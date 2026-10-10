import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatNewOrderMessage,
  formatPaidOrderMessage,
  sendTelegramMessage,
} from '@server/infrastructure/telegram';

describe('Telegram Integration - Non-blocking & Payload Validation', () => {
  it('should format order creation and payment payloads cleanly without throwing', () => {
    const orderPayload = formatNewOrderMessage({
      orderCode: 'DH20261010001',
      customerName: 'Khách Hàng Test',
      customerPhone: '0987654321',
      customerAddress: '456 Hai Bà Trưng, Q.3, TP.HCM',
      subtotal: 300000,
      shippingFee: 30000,
      discountAmount: 0,
      couponCode: null,
      totalAmount: 330000,
      items: [
        { name: 'Sản phẩm A', quantity: 1, price: 300000, variantTitle: 'Size M' },
      ],
    });

    assert.ok(orderPayload.text.includes('DH20261010001'));
    // On localhost, replyMarkup is safely undefined to avoid Telegram 400 rejection
    assert.equal(orderPayload.replyMarkup, undefined);

    const paidPayload = formatPaidOrderMessage({
      id: 'order_uuid_test',
      orderCode: 'DH20261010001',
      customerName: 'Khách Hàng Test',
      totalAmount: 330000,
      paymentMethod: 'Chuyển khoản VietQR',
    });

    assert.ok(paidPayload.text.includes('ĐÃ THANH TOÁN'));
    assert.ok(paidPayload.text.includes('DH20261010001'));
  });

  it('should not throw error when Telegram API is unavailable or credentials are unset', async () => {
    // Calling sendTelegramMessage should safely return a failed response without unhandled promise rejection
    const result = await sendTelegramMessage({
      text: 'Test message',
    });

    assert.equal(typeof result.ok, 'boolean');
  });
});
