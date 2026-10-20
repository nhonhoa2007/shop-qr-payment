/**
 * Configurable Custom HTTP AI Provider (OpenAI-compatible /api/v1)
 *
 * Implements standard chat completions transport with configurable
 * base URL, API key, model name, and robust JSON parsing.
 */

import {
  DEFAULT_AI_MODEL,
  type AiGenerationRequest,
  type AiGenerationResult,
  type AiProvider,
  type AiUsage,
} from './provider.ts';

export interface CustomHttpAiProviderOptions {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

/**
 * Normalizes any given base URL to standard /chat/completions endpoint
 */
export function normalizeChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}

/**
 * Robustly extracts JSON object/array from LLM response text,
 * handling raw JSON strings as well as markdown code fences.
 */
export function extractJsonFromLlmText(text: string): unknown | null {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();

  // 1. Direct JSON parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue to markdown fence parsing
  }

  // 2. Extract from markdown code fence ```json ... ``` or ``` ... ```
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // invalid JSON inside fence
    }
  }

  // 3. Fallback: locate first '{' and last '}'
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {
      // not a valid JSON slice
    }
  }

  return null;
}

export class CustomHttpAiProvider implements AiProvider {
  public readonly providerName = 'custom-http';
  private baseUrl: string;
  private apiKey: string;
  private defaultModel: string;
  private defaultTimeoutMs: number;

  constructor(options: CustomHttpAiProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.AI_API_BASE_URL ?? '').trim();
    this.apiKey = (options.apiKey ?? process.env.AI_API_KEY ?? '').trim();
    this.defaultModel = options.model || process.env.AI_MODEL_NAME || DEFAULT_AI_MODEL;
    this.defaultTimeoutMs =
      options.timeoutMs ||
      (process.env.AI_TIMEOUT_MS ? Number(process.env.AI_TIMEOUT_MS) : 20000);
  }

  async generate(
    input: AiGenerationRequest,
    options: { signal: AbortSignal }
  ): Promise<AiGenerationResult> {
    const startTime = Date.now();
    const model = input.model || this.defaultModel;

    // Fail-safe check: missing base URL or API key
    if (!this.baseUrl || !this.apiKey) {
      return {
        text: '',
        parsedJson: null,
        model,
        provider: this.providerName,
        finishReason: 'error',
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          latencyMs: Date.now() - startTime,
        },
      };
    }

    const endpointUrl = normalizeChatCompletionsUrl(this.baseUrl);

    // Prepare messages array for OpenAI-compatible chat completions
    const formattedMessages: Array<{ role: string; content: string }> = [];

    if (input.systemPrompt) {
      formattedMessages.push({ role: 'system', content: input.systemPrompt });
    }

    for (const msg of input.messages) {
      formattedMessages.push({ role: msg.role, content: msg.content });
    }

    const payload: Record<string, unknown> = {
      model,
      messages: formattedMessages,
      temperature: input.temperature ?? 0.2,
      max_tokens: input.maxTokens ?? 1500,
    };

    if (input.responseFormat === 'json') {
      payload.response_format = { type: 'json_object' };
    }

    // Combine caller signal with timeout signal
    const timeoutController = new AbortController();
    const timer = setTimeout(() => {
      timeoutController.abort(new Error('AI Request Timeout'));
    }, this.defaultTimeoutMs);

    const onCallerAbort = () => {
      clearTimeout(timer);
      timeoutController.abort(options.signal.reason);
    };
    options.signal.addEventListener('abort', onCallerAbort, { once: true });

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: timeoutController.signal,
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        console.error(
          `[CustomHttpAiProvider] HTTP ${response.status} from ${endpointUrl}`
        );
        return {
          text: '',
          parsedJson: null,
          model,
          provider: this.providerName,
          finishReason: 'error',
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            latencyMs,
          },
        };
      }

      const data = await response.json().catch(() => null);
      if (!data || !Array.isArray(data.choices) || data.choices.length === 0) {
        return {
          text: '',
          parsedJson: null,
          model,
          provider: this.providerName,
          finishReason: 'error',
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            latencyMs,
          },
        };
      }

      const choice = data.choices[0];
      const text = choice.message?.content || '';
      const rawFinish = choice.finish_reason;
      let finishReason: AiGenerationResult['finishReason'] = 'stop';
      if (rawFinish === 'length') finishReason = 'length';
      else if (rawFinish === 'content_filter' || rawFinish === 'refusal') finishReason = 'refusal';

      let parsedJson: unknown | null = null;
      if (input.responseFormat === 'json') {
        parsedJson = extractJsonFromLlmText(text);
      }

      const promptTokens = data.usage?.prompt_tokens ?? 0;
      const completionTokens = data.usage?.completion_tokens ?? 0;
      const totalTokens = data.usage?.total_tokens ?? promptTokens + completionTokens;

      const usage: AiUsage = {
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs,
      };

      return {
        text,
        parsedJson,
        model: data.model || model,
        provider: this.providerName,
        finishReason,
        usage,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const isTimeout =
        err instanceof Error &&
        (err.name === 'AbortError' || err.message.includes('Timeout'));

      console.error(
        `[CustomHttpAiProvider] Request error: ${err instanceof Error ? err.message : String(err)}`
      );

      return {
        text: '',
        parsedJson: null,
        model,
        provider: this.providerName,
        finishReason: isTimeout ? 'timeout' : 'error',
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          latencyMs,
        },
      };
    } finally {
      clearTimeout(timer);
      options.signal.removeEventListener('abort', onCallerAbort);
    }
  }
}
