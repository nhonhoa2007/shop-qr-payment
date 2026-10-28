import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyCassoOrderPayment } from '@server/modules/payment/casso-order-payment.service';
import {
  applyBankOrderPayment,
  PaymentRequestClaimError,
} from '@server/modules/payment/bank-order-payment.service';

function paymentInput() {
  return {
    order: {
      id: 'order_casso',
      orderCode: 'DHCASSO',
      customerName: 'Casso Customer',
      totalAmount: 500_000n,
    },
    ledgerId: 'ledger_1',
    transactionId: 'bank_tx_1',
    storedAmount: 500_000n,
    description: 'Thanh toan DHCASSO',
    bankName: 'VCB',
    receivedAt: new Date('2026-10-20T00:00:00.000Z'),
    rawWebhookData: { id: 'bank_tx_1' },
    now: new Date('2026-10-20T00:00:00.000Z'),
  };
}

describe('Casso order payment transaction', () => {
  it('claims payment, applies the ledger, and enqueues Telegram through the same client', async () => {
    let outboxData: Record<string, unknown> | undefined;
    const tx = {
      order: { updateMany: async () => ({ count: 1 }) },
      transaction: { create: async () => ({ id: 'payment_1' }) },
      bankTransfer: { update: async () => ({ id: 'ledger_1' }) },
      adminAuditLog: {
        findUnique: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          outboxData = data;
          return { id: 'outbox_casso', ...data };
        },
      },
    };

    const result = await applyCassoOrderPayment(tx, paymentInput());

    assert.deepEqual(result, { id: 'payment_1' });
    assert.equal(outboxData?.operationKey, 'telegram:payment-received:order_casso');
  });

  it('returns null and does not enqueue when the payment CAS loses', async () => {
    let enqueueCalled = false;
    const tx = {
      order: { updateMany: async () => ({ count: 0 }) },
      transaction: { create: async () => ({ id: 'must_not_create' }) },
      bankTransfer: { update: async () => ({ id: 'must_not_update' }) },
      adminAuditLog: {
        findUnique: async () => null,
        create: async () => {
          enqueueCalled = true;
          return { id: 'must_not_enqueue' };
        },
      },
    };

    assert.equal(await applyCassoOrderPayment(tx, paymentInput()), null);
    assert.equal(enqueueCalled, false);
  });

  it('propagates enqueue persistence errors so Prisma rolls the payment transaction back', async () => {
    const tx = {
      order: { updateMany: async () => ({ count: 1 }) },
      transaction: { create: async () => ({ id: 'payment_1' }) },
      bankTransfer: { update: async () => ({ id: 'ledger_1' }) },
      adminAuditLog: {
        findUnique: async () => null,
        create: async () => { throw new Error('outbox unavailable'); },
      },
    };

    await assert.rejects(applyCassoOrderPayment(tx, paymentInput()), /outbox unavailable/);
  });
});

describe('Shared bank order payment transaction', () => {
  it('completes the SePay request in the same transaction as the order and ledger', async () => {
    let requestUpdate: Record<string, unknown> | undefined;
    const tx = {
      order: { updateMany: async () => ({ count: 1 }) },
      paymentRequest: {
        updateMany: async (args: Record<string, unknown>) => {
          requestUpdate = args;
          return { count: 1 };
        },
      },
      transaction: { create: async () => ({ id: 'payment_1' }) },
      bankTransfer: { update: async () => ({ id: 'ledger_1' }) },
      adminAuditLog: {
        findUnique: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => ({ id: 'outbox_1', ...data }),
      },
    };

    await applyBankOrderPayment(tx, {
      ...paymentInput(),
      paymentRequestCode: 'DH261027001',
    });

    assert.deepEqual(requestUpdate?.where, {
      code: 'DH261027001',
      kind: 'ORDER',
      status: 'PENDING',
      expiresAt: { gt: paymentInput().now },
    });
  });

  it('throws so Prisma rolls back when the SePay request cannot be claimed', async () => {
    const tx = {
      order: { updateMany: async () => ({ count: 1 }) },
      paymentRequest: { updateMany: async () => ({ count: 0 }) },
      transaction: { create: async () => ({ id: 'must_not_create' }) },
      bankTransfer: { update: async () => ({ id: 'must_not_update' }) },
      adminAuditLog: {
        findUnique: async () => null,
        create: async () => ({ id: 'must_not_enqueue' }),
      },
    };

    await assert.rejects(
      applyBankOrderPayment(tx, {
        ...paymentInput(),
        paymentRequestCode: 'DH261027001',
      }),
      PaymentRequestClaimError
    );
  });
});
