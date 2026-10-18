/**
 * Fake AI Provider for Offline Testing & Verification
 *
 * Guarantees zero external network dependencies, deterministic behavior,
 * and support for scripted responses for eval and edge-case testing.
 */

import {
  DEFAULT_AI_MODEL,
  type AiGenerationRequest,
  type AiGenerationResult,
  type AiProvider,
} from './provider.ts';

export interface FakeAiProviderOptions {
  defaultModel?: string;
  simulatedLatencyMs?: number;
}

export class FakeAiProvider implements AiProvider {
  public readonly providerName = 'fake';
  private defaultModel: string;
  private simulatedLatencyMs: number;
  private queue: Partial<AiGenerationResult>[] = [];

  constructor(options: FakeAiProviderOptions = {}) {
    this.defaultModel = options.defaultModel || DEFAULT_AI_MODEL;
    this.simulatedLatencyMs = options.simulatedLatencyMs || 0;
  }

  public enqueueResponse(response: Partial<AiGenerationResult>): void {
    this.queue.push(response);
  }

  public clearQueue(): void {
    this.queue = [];
  }

  async generate(
    input: AiGenerationRequest,
    options: { signal: AbortSignal }
  ): Promise<AiGenerationResult> {
    if (options.signal.aborted) {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    }

    if (this.simulatedLatencyMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          options.signal.removeEventListener('abort', onAbort);
          resolve();
        }, this.simulatedLatencyMs);

        const onAbort = () => {
          clearTimeout(timer);
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        };

        options.signal.addEventListener('abort', onAbort, { once: true });
      });
    }

    const queued = this.queue.shift();
    const model = queued?.model || input.model || this.defaultModel;

    let text: string;
    let finishReason: 'stop' | 'length' | 'refusal' | 'error' | 'timeout' = 'stop';
    let refusal: string | undefined = undefined;

    if (queued) {
      text = queued.text ?? '';
      finishReason = queued.finishReason ?? 'stop';
      refusal = queued.refusal;
    } else {
      const lastUserMsg = [...input.messages].reverse().find((m) => m.role === 'user');
      const query = lastUserMsg?.content || 'default query';

      if (input.responseFormat === 'json') {
        text = JSON.stringify({
          answer: `Phân tích dựa trên bằng chứng: ${query}`,
          recommendations: [],
          citations: [],
          claims: [],
        });
      } else {
        text = `Phản hồi mẫu cho truy vấn: ${query}`;
      }
    }

    let parsedJson: unknown | null = null;
    if (input.responseFormat === 'json' && text) {
      try {
        parsedJson = JSON.parse(text);
      } catch {
        parsedJson = null;
      }
    }

    const promptTokens =
      queued?.usage?.promptTokens ??
      Math.max(1, input.messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 10));
    const completionTokens =
      queued?.usage?.completionTokens ?? Math.max(1, Math.ceil(text.length / 4));
    const totalTokens = queued?.usage?.totalTokens ?? promptTokens + completionTokens;
    const latencyMs = queued?.usage?.latencyMs ?? Math.max(1, this.simulatedLatencyMs);

    return {
      text,
      parsedJson,
      model,
      provider: this.providerName,
      finishReason,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs,
      },
      refusal,
    };
  }
}
