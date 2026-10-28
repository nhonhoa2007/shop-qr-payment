import crypto from 'node:crypto';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  handleSePayWebhook,
  type SePayWebhookDependencies,
} from '@server/modules/payment/sepay-webhook.controller';

const NOW = new Date('2026-10-27T15:20:00.000Z');
const SECRET = 'sepay-test-secret';

function payload(overrides: Record<string, unknown> = {}) {
  return {
    id: 261027001,
    gateway: 'VCB',
    transactionDate: '2026-10-27T15:19:00.000Z',
    accountNumber: '0123456789',
    subAccount: null,
    code: 'DH261027001',
    content: 'Thanh toan DH261027001',
    transferType: 'in',
    description: 'Thanh toan DH261027001',
    transferAmount: 500000,
    accumulated: 1500000,
    referenceCode: 'FT261027001',
    ...overrides,
  };
}

function signedRequest(value: unknown, options: { secret?: string; signature?: string } = {}) {
  const rawBody = JSON.stringify(value);
  const timestamp = String(Math.floor(NOW.getTime() / 1000));
  const signature = options.signature ?? `sha256=${crypto
    .createHmac('sha256', options.secret ?? SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')}`;
  return new Request('http://localhost/api/webhooks/sepay', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-sepay-timestamp': timestamp,
      'x-sepay-signature': signature,
    },
    body: rawBody,
  });
}

function requestRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'request_1',
    code: 'DH261027001',
    kind: 'ORDER',
    status: 'PENDING',
    provider: 'SEPAY',
    amount: 500000n,
    qrUrl: 'https://vietqr.app/img?test=1',
    userId: 'user_1',
    orderId: 'order_1',
    idempotencyKey: null,
    expiresAt: new Date('2026-10-27T15:30:00.000Z'),
    completedAt: null,
    createdAt: new Date('2026-10-27T15:15:00.000Z'),
    updatedAt: new Date('2026-10-27T15:15:00.000Z'),
    ...overrides,
  };
}

function orderRecord() {
  return {
    id: 'order_1',
    orderCode: 'DH261027001',
    customerName: 'Khách thử nghiệm',
    totalAmount: 500000n,
    userId: 'user_1',
    status: 'PENDING',
    paymentStatus: 'UNPAID',
    expiresAt: new Date('2026-10-27T15:30:00.000Z'),
    chatRoom: null,
  };
}

function createDependencies(options: {
  request?: ReturnType<typeof requestRecord> | null;
  duplicate?: boolean;
} = {}) {
  const state = {
    ledgers: [] as Array<Record<string, unknown>>,
    updates: [] as Array<Record<string, unknown>>,
    orderPayments: 0,
    topups: 0,
  };
  const paymentRequest = options.request === undefined ? requestRecord() : options.request;
  const tx = {
    bankTransfer: {
      update: async (args: Record<string, unknown>) => {
        state.updates.push(args);
        return { id: 'ledger_1' };
      },
    },
  };
  const dependencies: SePayWebhookDependencies = {
    secret: SECRET,
    now: () => NOW,
    isUniqueViolation: (error) => error instanceof Error && error.message === 'duplicate',
    db: {
      paymentRequest: { findUnique: async () => paymentRequest },
      order: { findFirst: async () => paymentRequest?.kind === 'ORDER' ? orderRecord() : null },
      bankTransfer: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          if (options.duplicate) throw new Error('duplicate');
          state.ledgers.push(data);
          return { id: 'ledger_1', ...data };
        },
        update: tx.bankTransfer.update,
      },
      $transaction: async <T>(work: (client: typeof tx) => Promise<T>) => work(tx),
    },
    applyOrderPayment: async () => {
      state.orderPayments += 1;
      return { id: 'payment_1' };
    },
    applyWalletTopup: async () => {
      state.topups += 1;
      return { success: true, userId: 'user_1', newBalance: 700000n };
    },
    afterOrderPayment: async () => undefined,
    afterWalletTopup: async () => undefined,
  };
  return { dependencies, state };
}

describe('SePay webhook', () => {
  it('rejects a request with an invalid HMAC signature before writing a ledger', async () => {
    const { dependencies, state } = createDependencies();
    const response = await handleSePayWebhook(
      signedRequest(payload(), { signature: `sha256=${'0'.repeat(64)}` }),
      dependencies
    );

    assert.equal(response.status, 401);
    assert.equal(state.ledgers.length, 0);
  });

  it('applies an exact, pending order payment and returns SePay acknowledgement', async () => {
    const { dependencies, state } = createDependencies();
    const response = await handleSePayWebhook(signedRequest(payload()), dependencies);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
    assert.equal(state.orderPayments, 1);
    assert.equal(state.topups, 0);
    assert.equal(state.ledgers[0].bankTransId, 'sepay:261027001');
  });

  it('uses content when SePay code is empty and applies an exact wallet top-up', async () => {
    const topupRequest = requestRecord({
      code: 'NAP261027002',
      kind: 'WALLET_TOPUP',
      orderId: null,
      amount: 200000n,
    });
    const { dependencies, state } = createDependencies({ request: topupRequest });
    const response = await handleSePayWebhook(signedRequest(payload({
      id: 261027002,
      code: null,
      content: 'NAP 261027002',
      description: 'NAP 261027002',
      transferAmount: 200000,
    })), dependencies);

    assert.equal(response.status, 200);
    assert.equal(state.topups, 1);
    assert.equal(state.orderPayments, 0);
    assert.ok(state.updates.some((item) => (
      item.data as Record<string, unknown>
    )?.status === 'APPLIED_TOPUP'));
  });

  it('acknowledges a duplicate SePay id without applying money again', async () => {
    const { dependencies, state } = createDependencies({ duplicate: true });
    const response = await handleSePayWebhook(signedRequest(payload()), dependencies);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
    assert.equal(state.orderPayments, 0);
    assert.equal(state.topups, 0);
  });

  it('keeps a wrong amount in review and does not apply it', async () => {
    const { dependencies, state } = createDependencies();
    const response = await handleSePayWebhook(
      signedRequest(payload({ transferAmount: 499999 })),
      dependencies
    );

    assert.equal(response.status, 200);
    assert.equal(state.orderPayments, 0);
    assert.equal(state.topups, 0);
    assert.match(String(state.ledgers[0].reviewReason), /sai số tiền/i);
  });

  it('keeps a late payment in review and does not apply it', async () => {
    const lateRequest = requestRecord({ expiresAt: new Date('2026-10-27T15:18:00.000Z') });
    const { dependencies, state } = createDependencies({ request: lateRequest });
    const response = await handleSePayWebhook(signedRequest(payload()), dependencies);

    assert.equal(response.status, 200);
    assert.equal(state.orderPayments, 0);
    assert.equal(state.topups, 0);
    assert.match(String(state.ledgers[0].reviewReason), /sau hạn/i);
  });
});
