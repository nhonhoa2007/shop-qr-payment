import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { processTelegramOutbox } from '@server/modules/telegram/telegram-outbox.service';
import { createTelegramOutboxDocument } from '@server/modules/telegram/telegram-outbox.policy';

type Row = {
  id: string;
  operationKey: string;
  action: string;
  entityId: string;
  afterState: unknown;
  metadata: unknown;
  reason: string | null;
  createdAt: Date;
};

function createFakeDb(initialRows: Row[]) {
  const rows = structuredClone(initialRows) as Row[];
  const notifications: Array<Record<string, unknown>> = [];
  const db = {
    rows,
    notifications,
    adminAuditLog: {
      findMany: async (args: Record<string, unknown>) => {
        const where = (args.where || {}) as {
          action?: string;
          OR?: Array<{ afterState?: { path?: string[]; equals?: string } }>;
        };
        const allowedStatuses = where.OR
          ?.map((filter) => filter.afterState?.equals)
          .filter((status): status is string => typeof status === 'string');
        const candidates = rows.filter((row) => {
          if (where.action && row.action !== where.action) return false;
          if (!allowedStatuses?.length) return true;
          const status = (row.afterState as { status?: unknown } | null)?.status;
          return allowedStatuses.includes(String(status));
        });
        return candidates.slice(0, Number(args.take ?? candidates.length));
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const row = rows.find((candidate) => candidate.id === where.id);
        const expectedState = (where.afterState as { equals?: unknown } | undefined)?.equals;
        if (!row || JSON.stringify(row.afterState) !== JSON.stringify(expectedState)) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    user: {
      findMany: async () => [{ id: 'admin_1' }, { id: 'admin_2' }],
    },
    notification: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const notification = {
          id: `notification_${notifications.length + 1}`,
          createdAt: new Date('2026-10-20T00:00:00.000Z'),
          ...data,
        };
        notifications.push(notification);
        return notification;
      },
      count: async ({ where }: { where: { userId: string; isRead: boolean } }) =>
        notifications.filter(
          (notification) =>
            notification.userId === where.userId &&
            Boolean(notification.isRead ?? false) === where.isRead
        ).length,
    },
    $transaction: async <T>(callback: (tx: typeof db) => Promise<T>) => callback(db),
  };
  return db;
}

function pendingRow(overrides: Partial<Row> = {}): Row {
  const now = new Date('2026-10-20T00:00:00.000Z');
  return {
    id: 'outbox_1',
    operationKey: 'telegram:order-created:order_1',
    action: 'TELEGRAM_OUTBOX',
    entityId: 'order_1',
    afterState: createTelegramOutboxDocument(
      { eventType: 'ORDER_CREATED', payload: { text: 'Hello' } },
      now
    ),
    metadata: { eventType: 'ORDER_CREATED', orderCode: 'DH001' },
    reason: null,
    createdAt: now,
    ...overrides,
  };
}

describe('Telegram outbox worker', () => {
  const now = new Date('2026-10-20T00:00:00.000Z');

  it('claims a due row and persists the Telegram message id on success', async () => {
    const db = createFakeDb([pendingRow()]);
    const result = await processTelegramOutbox({
      db,
      now: () => now,
      randomUUID: () => 'lease_1',
      sender: async () => ({ ok: true, messageId: 42, httpStatus: 200 }),
      pusher: { trigger: async () => undefined },
    });

    assert.deepEqual(result, { scanned: 1, claimed: 1, sent: 1, retried: 0, failed: 0, skipped: 0 });
    assert.equal((db.rows[0].afterState as { status: string }).status, 'SENT');
    assert.equal((db.rows[0].afterState as { telegramMessageId: number }).telegramMessageId, 42);
  });

  it('stores a retry using Telegram retry_after when delivery is rate limited', async () => {
    const db = createFakeDb([pendingRow()]);
    await processTelegramOutbox({
      db,
      now: () => now,
      randomUUID: () => 'lease_1',
      sender: async () => ({
        ok: false,
        failureKind: 'RATE_LIMIT',
        description: 'Too many requests',
        httpStatus: 429,
        retryAfterSeconds: 600,
      }),
      pusher: { trigger: async () => undefined },
    });

    const state = db.rows[0].afterState as { status: string; nextAttemptAt: string; attemptCount: number };
    assert.equal(state.status, 'RETRY');
    assert.equal(state.attemptCount, 1);
    assert.equal(state.nextAttemptAt, '2026-10-20T00:10:00.000Z');
  });

  it('does not let a competing worker send a currently leased row', async () => {
    const db = createFakeDb([pendingRow()]);
    let releaseSend!: () => void;
    const waiting = new Promise<void>((resolve) => { releaseSend = resolve; });
    let sendCalls = 0;
    const first = processTelegramOutbox({
      db,
      now: () => now,
      randomUUID: () => 'lease_1',
      sender: async () => {
        sendCalls += 1;
        await waiting;
        return { ok: true, messageId: 1 };
      },
      pusher: { trigger: async () => undefined },
    });
    await new Promise((resolve) => setImmediate(resolve));

    const second = await processTelegramOutbox({
      db,
      now: () => now,
      randomUUID: () => 'lease_2',
      sender: async () => {
        sendCalls += 1;
        return { ok: true, messageId: 2 };
      },
      pusher: { trigger: async () => undefined },
    });
    releaseSend();
    await first;

    assert.equal(second.claimed, 0);
    assert.equal(sendCalls, 1);
  });

  it('reclaims a processing row after its lease expires', async () => {
    const stale = createTelegramOutboxDocument(
      { eventType: 'ORDER_CREATED', payload: { text: 'Hello' } },
      new Date('2026-10-19T23:00:00.000Z')
    );
    stale.status = 'PROCESSING';
    stale.leaseToken = 'dead_worker';
    stale.leaseExpiresAt = '2026-10-19T23:59:00.000Z';
    const db = createFakeDb([pendingRow({ afterState: stale })]);

    const result = await processTelegramOutbox({
      db,
      now: () => now,
      randomUUID: () => 'new_lease',
      sender: async () => ({ ok: true, messageId: 7 }),
      pusher: { trigger: async () => undefined },
    });

    assert.equal(result.sent, 1);
    assert.equal((db.rows[0].afterState as { status: string }).status, 'SENT');
  });

  it('marks an exhausted row failed and creates admin alerts only once even if Pusher fails', async () => {
    const expiredSoon = createTelegramOutboxDocument(
      { eventType: 'PAYMENT_RECEIVED', payload: { text: 'Paid' } },
      new Date('2026-10-19T00:00:30.000Z')
    );
    const db = createFakeDb([pendingRow({ afterState: expiredSoon })]);
    const options = {
      db,
      now: () => now,
      randomUUID: () => 'lease_1',
      sender: async () => ({ ok: false as const, failureKind: 'NETWORK' as const, description: 'offline' }),
      pusher: { trigger: async () => { throw new Error('pusher unavailable'); } },
    };

    const first = await processTelegramOutbox(options);
    const second = await processTelegramOutbox(options);

    assert.equal(first.failed, 1);
    assert.equal(second.claimed, 0);
    assert.equal((db.rows[0].afterState as { status: string }).status, 'FAILED');
    assert.equal(db.notifications.length, 2);
    assert.ok((db.rows[0].afterState as { adminAlertedAt: string | null }).adminAlertedAt);
    assert.ok(db.notifications.every((item) => item.type === 'SYSTEM_ALERT'));
  });

  it('fails closed on malformed outbox JSON instead of leaving it pending forever', async () => {
    const db = createFakeDb([pendingRow({ afterState: { kind: 'TELEGRAM_OUTBOX', version: 99 } })]);
    const result = await processTelegramOutbox({
      db,
      now: () => now,
      randomUUID: () => 'lease_1',
      sender: async () => ({ ok: true }),
      pusher: { trigger: async () => undefined },
    });

    assert.equal(result.failed, 1);
    assert.equal((db.rows[0].afterState as { status: string }).status, 'FAILED');
  });

  it('does not let old terminal rows starve a newer pending delivery', async () => {
    const terminal = createTelegramOutboxDocument(
      { eventType: 'ORDER_CREATED', payload: { text: 'Already sent' } },
      new Date('2026-10-19T00:00:00.000Z')
    );
    terminal.status = 'SENT';
    terminal.sentAt = '2026-10-19T00:01:00.000Z';
    const db = createFakeDb([
      pendingRow({ id: 'old_terminal', afterState: terminal, createdAt: new Date('2026-10-19T00:00:00.000Z') }),
      pendingRow({ id: 'new_pending', operationKey: 'telegram:order-created:order_2' }),
    ]);

    const result = await processTelegramOutbox({
      db,
      batchSize: 1,
      now: () => now,
      randomUUID: () => 'lease_1',
      sender: async () => ({ ok: true, messageId: 99 }),
      pusher: { trigger: async () => undefined },
    });

    assert.equal(result.sent, 1);
    assert.equal((db.rows[1].afterState as { status: string }).status, 'SENT');
  });

  it('pushes admin alerts with the unread count expected by the client', async () => {
    const expiredSoon = createTelegramOutboxDocument(
      { eventType: 'PAYMENT_RECEIVED', payload: { text: 'Paid' } },
      new Date('2026-10-19T00:00:30.000Z')
    );
    const db = createFakeDb([pendingRow({ afterState: expiredSoon, metadata: null })]);
    const pushed: Array<{ channel: string; event: string; data: unknown }> = [];

    await processTelegramOutbox({
      db,
      now: () => now,
      randomUUID: () => 'lease_1',
      sender: async () => ({ ok: false, failureKind: 'NETWORK', description: 'offline' }),
      pusher: {
        trigger: async (channel, event, data) => {
          pushed.push({ channel, event, data });
        },
      },
    });

    const userPushes = pushed.filter((item) => item.event === 'new-notification');
    assert.equal(userPushes.length, 2);
    assert.deepEqual(
      userPushes.map((item) => (item.data as { unreadCount?: number }).unreadCount),
      [1, 1]
    );
    assert.ok(
      db.notifications.every((notification) =>
        !Object.prototype.hasOwnProperty.call(notification.data as object, 'orderCode')
      )
    );
  });
});
