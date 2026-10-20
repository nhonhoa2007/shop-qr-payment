import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CustomHttpAiProvider,
  normalizeChatCompletionsUrl,
  extractJsonFromLlmText,
} from '../src/server/infrastructure/ai/custom-http-provider.ts';

describe('CustomHttpAiProvider - URL Normalization & JSON Parser', () => {
  it('normalizes various base URL formats correctly', () => {
    assert.equal(
      normalizeChatCompletionsUrl('https://api.openai.com/v1'),
      'https://api.openai.com/v1/chat/completions'
    );
    assert.equal(
      normalizeChatCompletionsUrl('https://api.openai.com/v1/'),
      'https://api.openai.com/v1/chat/completions'
    );
    assert.equal(
      normalizeChatCompletionsUrl('https://my-llm.com/api/v1/chat/completions'),
      'https://my-llm.com/api/v1/chat/completions'
    );
    assert.equal(
      normalizeChatCompletionsUrl('https://my-llm.com/api/v1/chat/completions/'),
      'https://my-llm.com/api/v1/chat/completions'
    );
  });

  it('extracts raw JSON and markdown code fence JSON cleanly', () => {
    const raw = '{"answer": "Tốt", "citations": []}';
    assert.deepEqual(extractJsonFromLlmText(raw), { answer: 'Tốt', citations: [] });

    const fenced = '```json\n{"answer": "Tốt", "citations": []}\n```';
    assert.deepEqual(extractJsonFromLlmText(fenced), { answer: 'Tốt', citations: [] });

    const malformed = 'Not a json';
    assert.equal(extractJsonFromLlmText(malformed), null);
  });
});

describe('CustomHttpAiProvider - Generation & Transport Contract', () => {
  it('dispatches request with correct headers, model, and body', async () => {
    const originalFetch = globalThis.fetch;
    let interceptedUrl = '';
    let interceptedHeaders: any = null;
    let interceptedBody: any = null;

    globalThis.fetch = async (url, init) => {
      interceptedUrl = String(url);
      interceptedHeaders = init?.headers;
      interceptedBody = JSON.parse(String(init?.body || '{}'));
      return new Response(
        JSON.stringify({
          id: 'chatcmpl-test',
          model: 'custom-model-v1',
          choices: [
            {
              message: { role: 'assistant', content: '{"answer": "Gợi ý laptop", "citations": []}' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      const provider = new CustomHttpAiProvider({
        baseUrl: 'https://test-provider.com/api/v1',
        apiKey: 'secret-key-123',
        model: 'custom-model-v1',
      });

      const res = await provider.generate(
        {
          messages: [{ role: 'user', content: 'Xin chào' }],
          responseFormat: 'json',
        },
        { signal: new AbortController().signal }
      );

      assert.equal(interceptedUrl, 'https://test-provider.com/api/v1/chat/completions');
      assert.equal(interceptedHeaders?.['Authorization'] || interceptedHeaders?.['authorization'], 'Bearer secret-key-123');
      assert.equal(interceptedBody.model, 'custom-model-v1');
      assert.equal(res.finishReason, 'stop');
      assert.deepEqual(res.parsedJson, { answer: 'Gợi ý laptop', citations: [] });
      assert.equal(res.usage.totalTokens, 130);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('fails gracefully without throwing when API key or base URL is missing', async () => {
    const provider = new CustomHttpAiProvider({ baseUrl: '', apiKey: '' });
    const res = await provider.generate(
      { messages: [{ role: 'user', content: 'Test' }] },
      { signal: new AbortController().signal }
    );
    assert.equal(res.finishReason, 'error');
    assert.equal(res.parsedJson, null);
  });
});
