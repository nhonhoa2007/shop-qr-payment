import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramOutboxHandler } from '@server/modules/telegram/telegram-outbox.controller';

describe('Telegram outbox cron controller', () => {
  const originalSecret = process.env.CRON_SECRET;
  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it('fails closed when CRON_SECRET is missing', async () => {
    delete process.env.CRON_SECRET;
    const handler = createTelegramOutboxHandler(async () => {
      throw new Error('must not run');
    });
    const response = await handler(new Request('http://localhost/api/cron/process-telegram-outbox'));
    assert.equal(response.status, 401);
  });

  it('rejects an invalid bearer token', async () => {
    process.env.CRON_SECRET = 'correct-secret';
    const handler = createTelegramOutboxHandler(async () => {
      throw new Error('must not run');
    });
    const response = await handler(
      new Request('http://localhost/api/cron/process-telegram-outbox', {
        headers: { authorization: 'Bearer wrong-secret' },
      })
    );
    assert.equal(response.status, 401);
  });

  it('returns aggregate processing counts for an authorized request', async () => {
    process.env.CRON_SECRET = 'correct-secret';
    const counts = { scanned: 3, claimed: 2, sent: 1, retried: 1, failed: 0, skipped: 1 };
    const handler = createTelegramOutboxHandler(async () => counts);
    const response = await handler(
      new Request('http://localhost/api/cron/process-telegram-outbox', {
        headers: { authorization: 'Bearer correct-secret' },
      })
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, ...counts });
  });

  it('returns 500 without exposing internals when processing fails', async () => {
    process.env.CRON_SECRET = 'correct-secret';
    const handler = createTelegramOutboxHandler(async () => {
      throw new Error('database password must stay private');
    });
    const response = await handler(
      new Request('http://localhost/api/cron/process-telegram-outbox', {
        method: 'POST',
        headers: { authorization: 'Bearer correct-secret' },
      })
    );
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Telegram outbox processing failed' });
  });
});
