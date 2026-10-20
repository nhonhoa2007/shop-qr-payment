import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  enqueueOrderCreatedTelegram,
  enqueuePaymentReceivedTelegram,
  enqueueTelegramOutbox,
} from '@server/modules/telegram/telegram-outbox.service';

describe('Telegram outbox enqueue', () => {
  it('persists the rendered payload as a deterministic audit-log outbox entry', async () => {
    const created: Array<Record<string, unknown>> = [];
    const tx = {
      adminAuditLog: {
        findUnique: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return { id: 'outbox_1', ...data };
        },
      },
    };

    const result = await enqueueTelegramOutbox(tx, {
      eventType: 'ORDER_CREATED',
      orderId: 'order_1',
      orderCode: 'DH001',
      payload: {
        text: 'Đơn hàng mới',
        replyMarkup: { inline_keyboard: [] },
      },
      now: new Date('2026-10-20T00:00:00.000Z'),
    });

    assert.equal(result.created, true);
    assert.equal(created.length, 1);
    assert.equal(created[0].operationKey, 'telegram:order-created:order_1');
    assert.equal(created[0].action, 'TELEGRAM_OUTBOX');
    assert.equal(created[0].entityType, 'ORDER');
    assert.equal(created[0].entityId, 'order_1');
    assert.deepEqual(created[0].metadata, {
      eventType: 'ORDER_CREATED',
      orderCode: 'DH001',
    });
    assert.deepEqual(created[0].afterState, {
      kind: 'TELEGRAM_OUTBOX',
      version: 1,
      status: 'PENDING',
      eventType: 'ORDER_CREATED',
      payload: { text: 'Đơn hàng mới', replyMarkup: { inline_keyboard: [] } },
      attemptCount: 0,
      firstAttemptAt: null,
      lastAttemptAt: null,
      nextAttemptAt: '2026-10-20T00:00:00.000Z',
      expiresAt: '2026-10-21T00:00:00.000Z',
      leaseToken: null,
      leaseExpiresAt: null,
      sentAt: null,
      telegramMessageId: null,
      lastError: null,
      adminAlertedAt: null,
    });
  });

  it('is replay-safe and does not create a duplicate entry', async () => {
    let createCalls = 0;
    const tx = {
      adminAuditLog: {
        findUnique: async () => ({ id: 'existing' }),
        create: async () => {
          createCalls += 1;
          return { id: 'unexpected' };
        },
      },
    };

    const result = await enqueueTelegramOutbox(tx, {
      eventType: 'PAYMENT_RECEIVED',
      orderId: 'order_1',
      orderCode: 'DH001',
      payload: { text: 'Đã thanh toán' },
    });

    assert.equal(result.created, false);
    assert.equal(result.id, 'existing');
    assert.equal(createCalls, 0);
  });

  it('persists only allowed delivery fields and never a bot token', async () => {
    let stored: Record<string, unknown> | undefined;
    const tx = {
      adminAuditLog: {
        findUnique: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          stored = data;
          return { id: 'outbox_2', ...data };
        },
      },
    };

    await enqueueTelegramOutbox(tx, {
      eventType: 'ORDER_CREATED',
      orderId: 'order_2',
      orderCode: 'DH002',
      payload: {
        text: 'Hello',
        chatId: '123',
        botToken: 'must-not-persist',
      } as unknown as { text: string; chatId?: string },
    });

    assert.doesNotMatch(JSON.stringify(stored), /must-not-persist|botToken/);
  });

  it('propagates persistence failures so the surrounding transaction can roll back', async () => {
    const tx = {
      adminAuditLog: {
        findUnique: async () => null,
        create: async () => {
          throw new Error('database unavailable');
        },
      },
    };

    await assert.rejects(
      enqueueTelegramOutbox(tx, {
        eventType: 'ORDER_CREATED',
        orderId: 'order_3',
        orderCode: 'DH003',
        payload: { text: 'Hello' },
      }),
      /database unavailable/
    );
  });

  it('renders new-order messages from the frozen order-item product name', async () => {
    let stored: Record<string, unknown> | undefined;
    const tx = {
      adminAuditLog: {
        findUnique: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          stored = data;
          return { id: 'outbox_order_created', ...data };
        },
      },
    };

    await enqueueOrderCreatedTelegram(tx, {
      id: 'order_4',
      orderCode: 'DH004',
      customerName: 'Nguyễn Văn A',
      customerPhone: '0900000000',
      customerAddress: 'Hồ Chí Minh',
      subtotal: 1_000_000n,
      shippingFee: 30_000n,
      discountAmount: 0n,
      couponCode: null,
      totalAmount: 1_030_000n,
      items: [
        {
          productName: 'Laptop Frozen Snapshot',
          variantTitle: 'RAM 16GB',
          quantity: 1,
          price: 1_000_000n,
        },
      ],
    });

    const afterState = stored?.afterState as { payload: { text: string } };
    assert.match(afterState.payload.text, /Laptop Frozen Snapshot/);
    assert.doesNotMatch(afterState.payload.text, /• Sản phẩm(?: \(| x )/);
  });

  it('renders and enqueues a deterministic payment-received event', async () => {
    let stored: Record<string, unknown> | undefined;
    const tx = {
      adminAuditLog: {
        findUnique: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          stored = data;
          return { id: 'outbox_paid', ...data };
        },
      },
    };

    await enqueuePaymentReceivedTelegram(tx, {
      id: 'order_paid',
      orderCode: 'DHPAID',
      customerName: 'Khách hàng',
      totalAmount: 500_000n,
      paymentMethod: 'Ví Shop',
    });

    assert.equal(stored?.operationKey, 'telegram:payment-received:order_paid');
    const state = stored?.afterState as { eventType: string; payload: { text: string } };
    assert.equal(state.eventType, 'PAYMENT_RECEIVED');
    assert.match(state.payload.text, /DHPAID/);
    assert.match(state.payload.text, /Ví Shop/);
  });
});
