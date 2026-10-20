import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { FakeAiProvider } from '@server/infrastructure/ai/fake-provider';
import { CustomHttpAiProvider } from '@server/infrastructure/ai/custom-http-provider';
import type { AiProvider } from '@server/infrastructure/ai/provider';
import {
  createConversation,
  listUserConversations,
  getConversationMessages,
  answerQuestion,
  deleteConversation,
  purgeExpiredConversations,
} from './assistant.service';
import type { Principal } from '@shared/types/assistant';

function resolvePrincipal(req: Request, session: any): Principal {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

  if (session?.user?.id) {
    return {
      userId: session.user.id,
      role: session.user.role || 'CUSTOMER',
      ip,
    };
  }

  const rawAnon =
    req.headers.get('x-anonymous-session') ||
    req.headers.get('x-session-id') ||
    'anon_default';
  const anonymousTokenHash = crypto.createHash('sha256').update(rawAnon).digest('hex');

  return {
    anonymousTokenHash,
    ip,
  };
}

export function resolveDefaultAiProvider(): AiProvider {
  if (process.env.AI_API_BASE_URL || process.env.AI_API_KEY) {
    return new CustomHttpAiProvider({
      baseUrl: process.env.AI_API_BASE_URL,
      apiKey: process.env.AI_API_KEY,
      model: process.env.AI_MODEL_NAME,
      timeoutMs: process.env.AI_TIMEOUT_MS ? Number(process.env.AI_TIMEOUT_MS) : undefined,
    });
  }
  return new FakeAiProvider();
}

let activeProvider: AiProvider | null = null;

export function setAssistantProvider(provider: AiProvider | null): void {
  activeProvider = provider;
}

export function getAssistantProvider(): AiProvider {
  if (activeProvider) {
    return activeProvider;
  }
  return resolveDefaultAiProvider();
}

/**
 * POST /api/assistant/conversations
 */
export async function createConversationHandler(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const principal = resolvePrincipal(req, session);
    const body = (await req.json().catch(() => ({}))) as { title?: string };

    const conversation = await createConversation(principal, body);
    return NextResponse.json({ success: true, conversation }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi tạo phiên hội thoại';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/assistant/conversations
 */
export async function listConversationsHandler(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const principal = resolvePrincipal(req, session);

    const conversations = await listUserConversations(principal);
    return NextResponse.json({ success: true, conversations });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy danh sách hội thoại';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/assistant/conversations/[id]/messages
 */
export async function getMessagesHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const principal = resolvePrincipal(req, session);
    const { id } = await params;

    const messages = await getConversationMessages(id, principal);
    return NextResponse.json({ success: true, messages });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi đọc tin nhắn';
    const status = message.includes('FORBIDDEN') ? 403 : message.includes('NOT_FOUND') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/assistant/conversations/[id]/messages
 */
export async function sendMessageHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const principal = resolvePrincipal(req, session);
    const { id } = await params;
    const body = (await req.json()) as {
      content: string;
      productIds?: string[];
      variantIds?: string[];
      market?: string;
    };

    if (!body?.content?.trim()) {
      return NextResponse.json({ error: 'Nội dung tin nhắn không được để trống' }, { status: 400 });
    }

    const controller = new AbortController();
    const answer = await answerQuestion(
      {
        conversationId: id,
        content: body.content.trim(),
        productIds: body.productIds,
        variantIds: body.variantIds,
        market: body.market,
      },
      principal,
      getAssistantProvider(),
      controller.signal
    );

    return NextResponse.json({ success: true, answer });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi xử lý câu hỏi';
    const status = message.includes('FORBIDDEN') ? 403 : message.includes('NOT_FOUND') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/assistant/conversations/[id]
 */
export async function deleteConversationHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const principal = resolvePrincipal(req, session);
    const { id } = await params;

    await deleteConversation(id, principal);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi xóa hội thoại';
    const status = message.includes('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/cron/purge-conversations
 */
export async function purgeConversationsCronHandler(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const secret = process.env.CRON_SECRET;

    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized cron trigger' }, { status: 401 });
    }

    const purgedCount = await purgeExpiredConversations();
    return NextResponse.json({ success: true, purgedCount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi dọn dẹp hội thoại hết hạn';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
