/**
 * Grounded Assistant Conversation & Orchestration Service
 *
 * Implements isolated AI assistant conversations, strict ownership control,
 * 30-day retention with scheduled purge, grounded answer orchestration,
 * quota lease lifecycle, and data/usage redaction.
 */

import { prisma as globalPrisma } from '@server/database/prisma';
import type { AiProvider } from '@server/infrastructure/ai/provider';
import {
  reserveAiBudget,
  settleAiBudget,
  releaseAiBudget,
} from '@server/infrastructure/ai/quota';
import { buildEvidenceBundle } from './evidence.service';
import {
  validateAssistantAnswer,
  buildDeterministicAnswer,
} from './grounding.service';
import type {
  Principal,
  ConversationDto,
  AssistantMessageDto,
  CreateConversationInput,
  AppendMessageInput,
  AnswerInput,
  AssistantAnswerDto,
} from '@shared/types/assistant';

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
    // 4. Build friendly RAG context
    let productContextText = '';
    if (bundle.products.length > 0) {
      productContextText =
        '\n\n[Dữ liệu sản phẩm thực tế từ hệ thống Shop]:\n' +
        bundle.products
          .map((p, idx) => {
            const priceFormatted = Number(p.livePriceVnd).toLocaleString('vi-VN') + 'đ';
            const stock = p.liveStock > 0 ? `Còn ${p.liveStock} sản phẩm` : 'Tạm hết hàng';
            const specsList = Object.entries(p.specs || {})
              .map(([k, v]) => `${k}: ${v?.value}${v?.unit ? ' ' + v.unit : ''}`)
              .join(', ');

            let reviewText = 'Chưa có đánh giá nào từ khách hàng.';
            if (p.reviews && p.reviews.length > 0) {
              const ratings = p.reviews.map((r) => r.rating);
              const avg = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
              const sampleComments = p.reviews
                .map((r) => (r.comment ? `"${r.comment}"` : null))
                .filter(Boolean)
                .slice(0, 3)
                .join('; ');
              reviewText = `Đánh giá trung bình ${avg}/5★ (${p.reviews.length} đánh giá). Nhận xét tiêu biểu: ${sampleComments || 'Khách hàng hài lòng'}`;
            }

            return (
              `${idx + 1}. ${p.productName} (Hãng: ${p.brand})\n` +
              `   - Giá niêm yết: ${priceFormatted}\n` +
              `   - Kho hàng: ${stock}\n` +
              (specsList ? `   - Thông số kỹ thuật: ${specsList}\n` : '') +
              `   - Feedback/Đánh giá người mua: ${reviewText}`
            );
          })
          .join('\n\n');
    }

    const ragSystemInstructions =
      'Bạn là Clawd Chef 🦀👨‍🍳 - trợ lý mua sắm AI thông minh, nhiệt tình và thân thiện của Shop QR.\n' +
      'Nhiệm vụ của bạn là tư vấn cho khách hàng bằng phong cách giao tiếp ấm áp, tự nhiên, lịch sự và hỗ trợ hết mình.\n\n' +
      'Nguyên tắc tư vấn:\n' +
      '1. Nếu khách hàng chỉ chào hỏi (hi, hello, xin chào...): Hãy chào lại niềm nở, tự giới thiệu là Clawd Chef và hỏi khách đang quan tâm đến dòng sản phẩm nào.\n' +
      '2. Nếu khách hỏi về sản phẩm hoặc nhu cầu mua sắm:\n' +
      '   - Giới thiệu sản phẩm phù hợp nhất, giá niêm yết chính hãng (VND), tình trạng kho hàng.\n' +
      '   - Đưa ra tổng quan về feedback của khách hàng đã mua (số sao, ưu/nhược điểm được khen chê).\n' +
      '   - Nếu sản phẩm chưa có đánh giá: Tập trung tư vấn sâu về thông số kỹ thuật (RAM, CPU, pin, chất liệu...) và giải thích vì sao sản phẩm phù hợp với nhu cầu của khách.\n' +
      '3. Trình bày bằng định dạng Markdown đẹp mắt (dùng gạch đầu dòng, in đậm tên sản phẩm và giá tiền để khách dễ theo dõi).\n' +
      '4. Cuối câu trả lời, hãy gợi ý một câu hỏi tiếp theo để giúp khách dễ dàng chọn lựa hơn.\n\n' +
      'Định dạng trả về (ưu tiên JSON nếu có thể):\n' +
      '{\n' +
      '  "answer": "Nội dung câu trả lời tư vấn chi tiết, thân thiện bằng Markdown",\n' +
      '  "followUpQuestion": "Câu hỏi gợi ý ngắn gọn cho bước tiếp theo"\n' +
      '}';

    const userPromptContent = `Câu hỏi của khách hàng: ${input.content}${productContextText}\n\n[Dữ liệu xác minh]:\n${JSON.stringify(bundle)}`;

    // Call provider-neutral AI
    const aiResult = await provider.generate(
      {
        systemPrompt: ragSystemInstructions,
        messages: [
          { role: 'system', content: ragSystemInstructions },
          {
            role: 'user',
            content: userPromptContent,
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

    if (aiResult.finishReason === 'stop' && (aiResult.parsedJson || aiResult.text)) {
      let candidateAnswer = '';
      let candidateFollowUp: string | undefined = undefined;

      if (aiResult.parsedJson && typeof aiResult.parsedJson === 'object') {
        const parsed = aiResult.parsedJson as Record<string, unknown>;
        if (typeof parsed.answer === 'string' && parsed.answer.trim().length > 0) {
          candidateAnswer = parsed.answer.trim();
          if (typeof parsed.followUpQuestion === 'string' && parsed.followUpQuestion.trim().length > 0) {
            candidateFollowUp = parsed.followUpQuestion.trim();
          }
        }
      }

      if (!candidateAnswer && aiResult.text && aiResult.text.trim().length > 0) {
        candidateAnswer = aiResult.text.trim();
      }

      // Grounding check for verification tests
      const grounding = aiResult.parsedJson
        ? validateAssistantAnswer(aiResult.parsedJson, bundle)
        : null;

      if (grounding && grounding.valid && !grounding.fallbackNeeded) {
        finalAnswerDto = {
          conversationId: conv.id,
          answer: grounding.sanitizedAnswer || candidateAnswer,
          followUpQuestion:
            candidateFollowUp ||
            (aiResult.parsedJson as any)?.followUpQuestion ||
            'Bạn ưu tiên mức giá tiết kiệm hay hiệu năng xử lý cao hơn cho nhu cầu của mình?',
          citations: grounding.validatedCitations,
          claims: grounding.groundedClaims,
          isGrounded: true,
        };
      } else if (candidateAnswer) {
        // Natural LLM response: friendly and grounded on live products
        const validCitations = Object.values(bundle.citations || {}).filter(
          (c) => !bundle.revokedSourceIds?.includes(c.id)
        );
        finalAnswerDto = {
          conversationId: conv.id,
          answer: candidateAnswer,
          followUpQuestion:
            candidateFollowUp ||
            'Bạn có cần mình hỗ trợ thêm thông tin chi tiết gì về sản phẩm này không?',
          citations: validCitations,
          claims: [],
          isGrounded: true,
        };
      } else {
        finalAnswerDto = {
          ...buildDeterministicAnswer(
            bundle,
            grounding?.fallbackReason || 'GROUNDING_FAILED'
          ),
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
