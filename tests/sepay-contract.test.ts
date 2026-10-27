import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSePayQrUrl,
  parseSePayPayload,
  verifySePayWebhook,
} from '@server/modules/payment/sepay.service';

const NOW_SECONDS = 1_798_000_000;
const SECRET = 'sepay-test-secret';

function signedHeaders(rawBody: string, timestamp = NOW_SECONDS) {
  const digest = createHmac('sha256', SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  return new Headers({
    'X-SePay-Timestamp': String(timestamp),
    'X-SePay-Signature': `sha256=${digest}`,
  });
}

describe('SePay VietQR contract', () => {
  it('embeds the exact bank account, amount, payment code and optional bank memo prefix', () => {
    const qrUrl = generateSePayQrUrl({
      bankId: 'MBBank',
      accountNo: '0123456789',
      accountName: 'SHOP QR PAYMENT',
      amount: 250_000,
      paymentCode: 'DH261027001',
      memoPrefix: 'TKP001',
    });

    const url = new URL(qrUrl);
    assert.equal(url.origin, 'https://vietqr.app');
    assert.equal(url.pathname, '/img');
    assert.equal(url.searchParams.get('acc'), '0123456789');
    assert.equal(url.searchParams.get('bank'), 'MBBank');
    assert.equal(url.searchParams.get('amount'), '250000');
    assert.equal(url.searchParams.get('des'), 'TKP001 DH261027001');
    assert.equal(url.searchParams.get('template'), 'compact');
    assert.equal(url.searchParams.get('showinfo'), 'true');
    assert.equal(url.searchParams.get('holder'), 'SHOP QR PAYMENT');
  });

  it('rejects unsafe QR values instead of generating a misleading payment code', () => {
    assert.throws(
      () => generateSePayQrUrl({
        bankId: 'MBBank',
        accountNo: '',
        accountName: 'SHOP',
        amount: 10_000,
        paymentCode: 'NAP261027001',
      }),
      /tài khoản ngân hàng/i
    );
    assert.throws(
      () => generateSePayQrUrl({
        bankId: 'MBBank',
        accountNo: '0123456789',
        accountName: 'SHOP',
        amount: 10_000.5,
        paymentCode: 'NAP261027001',
      }),
      /số tiền/i
    );
  });
});

describe('SePay webhook authentication', () => {
  it('verifies HMAC over the exact unicode raw body', () => {
    const rawBody = '{"content":"Nạp ví NAP261027001","transferAmount":200000}';
    assert.equal(
      verifySePayWebhook(rawBody, signedHeaders(rawBody), SECRET, NOW_SECONDS * 1000),
      true
    );
  });

  it('rejects an altered body or signature', () => {
    const rawBody = '{"id":92704}';
    assert.equal(
      verifySePayWebhook(`${rawBody} `, signedHeaders(rawBody), SECRET, NOW_SECONDS * 1000),
      false
    );
    const headers = signedHeaders(rawBody);
    headers.set('X-SePay-Signature', `sha256=${'0'.repeat(64)}`);
    assert.equal(verifySePayWebhook(rawBody, headers, SECRET, NOW_SECONDS * 1000), false);
  });

  it('rejects missing secrets and timestamps outside the five-minute replay window', () => {
    const rawBody = '{"id":92704}';
    assert.equal(verifySePayWebhook(rawBody, signedHeaders(rawBody), '', NOW_SECONDS * 1000), false);
    assert.equal(
      verifySePayWebhook(rawBody, signedHeaders(rawBody, NOW_SECONDS - 301), SECRET, NOW_SECONDS * 1000),
      false
    );
    assert.equal(
      verifySePayWebhook(rawBody, signedHeaders(rawBody, NOW_SECONDS - 300), SECRET, NOW_SECONDS * 1000),
      true
    );
  });
});

describe('SePay payload parsing', () => {
  it('accepts the documented incoming transaction payload', () => {
    const parsed = parseSePayPayload({
      id: 92704,
      gateway: 'Vietcombank',
      transactionDate: '2026-10-27 21:30:00',
      accountNumber: '1017588888',
      subAccount: '',
      code: 'DH261027001',
      content: 'DH261027001 thanh toan',
      transferType: 'in',
      description: 'NGUYEN VAN A chuyen tien',
      transferAmount: 5_000_000,
      accumulated: 105_000_000,
      referenceCode: 'FT24012345678',
    });

    assert.ok(parsed);
    assert.equal(parsed.id, 92704);
    assert.equal(parsed.code, 'DH261027001');
    assert.equal(parsed.transferAmount, 5_000_000);
    assert.equal(parsed.transferType, 'in');
  });

  it('rejects malformed identifiers, transaction directions and amounts', () => {
    const base = {
      id: 92704,
      gateway: 'MBBank',
      transactionDate: '2026-10-27 21:30:00',
      accountNumber: '0123456789',
      subAccount: '',
      code: null,
      content: 'NAP261027001',
      transferType: 'in',
      description: '',
      transferAmount: 200_000,
      accumulated: 0,
      referenceCode: 'SB123',
    };

    assert.equal(parseSePayPayload({ ...base, id: '92704' }), null);
    assert.equal(parseSePayPayload({ ...base, transferType: 'credit' }), null);
    assert.equal(parseSePayPayload({ ...base, transferAmount: 1.5 }), null);
    assert.equal(parseSePayPayload({ ...base, code: 123 }), null);
  });
});
