import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTelegramOutboxDocument,
  getNextTelegramAttempt,
  getTelegramOutboxOperationKey,
} from '@server/modules/telegram/telegram-outbox.policy';
import { parseTelegramOutboxDocument } from '@server/modules/telegram/telegram-outbox.types';

describe('Telegram outbox policy', () => {
  const now = new Date('2026-10-20T00:00:00.000Z');

  it('creates a versioned pending document with a fixed 24-hour deadline', () => {
    const doc = createTelegramOutboxDocument(
      {
        eventType: 'ORDER_CREATED',
        payload: { text: 'Order created' },
      },
      now
    );

    assert.equal(doc.kind, 'TELEGRAM_OUTBOX');
    assert.equal(doc.version, 1);
    assert.equal(doc.status, 'PENDING');
    assert.equal(doc.nextAttemptAt, '2026-10-20T00:00:00.000Z');
    assert.equal(doc.expiresAt, '2026-10-21T00:00:00.000Z');
    assert.deepEqual(parseTelegramOutboxDocument(doc), doc);
  });

  it('uses deterministic event and order identifiers', () => {
    assert.equal(
      getTelegramOutboxOperationKey('PAYMENT_RECEIVED', 'order_123'),
      'telegram:payment-received:order_123'
    );
  });

  it('uses the specified bounded retry schedule', () => {
    const expiresAt = new Date('2026-10-21T00:00:00.000Z');
    const expectedMinutes = [1, 2, 5, 10, 30, 60, 60];

    expectedMinutes.forEach((minutes, index) => {
      assert.equal(
        getNextTelegramAttempt(index + 1, now, expiresAt)?.toISOString(),
        new Date(now.getTime() + minutes * 60_000).toISOString()
      );
    });
  });

  it('honors a longer Telegram retry_after value', () => {
    const expiresAt = new Date('2026-10-21T00:00:00.000Z');
    assert.equal(
      getNextTelegramAttempt(1, now, expiresAt, 600)?.toISOString(),
      '2026-10-20T00:10:00.000Z'
    );
  });

  it('does not schedule an attempt at or after the expiry deadline', () => {
    const expiresAt = new Date('2026-10-20T00:00:30.000Z');
    assert.equal(getNextTelegramAttempt(1, now, expiresAt), null);
  });

  it('rejects malformed, unknown-version, and secret-bearing documents', () => {
    assert.equal(parseTelegramOutboxDocument(null), null);
    assert.equal(parseTelegramOutboxDocument({ kind: 'TELEGRAM_OUTBOX', version: 2 }), null);
    assert.equal(
      parseTelegramOutboxDocument({
        ...createTelegramOutboxDocument(
          { eventType: 'ORDER_CREATED', payload: { text: 'Hello' } },
          now
        ),
        payload: { text: 'Hello', botToken: 'must-not-persist' },
      }),
      null
    );
  });
});
