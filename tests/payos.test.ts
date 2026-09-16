import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  generatePayOSRequestSignature,
  verifyPayOSWebhookSignature,
  parsePayOSOrderCode,
  createPayOSPaymentLink,
} from '../src/lib/payos.ts';

describe('PayOS Integration - Request Signature Generation', () => {
  it('should generate deterministic HMAC-SHA256 signature with sorted params', () => {
    const checksumKey = 'test_checksum_key_123456';
    const params = {
      amount: 250000,
      cancelUrl: 'http://localhost:3000/payment/cancel',
      description: 'ShopQR DH1001',
      orderCode: 1001,
      returnUrl: 'http://localhost:3000/payment/success',
    };

    const signature = generatePayOSRequestSignature(params, checksumKey);

    const expectedDataStr = `amount=${params.amount}&cancelUrl=${params.cancelUrl}&description=${params.description}&orderCode=${params.orderCode}&returnUrl=${params.returnUrl}`;
    const expectedSig = crypto.createHmac('sha256', checksumKey).update(expectedDataStr).digest('hex');

    assert.equal(signature, expectedSig);
    assert.equal(typeof signature, 'string');
    assert.equal(signature.length, 64);
  });
});

describe('PayOS Integration - Webhook Signature Verification', () => {
  const checksumKey = 'secure_webhook_key_789';

  it('should verify valid webhook signature correctly', () => {
    const data = {
      orderCode: 123456,
      amount: 150000,
      description: 'DH123456',
      accountNumber: '0987654321',
      reference: 'FT260911001',
    };

    const sortedKeys = Object.keys(data).sort();
    const queryString = sortedKeys
      .map((k) => `${k}=${data[k as keyof typeof data]}`)
      .join('&');
    const validSignature = crypto.createHmac('sha256', checksumKey).update(queryString).digest('hex');

    const isValid = verifyPayOSWebhookSignature(data, validSignature, checksumKey);
    assert.equal(isValid, true);
  });

  it('should reject when webhook payload has been tampered with', () => {
    const data = {
      orderCode: 123456,
      amount: 150000,
      description: 'DH123456',
    };

    const sortedKeys = Object.keys(data).sort();
    const queryString = sortedKeys
      .map((k) => `${k}=${data[k as keyof typeof data]}`)
      .join('&');
    const signature = crypto.createHmac('sha256', checksumKey).update(queryString).digest('hex');

    // Kẻ xấu thay đổi số tiền amount
    const tamperedData = {
      ...data,
      amount: 500000,
    };

    const isValid = verifyPayOSWebhookSignature(tamperedData, signature, checksumKey);
    assert.equal(isValid, false);
  });

  it('should reject when signature is missing, empty or wrong key', () => {
    const data = { orderCode: 123456, amount: 150000 };
    assert.equal(verifyPayOSWebhookSignature(data, '', checksumKey), false);
    assert.equal(verifyPayOSWebhookSignature(data, 'invalid_sig', checksumKey), false);
    assert.equal(verifyPayOSWebhookSignature(data, 'a'.repeat(64), 'wrong_key'), false);
  });
});

describe('PayOS Integration - Order Code Parsing & Link Creation', () => {
  it('should parse numeric code from string order codes', () => {
    assert.equal(parsePayOSOrderCode('DH123456'), 123456);
    assert.equal(parsePayOSOrderCode('ORD-998877'), 998877);
  });

  it('should create mock payment link when API credentials are absent', async () => {
    const res = await createPayOSPaymentLink({
      orderCode: 778899,
      amount: 320000,
      description: 'Thanh toán đơn hàng',
      cancelUrl: 'http://localhost/cancel',
      returnUrl: 'http://localhost/return',
    });

    assert.equal(res.success, true);
    assert.equal(res.source, 'MOCK');
    assert.match(res.checkoutUrl, /payos-checkout/);
    assert.equal(res.orderCode, 778899);
  });
});
