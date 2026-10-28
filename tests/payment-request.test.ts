import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  completePendingPaymentRequest,
  createOrderPaymentRequest,
  createPendingPaymentRequest,
  paymentRequestToTopupSession,
  type PaymentRequestRecord,
  type PaymentRequestStore,
} from '@server/modules/payment/payment-request.service';

function requestRecord(overrides: Partial<PaymentRequestRecord> = {}): PaymentRequestRecord {
  return {
    id: 'request_1',
    code: 'NAP261027001',
    kind: 'WALLET_TOPUP',
    status: 'PENDING',
    provider: 'SEPAY',
    amount: 200_000n,
    qrUrl: 'https://vietqr.app/img?test=1',
    userId: 'user_1',
    orderId: null,
    idempotencyKey: 'idem_1',
    expiresAt: new Date('2026-10-27T15:30:00.000Z'),
    completedAt: null,
    createdAt: new Date('2026-10-27T15:15:00.000Z'),
    updatedAt: new Date('2026-10-27T15:15:00.000Z'),
    ...overrides,
  };
}

describe('PaymentRequest persistence contract', () => {
  it('creates an order request linked to the order in the same store', async () => {
    let createArgs: Record<string, unknown> | undefined;
    const created = requestRecord({
      code: 'DH261027001',
      kind: 'ORDER',
      userId: null,
      orderId: 'order_1',
      idempotencyKey: null,
    });
    const store = {
      paymentRequest: {
        findUnique: async () => null,
        create: async (args: Record<string, unknown>) => {
          createArgs = args;
          return created;
        },
        updateMany: async () => ({ count: 0 }),
      },
    } as PaymentRequestStore;

    const result = await createOrderPaymentRequest(store, {
      orderId: 'order_1',
      orderCode: 'DH261027001',
      userId: null,
      amount: 500_000n,
      qrUrl: created.qrUrl,
      expiresAt: created.expiresAt,
    });

    assert.equal(result, created);
    const data = createArgs?.data as Record<string, unknown>;
    assert.equal(data.kind, 'ORDER');
    assert.equal(data.orderId, 'order_1');
    assert.equal(data.code, 'DH261027001');
  });

  it('returns an existing request for the same idempotency key and payload', async () => {
    const existing = requestRecord();
    let createCalls = 0;
    const store = {
      paymentRequest: {
        findUnique: async () => existing,
        create: async () => {
          createCalls += 1;
          return existing;
        },
        updateMany: async () => ({ count: 0 }),
      },
    } as PaymentRequestStore;

    const result = await createPendingPaymentRequest(store, {
      code: existing.code,
      kind: 'WALLET_TOPUP',
      amount: 200_000,
      qrUrl: existing.qrUrl,
      userId: 'user_1',
      idempotencyKey: 'idem_1',
      expiresAt: existing.expiresAt,
    });

    assert.equal(result, existing);
    assert.equal(createCalls, 0);
  });

  it('rejects reuse of an idempotency key with a different amount', async () => {
    const existing = requestRecord();
    const store = {
      paymentRequest: {
        findUnique: async () => existing,
        create: async () => existing,
        updateMany: async () => ({ count: 0 }),
      },
    } as PaymentRequestStore;

    await assert.rejects(
      createPendingPaymentRequest(store, {
        code: existing.code,
        kind: 'WALLET_TOPUP',
        amount: 300_000,
        qrUrl: existing.qrUrl,
        userId: 'user_1',
        idempotencyKey: 'idem_1',
        expiresAt: existing.expiresAt,
      }),
      /idempotency key.*khác/i
    );
  });

  it('creates a new pending SePay request when no duplicate exists', async () => {
    const created = requestRecord();
    let createArgs: Record<string, unknown> | undefined;
    const store = {
      paymentRequest: {
        findUnique: async () => null,
        create: async (args: Record<string, unknown>) => {
          createArgs = args;
          return created;
        },
        updateMany: async () => ({ count: 0 }),
      },
    } as PaymentRequestStore;

    assert.equal(await createPendingPaymentRequest(store, {
      code: created.code,
      kind: 'WALLET_TOPUP',
      amount: 200_000,
      qrUrl: created.qrUrl,
      userId: 'user_1',
      idempotencyKey: 'idem_1',
      expiresAt: created.expiresAt,
    }), created);
    const data = createArgs?.data as Record<string, unknown>;
    assert.equal(data.provider, 'SEPAY');
    assert.equal(data.status, 'PENDING');
    assert.equal(data.amount, 200_000n);
  });

  it('completes only a pending request whose expiry is after the transaction time', async () => {
    let updateArgs: Record<string, unknown> | undefined;
    const store = {
      paymentRequest: {
        findUnique: async () => null,
        create: async () => requestRecord(),
        updateMany: async (args: Record<string, unknown>) => {
          updateArgs = args;
          return { count: 1 };
        },
      },
    } as PaymentRequestStore;
    const paidAt = new Date('2026-10-27T15:20:00.000Z');

    assert.equal(await completePendingPaymentRequest(store, 'NAP261027001', paidAt), true);
    assert.deepEqual(updateArgs?.where, {
      code: 'NAP261027001',
      status: 'PENDING',
      expiresAt: { gt: paidAt },
    });
    assert.deepEqual(updateArgs?.data, { status: 'COMPLETED', completedAt: paidAt });
  });

  it('maps a database request to the existing wallet top-up session contract', () => {
    const session = paymentRequestToTopupSession(requestRecord());
    assert.deepEqual(session, {
      topupCode: 'NAP261027001',
      userId: 'user_1',
      amount: 200_000,
      status: 'PENDING',
      idempotencyToken: 'idem_1',
      createdAt: '2026-10-27T15:15:00.000Z',
    });
  });
});
