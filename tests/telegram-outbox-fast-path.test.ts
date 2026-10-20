import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleTelegramOutboxFastPath } from '@server/modules/telegram/telegram-outbox.fast-path';

describe('Telegram outbox fast path', () => {
  it('schedules one bounded worker pass after the response lifecycle', async () => {
    let callback: (() => Promise<void>) | undefined;
    let receivedBatchSize = 0;

    scheduleTelegramOutboxFastPath({
      schedule: (task) => { callback = task; },
      processor: async ({ batchSize }) => {
        receivedBatchSize = batchSize || 0;
        return { scanned: 0, claimed: 0, sent: 0, retried: 0, failed: 0, skipped: 0 };
      },
    });

    assert.ok(callback);
    await callback();
    assert.equal(receivedBatchSize, 10);
  });

  it('contains worker failures so they cannot alter the business response', async () => {
    let callback: (() => Promise<void>) | undefined;
    scheduleTelegramOutboxFastPath({
      schedule: (task) => { callback = task; },
      processor: async () => { throw new Error('worker unavailable'); },
    });

    assert.ok(callback);
    await assert.doesNotReject(callback());
  });
});
