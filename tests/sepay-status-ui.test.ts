import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPaymentStatusResponse,
  type PaymentStatusDependencies,
} from '@server/modules/payment/payment-status.controller';
import type { PaymentRequestRecord } from '@server/modules/payment/payment-request.service';

function paymentRequest(overrides: Partial<PaymentRequestRecord> = {}): PaymentRequestRecord {
  return {
    id: 'request_1',
    code: 'DH261027001',
    kind: 'ORDER',
    status: 'PENDING',
    provider: 'SEPAY',
    amount: 500000n,
    qrUrl: 'https://vietqr.app/img?test=1',
    userId: null,
    orderId: 'order_1',
    idempotencyKey: null,
    expiresAt: new Date('2026-10-27T15:30:00.000Z'),
    completedAt: null,
    createdAt: new Date('2026-10-27T15:15:00.000Z'),
    updatedAt: new Date('2026-10-27T15:15:00.000Z'),
    ...overrides,
  };
}

function dependencies(
  request: PaymentRequestRecord | null,
  userId: string | null = null
): PaymentStatusDependencies {
  return {
    now: () => new Date('2026-10-27T15:20:00.000Z'),
    findByCode: async () => request,
    expireByCode: async () => false,
    getCurrentUserId: async () => userId,
  };
}

describe('SePay payment status', () => {
  it('returns only the minimal public state for an order request', async () => {
    const response = await getPaymentStatusResponse(
      'dh261027001',
      dependencies(paymentRequest())
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      data: {
        code: 'DH261027001',
        kind: 'ORDER',
        status: 'PENDING',
        expiresAt: '2026-10-27T15:30:00.000Z',
        completedAt: null,
      },
    });
  });

  it('keeps a request pending during the webhook delivery grace window', async () => {
    let expiredCode: string | null = null;
    const deps = dependencies(paymentRequest({
      expiresAt: new Date('2026-10-27T15:19:00.000Z'),
    }));
    deps.expireByCode = async (code) => {
      expiredCode = code;
      return true;
    };
    const response = await getPaymentStatusResponse(
      'DH261027001',
      deps
    );
    const body = await response.json();
    assert.equal(body.data.status, 'PENDING');
    assert.equal(expiredCode, null);
  });

  it('reports a pending request as expired after the delivery grace window', async () => {
    let expiredCode: string | null = null;
    const deps = dependencies(paymentRequest({
      expiresAt: new Date('2026-10-27T15:14:00.000Z'),
    }));
    deps.expireByCode = async (code) => {
      expiredCode = code;
      return true;
    };
    const response = await getPaymentStatusResponse('DH261027001', deps);
    const body = await response.json();
    assert.equal(body.data.status, 'EXPIRED');
    assert.equal(expiredCode, 'DH261027001');
  });

  it('requires authentication for a wallet top-up request', async () => {
    const topup = paymentRequest({
      code: 'NAP261027001',
      kind: 'WALLET_TOPUP',
      orderId: null,
      userId: 'user_1',
    });
    const response = await getPaymentStatusResponse('NAP261027001', dependencies(topup));
    assert.equal(response.status, 401);
  });

  it('forbids a different user from reading a wallet top-up request', async () => {
    const topup = paymentRequest({
      code: 'NAP261027001',
      kind: 'WALLET_TOPUP',
      orderId: null,
      userId: 'user_1',
    });
    const response = await getPaymentStatusResponse(
      'NAP261027001',
      dependencies(topup, 'user_2')
    );
    assert.equal(response.status, 404);
  });

  it('authenticates a NAP code before looking it up', async () => {
    let lookupCalled = false;
    const deps: PaymentStatusDependencies = {
      now: () => new Date('2026-10-27T15:20:00.000Z'),
      findByCode: async () => {
        lookupCalled = true;
        return null;
      },
      expireByCode: async () => false,
      getCurrentUserId: async () => null,
    };

    const response = await getPaymentStatusResponse('NAP261027999', deps);
    assert.equal(response.status, 401);
    assert.equal(lookupCalled, false);
  });

  it('lets the owner read a completed wallet top-up state', async () => {
    const completedAt = new Date('2026-10-27T15:19:00.000Z');
    const topup = paymentRequest({
      code: 'NAP261027001',
      kind: 'WALLET_TOPUP',
      status: 'COMPLETED',
      orderId: null,
      userId: 'user_1',
      completedAt,
    });
    const response = await getPaymentStatusResponse(
      'NAP261027001',
      dependencies(topup, 'user_1')
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.status, 'COMPLETED');
    assert.equal(body.data.completedAt, completedAt.toISOString());
  });
});

describe('SePay status polling UI', () => {
  it('polls the status endpoint from both order and wallet QR screens', async () => {
    const [orderUi, walletUi] = await Promise.all([
      readFile(new URL('../src/client/components/payment/QRPayment.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../src/client/components/wallet/WalletTopupModal.tsx', import.meta.url), 'utf8'),
    ]);

    assert.match(orderUi, /api\/payments\/\$\{encodeURIComponent\(orderCode\)\}/);
    assert.match(walletUi, /api\/payments\/\$\{encodeURIComponent\(topupData\.topupCode\)\}/);
    assert.match(walletUi, /x-idempotency-key/);
    assert.match(walletUi, /topupIdempotencyKeyRef/);
    assert.match(orderUi, /PAYMENT_EXPIRY_GRACE_MS/);
    assert.match(orderUi, /confirming/);
    assert.match(walletUi, /PAYMENT_EXPIRY_GRACE_MS/);
    assert.match(walletUi, /awaitingSettlement/);
    assert.match(orderUi, /SePay\/VietQR/);
    assert.match(walletUi, /SePay\/VietQR/);
    assert.doesNotMatch(walletUi, /Casso/);
  });
});
