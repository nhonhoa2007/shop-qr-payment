/**
 * Grounded Assistant Conversation & Orchestration Service
 *
 * Implements isolated AI assistant conversations, strict ownership control,
 * 30-day retention with scheduled purge, grounded answer orchestration,
 * quota lease lifecycle, and data/usage redaction.
 */

import { prisma as globalPrisma } from '@server/database/prisma.ts';
import type { AiProvider } from '@server/infrastructure/ai/provider.ts';
import {
  reserveAiBudget,
  settleAiBudget,
  releaseAiBudget,
} from '@server/infrastructure/ai/quota.ts';
import { buildEvidenceBundle } from './evidence.service.ts';
import {
  validateAssistantAnswer,
  buildDeterministicAnswer,
} from './grounding.service.ts';
import type {
  Principal,
  ConversationDto,
  AssistantMessageDto,
  CreateConversationInput,
  AppendMessageInput,
  AnswerInput,
  AssistantAnswerDto,
} from '../../../shared/types/assistant.ts';

export interface AssistantDb {
  assistantConversation: {
    create(args: { data: any }): Promise<any>;
    findUnique(args: { where: { id: string } }): Promise<any | null>;
    findMany(args: { where: Record<string, unknown>; orderBy?: Record<string, unknown> }): Promise<any[]>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<any>;
    delete(args: { where: { id: string } }): Promise<any>;
    deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
  };
  assistantMessage: {
    create(args: { data: any }): Promise<any>;
    findMany(args: {
      where: { conversationId: string };
      orderBy?: Record<string, unknown>;
    }): Promise<any[]>;
  };
  product?: any;
  dataSource?: any;
  benchmarkMeasurement?: any;
  productScoreSnapshot?: any;
}

const RETENTION_DAYS = 30;

function checkConversationOwnership(conv: any, principal: Principal): void {
  if (principal.role === 'ADMIN') {
    return; // Admin bypass for auditing/investigation
  }

  if (conv.userId && principal.userId) {
    if (conv.userId !== principal.userId) {
      throw new Error('FORBIDDEN: User does not own this conversation');
    }
    return;
  }

  if (conv.anonymousTokenHash && principal.anonymousTokenHash) {
    if (conv.anonymousTokenHash !== principal.anonymousTokenHash) {
      throw new Error('FORBIDDEN: Anonymous token mismatch for conversation');
    }
    return;
  }

  throw new Error('FORBIDDEN: Unauthorized conversation access');
}

export async function createConversation(
  principal: Principal,
  input: CreateConversationInput = {},
  db: AssistantDb = globalPrisma as unknown as AssistantDb
): Promise<ConversationDto> {
  const expiresAt = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const title = input.title?.trim() || 'Tư vấn sản phẩm';

  const conv = await db.assistantConversation.create({
    data: {
      userId: principal.userId || null,
      anonymousTokenHash: principal.anonymousTokenHash || null,
      title,
      status: 'ACTIVE',
      expiresAt,
    },
  });

  return {
    id: conv.id,
    userId: conv.userId,
    anonymousTokenHash: conv.anonymousTokenHash,
    title: conv.title,
    createdAt: conv.createdAt.toISOString ? conv.createdAt.toISOString() : String(conv.createdAt),
    updatedAt: conv.updatedAt.toISOString ? conv.updatedAt.toISOString() : String(conv.updatedAt),
    expiresAt: conv.expiresAt.toISOString ? conv.expiresAt.toISOString() : String(conv.expiresAt),
    messagesCount: 0,
  };
}

export async function listUserConversations(
  principal: Principal,
  db: AssistantDb = globalPrisma as unknown as AssistantDb
): Promise<ConversationDto[]> {
  const where: Record<string, unknown> = {
    status: 'ACTIVE',
  };

  if (principal.userId) {
    where.userId = principal.userId;
  } else if (principal.anonymousTokenHash) {
    where.anonymousTokenHash = principal.anonymousTokenHash;
  } else {
    return [];
  }

  const list = await db.assistantConversation.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  });

  return list.map((c) => ({
    id: c.id,
    userId: c.userId,
    anonymousTokenHash: c.anonymousTokenHash,
    title: c.title,
    createdAt: c.createdAt.toISOString ? c.createdAt.toISOString() : String(c.createdAt),
    updatedAt: c.updatedAt.toISOString ? c.updatedAt.toISOString() : String(c.updatedAt),
    expiresAt: c.expiresAt.toISOString ? c.expiresAt.toISOString() : String(c.expiresAt),
    messagesCount: c.messages?.length || 0,
  }));
}

export async function getConversationMessages(
  conversationId: string,
  principal: Principal,
  db: AssistantDb = globalPrisma as unknown as AssistantDb
): Promise<AssistantMessageDto[]> {
  const conv = await db.assistantConversation.findUnique({
    where: { id: conversationId },
  });

  if (!conv) {
    throw new Error('NOT_FOUND: Conversation not found');
  }

  checkConversationOwnership(conv, principal);

  const rawMessages = await db.assistantMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });

  return rawMessages.map((m) => ({
    id: m.id,
    conversationId: m.conversationId,
    role: m.role as 'USER' | 'ASSISTANT',
    content: m.content,
    followUpQuestion: m.followUpQuestion,
    citations: Array.isArray(m.citations) ? m.citations : [],
    claims: Array.isArray(m.claims) ? m.claims : [],
    usage: m.usage || null,
    isGrounded: Boolean(m.isGrounded),
    fallbackReason: m.fallbackReason,
    createdAt: m.createdAt.toISOString ? m.createdAt.toISOString() : String(m.createdAt),
  }));
}

export async function appendUserMessage(
  input: AppendMessageInput,
  principal: Principal,
  db: AssistantDb = globalPrisma as unknown as AssistantDb
): Promise<AssistantMessageDto> {
  const conv = await db.assistantConversation.findUnique({
    where: { id: input.conversationId },
  });

  if (!conv) {
    throw new Error('NOT_FOUND: Conversation not found');
  }

  checkConversationOwnership(conv, principal);

  const msg = await db.assistantMessage.create({
    data: {
      conversationId: input.conversationId,
      role: input.role || 'USER',
      content: input.content.trim(),
      isGrounded: true,
    },
  });

  await db.assistantConversation.update({
    where: { id: input.conversationId },
    data: { updatedAt: new Date() },
  });

  return {
    id: msg.id,
    conversationId: msg.conversationId,
    role: msg.role as 'USER' | 'ASSISTANT',
    content: msg.content,
    citations: [],
    claims: [],
    usage: null,
    isGrounded: true,
    createdAt: msg.createdAt.toISOString ? msg.createdAt.toISOString() : String(msg.createdAt),
  };
}

export async function answerQuestion(
  input: AnswerInput,
  principal: Principal,
  provider: AiProvider,
  signal: AbortSignal,
  db: AssistantDb = globalPrisma as unknown as AssistantDb
): Promise<AssistantAnswerDto> {
  const conv = await db.assistantConversation.findUnique({
    where: { id: input.conversationId },
  });

  if (!conv) {
    throw new Error('NOT_FOUND: Conversation not found');
  }

  checkConversationOwnership(conv, principal);

  // 1. Append user question to history
  await db.assistantMessage.create({
    data: {
      conversationId: input.conversationId,
      role: 'USER',
      content: input.content.trim(),
      isGrounded: true,
    },
  });

  // 2. Reserve budget quota fail-closed
  const lease = await reserveAiBudget({
    userId: principal.userId || undefined,
    anonymousTokenHash: principal.anonymousTokenHash || undefined,
    ip: principal.ip,
  });

  if (!lease.granted) {
    const rateLimitFallback: AssistantAnswerDto = {
      conversationId: conv.id,
      answer:
        'Hệ thống đang tiếp nhận lượng truy vấn lớn hoặc bạn đã chạm giới hạn yêu cầu tạm thời. Vui lòng thử lại sau ít phút.',
      followUpQuestion: 'Bạn có muốn xem lại các sản phẩm vừa tham khảo không?',
      citations: [],
      claims: [],
      isGrounded: true,
      fallbackReason: lease.reason || 'QUOTA_EXCEEDED',
    };

    await db.assistantMessage.create({
      data: {
        conversationId: input.conversationId,
        role: 'ASSISTANT',
        content: rateLimitFallback.answer,
        followUpQuestion: rateLimitFallback.followUpQuestion,
        citations: [],
        claims: [],
        usage: null,
        isGrounded: true,
        fallbackReason: rateLimitFallback.fallbackReason,
      },
    });

    return rateLimitFallback;
  }

  // 3. Build evidence bundle
  const bundle = await buildEvidenceBundle(
    {
      query: input.content,
      productIds: input.productIds,
      variantIds: input.variantIds,
      market: input.market,
    },
    db as any
  );

  let finalAnswerDto: AssistantAnswerDto;
  let usageToSettle = { promptTokens: 0, completionTokens: 0, totalTokens: 0, latencyMs: 0 };

  try {
    // 4. Call provider-neutral AI
    const aiResult = await provider.generate(
      {
        messages: [
          { role: 'system', content: bundle.systemInstructions },
          {
            role: 'user',
            content: `Truy vấn khách hàng: ${input.content}\n\nBằng chứng xác minh:\n${JSON.stringify(bundle)}`,
          },
        ],
        responseFormat: 'json',
      },
      { signal }
    );

    usageToSettle = {
      promptTokens: aiResult.usage.promptTokens,
      completionTokens: aiResult.usage.completionTokens,
      totalTokens: aiResult.usage.totalTokens,
      latencyMs: aiResult.usage.latencyMs,
    };

    if (aiResult.finishReason === 'stop' && aiResult.parsedJson) {
      // 5. Validate grounding
      const grounding = validateAssistantAnswer(aiResult.parsedJson, bundle);
      if (grounding.valid && !grounding.fallbackNeeded) {
        finalAnswerDto = {
          conversationId: conv.id,
          answer: grounding.sanitizedAnswer || (aiResult.parsedJson as any).answer,
          followUpQuestion:
            (aiResult.parsedJson as any).followUpQuestion ||
            'Bạn ưu tiên mức giá tiết kiệm hay hiệu năng xử lý cao hơn cho nhu cầu của mình?',
          citations: grounding.validatedCitations,
          claims: grounding.groundedClaims,
          isGrounded: true,
        };
      } else {
        finalAnswerDto = {
          ...buildDeterministicAnswer(bundle, grounding.fallbackReason || 'GROUNDING_FAILED'),
          conversationId: conv.id,
        };
      }
    } else {
      finalAnswerDto = {
        ...buildDeterministicAnswer(
          bundle,
          aiResult.finishReason === 'refusal' ? 'PROVIDER_REFUSAL' : 'PROVIDER_ERROR'
        ),
        conversationId: conv.id,
      };
    }
  } catch (err) {
    console.warn('[Assistant Orchestration] Generation error, applying fallback:', err);
    finalAnswerDto = {
      ...buildDeterministicAnswer(bundle, 'EXECUTION_EXCEPTION'),
      conversationId: conv.id,
    };
  }

  // 6. Settle AI budget
  await settleAiBudget(lease, usageToSettle);

  // 7. Persist redacted assistant message
  const assistantMsg = await db.assistantMessage.create({
    data: {
      conversationId: input.conversationId,
      role: 'ASSISTANT',
      content: finalAnswerDto.answer,
      followUpQuestion: finalAnswerDto.followUpQuestion,
      citations: finalAnswerDto.citations,
      claims: finalAnswerDto.claims,
      usage: {
        model: provider.providerName,
        promptTokens: usageToSettle.promptTokens,
        completionTokens: usageToSettle.completionTokens,
        totalTokens: usageToSettle.totalTokens,
        latencyMs: usageToSettle.latencyMs,
      },
      isGrounded: finalAnswerDto.isGrounded,
      fallbackReason: finalAnswerDto.fallbackReason,
    },
  });

  await db.assistantConversation.update({
    where: { id: input.conversationId },
    data: { updatedAt: new Date() },
  });

  return {
    ...finalAnswerDto,
    messageId: assistantMsg.id,
  };
}

export async function deleteConversation(
  conversationId: string,
  principal: Principal,
  db: AssistantDb = globalPrisma as unknown as AssistantDb
): Promise<boolean> {
  const conv = await db.assistantConversation.findUnique({
    where: { id: conversationId },
  });

  if (!conv) {
    return true; // Idempotent
  }

  checkConversationOwnership(conv, principal);

  await db.assistantConversation.delete({
    where: { id: conversationId },
  });

  return true;
}

export async function purgeExpiredConversations(
  now: Date = new Date(),
  db: AssistantDb = globalPrisma as unknown as AssistantDb
): Promise<number> {
  const result = await db.assistantConversation.deleteMany({
    where: {
      expiresAt: { lte: now },
    },
  });

  return result.count;
}
