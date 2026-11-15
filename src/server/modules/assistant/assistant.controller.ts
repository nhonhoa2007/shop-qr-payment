import { NextResponse } from 'next/server';
import { resolveAssistantIdentity } from './assistant-identity';
import { validateComparisonRefs } from './commerce.service';
import type { AssistantProductRef } from '@shared/types/assistant-commerce';
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

function resolvePrincipal(req: Request, session: Parameters<typeof resolveAssistantIdentity>[1]): Principal {
  return resolveAssistantIdentity(req, session).principal;
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
    const identity = resolveAssistantIdentity(req, session);
    const body = (await req.json().catch(() => ({}))) as { title?: string };
    const conversation = await createConversation(identity.principal, body);
    const response = NextResponse.json({ success: true, conversation }, { status: 201 });
    if (identity.cookie) response.headers.append('Set-Cookie', identity.cookie);
    return response;
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
      comparison?: AssistantProductRef[];
      productIds?: string[];
      variantIds?: string[];
      market?: string;
    };

    if (typeof body?.content !== 'string' || !body.content.trim() || body.content.length > 2000) {
      return NextResponse.json({ error: 'Nội dung tin nhắn không được để trống' }, { status: 400 });
    }

    let comparison: AssistantProductRef[] | undefined;
    try {
      if (body.comparison !== undefined) comparison = validateComparisonRefs(body.comparison);
      for (const ids of [body.productIds, body.variantIds]) {
        if (ids !== undefined && (!Array.isArray(ids) || ids.length > 5 || ids.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)))) {
          throw new Error('Danh sách sản phẩm không hợp lệ');
        }
      }
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Dữ liệu không hợp lệ' }, { status: 400 });
    }
    const controller = new AbortController();
    const answer = await answerQuestion(
      {
        conversationId: id,
        content: body.content.trim(),
        comparison,
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
