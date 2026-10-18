/**
 * Provider-Neutral AI Interface
 *
 * Defines uniform request, response, usage, and provider abstraction contracts.
 * Transport implementation details (HTTP endpoint, headers, payload mapping)
 * remain decoupled behind this contract. Real transport is blocked until
 * official endpoint/request-response/auth documentation is confirmed.
 */

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiGenerationRequest {
  model?: string;
  messages: AiMessage[];
  systemPrompt?: string;
  evidenceBundle?: unknown;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
  latencyMs: number;
}

export interface AiGenerationResult {
  text: string;
  parsedJson?: unknown | null;
  model: string;
  provider: string;
  finishReason: 'stop' | 'length' | 'refusal' | 'error' | 'timeout';
  usage: AiUsage;
  refusal?: string;
}

export interface AiProvider {
  readonly providerName: string;
  generate(
    input: AiGenerationRequest,
    options: { signal: AbortSignal }
  ): Promise<AiGenerationResult>;
}

export const DEFAULT_AI_MODEL = process.env.AI_DEFAULT_MODEL || 'ag/gemini-3.8-flash-high';
