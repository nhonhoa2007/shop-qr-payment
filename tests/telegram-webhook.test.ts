import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '@server/modules/telegram/telegram-webhook.controller';

describe('Telegram Webhook Controller - Security & Routing', () => {
  const originalSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const originalChatId = process.env.TELEGRAM_CHAT_ID;

  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'secret_token_abc_123';
    process.env.TELEGRAM_CHAT_ID = '123456789';
  });

  afterEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = originalSecret;
    process.env.TELEGRAM_CHAT_ID = originalChatId;
  });

  it('should reject requests with 401 when secret token header is missing', async () => {
    const req = new Request('http://localhost:3000/api/webhooks/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ update_id: 1 }),
    });

    const res = await POST(req);
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.match(json.error, /Unauthorized/i);
  });

  it('should reject requests with 401 when secret token header does not match', async () => {
    const req = new Request('http://localhost:3000/api/webhooks/telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'wrong_secret_token',
      },
      body: JSON.stringify({ update_id: 1 }),
    });

    const res = await POST(req);
    assert.equal(res.status, 401);
  });

  it('should accept valid secret token and ignore non-callback updates safely', async () => {
    const req = new Request('http://localhost:3000/api/webhooks/telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'secret_token_abc_123',
      },
      body: JSON.stringify({
        update_id: 2,
        message: { text: 'Hello bot' },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.ignored, true);
  });

  it('should reject unauthorized user callback and answer with alert', async () => {
    let answeredAlert = '';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      if (body.callback_query_id) {
        answeredAlert = body.text;
      }
      return new Response(JSON.stringify({ ok: true, result: true }), { status: 200 });
    };

    try {
      const req = new Request('http://localhost:3000/api/webhooks/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-bot-api-secret-token': 'secret_token_abc_123',
        },
        body: JSON.stringify({
          update_id: 3,
          callback_query: {
            id: 'query_unauthorized_1',
            from: { id: 999999, first_name: 'Stranger' },
            message: { message_id: 10, chat: { id: 888888 } },
            data: 'approve_order:order_123',
          },
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.ok, false);
      assert.match(answeredAlert, /không có quyền/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
