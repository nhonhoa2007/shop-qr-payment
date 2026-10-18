import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FakeAiProvider } from '../src/server/infrastructure/ai/fake-provider.ts';
import type { AiGenerationRequest } from '../src/server/infrastructure/ai/provider.ts';

describe('AI Infrastructure: Provider Contract & Fake Adapter', () => {
  it('generates standard response with model, text and usage', async () => {
    const provider = new FakeAiProvider({
      defaultModel: 'ag/gemini-3.8-flash-high',
    });

    const request: AiGenerationRequest = {
      model: 'ag/gemini-3.8-flash-high',
      messages: [{ role: 'user', content: 'So sánh laptop văn phòng' }],
    };

    const controller = new AbortController();
    const result = await provider.generate(request, { signal: controller.signal });

    assert.equal(result.model, 'ag/gemini-3.8-flash-high');
    assert.equal(result.finishReason, 'stop');
    assert.ok(result.text.length > 0);
    assert.ok(result.usage.promptTokens > 0);
    assert.ok(result.usage.completionTokens > 0);
    assert.ok(result.usage.totalTokens >= result.usage.promptTokens + result.usage.completionTokens);
    assert.ok(result.usage.latencyMs >= 0);
  });

  it('supports scripted responses for testing deterministic workflows', async () => {
    const scriptedText = JSON.stringify({
      answer: 'MacBook Air M2 phù hợp văn phòng nhất trong tầm giá',
      citations: ['src_benchmark_1'],
    });

    const provider = new FakeAiProvider();
    provider.enqueueResponse({
      text: scriptedText,
      model: 'ag/gemini-3.8-flash-high',
      finishReason: 'stop',
      usage: {
        promptTokens: 120,
        completionTokens: 45,
        totalTokens: 165,
        latencyMs: 15,
      },
    });

    const request: AiGenerationRequest = {
      model: 'ag/gemini-3.8-flash-high',
      messages: [{ role: 'user', content: 'Tư vấn MacBook' }],
      responseFormat: 'json',
    };

    const controller = new AbortController();
    const result = await provider.generate(request, { signal: controller.signal });

    assert.equal(result.text, scriptedText);
    assert.deepEqual(result.parsedJson, {
      answer: 'MacBook Air M2 phù hợp văn phòng nhất trong tầm giá',
      citations: ['src_benchmark_1'],
    });
    assert.equal(result.usage.totalTokens, 165);
  });

  it('returns parsedJson as null when response format is json but text is malformed', async () => {
    const provider = new FakeAiProvider();
    provider.enqueueResponse({
      text: '{ malformed json: not valid',
      model: 'ag/gemini-3.8-flash-high',
      finishReason: 'stop',
      usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60, latencyMs: 5 },
    });

    const request: AiGenerationRequest = {
      messages: [{ role: 'user', content: 'Test malformed' }],
      responseFormat: 'json',
    };

    const controller = new AbortController();
    const result = await provider.generate(request, { signal: controller.signal });

    assert.equal(result.parsedJson, null);
    assert.equal(result.finishReason, 'stop');
  });

  it('handles provider refusal properly', async () => {
    const provider = new FakeAiProvider();
    provider.enqueueResponse({
      text: '',
      model: 'ag/gemini-3.8-flash-high',
      finishReason: 'refusal',
      refusal: 'I cannot provide purchasing advice for unlicensed explosives.',
      usage: { promptTokens: 20, completionTokens: 0, totalTokens: 20, latencyMs: 2 },
    });

    const request: AiGenerationRequest = {
      messages: [{ role: 'user', content: 'Illegal item' }],
    };

    const controller = new AbortController();
    const result = await provider.generate(request, { signal: controller.signal });

    assert.equal(result.finishReason, 'refusal');
    assert.equal(result.refusal, 'I cannot provide purchasing advice for unlicensed explosives.');
  });

  it('aborts immediately when AbortSignal is already aborted', async () => {
    const provider = new FakeAiProvider();
    const controller = new AbortController();
    controller.abort(new Error('Operation cancelled by user'));

    const request: AiGenerationRequest = {
      messages: [{ role: 'user', content: 'Fast cancel' }],
    };

    await assert.rejects(
      async () => {
        await provider.generate(request, { signal: controller.signal });
      },
      (err: Error) => {
        return err.name === 'AbortError' || err.message.includes('cancelled');
      }
    );
  });

  it('aborts during simulated latency when signal is triggered', async () => {
    const provider = new FakeAiProvider({ simulatedLatencyMs: 100 });
    const controller = new AbortController();

    const request: AiGenerationRequest = {
      messages: [{ role: 'user', content: 'Slow request' }],
    };

    const promise = provider.generate(request, { signal: controller.signal });
    setTimeout(() => controller.abort(), 10);

    await assert.rejects(
      async () => {
        await promise;
      },
      (err: Error) => err.name === 'AbortError'
    );
  });

  it('does not make external network requests', async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('Network prohibited in unit tests');
    };

    try {
      const provider = new FakeAiProvider();
      const controller = new AbortController();
      await provider.generate(
        { messages: [{ role: 'user', content: 'Check offline guarantee' }] },
        { signal: controller.signal }
      );
      assert.equal(fetchCalled, false, 'FakeAiProvider must be completely network-free');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
