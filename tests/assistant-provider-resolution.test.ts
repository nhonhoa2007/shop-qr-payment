import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAssistantProvider,
  setAssistantProvider,
  resolveDefaultAiProvider,
} from '../src/server/modules/assistant/assistant.controller.ts';
import { FakeAiProvider } from '../src/server/infrastructure/ai/fake-provider.ts';
import { CustomHttpAiProvider } from '../src/server/infrastructure/ai/custom-http-provider.ts';

describe('Assistant Controller - Provider Resolution', () => {
  const originalBaseUrl = process.env.AI_API_BASE_URL;
  const originalApiKey = process.env.AI_API_KEY;

  afterEach(() => {
    process.env.AI_API_BASE_URL = originalBaseUrl;
    process.env.AI_API_KEY = originalApiKey;
    setAssistantProvider(null);
  });

  it('returns FakeAiProvider when AI credentials are not configured in environment', () => {
    delete process.env.AI_API_BASE_URL;
    delete process.env.AI_API_KEY;
    const provider = resolveDefaultAiProvider();
    assert.ok(provider instanceof FakeAiProvider);
    assert.ok(getAssistantProvider() instanceof FakeAiProvider);
  });

  it('returns CustomHttpAiProvider when AI_API_BASE_URL or AI_API_KEY is configured', () => {
    process.env.AI_API_BASE_URL = 'https://my-llm.com/api/v1';
    process.env.AI_API_KEY = 'test-token';
    const provider = resolveDefaultAiProvider();
    assert.ok(provider instanceof CustomHttpAiProvider);
    assert.ok(getAssistantProvider() instanceof CustomHttpAiProvider);
  });

  it('respects explicitly injected provider via setAssistantProvider', () => {
    const customMock = new FakeAiProvider({ defaultModel: 'mock-model' });
    setAssistantProvider(customMock);
    assert.equal(getAssistantProvider(), customMock);
  });
});
