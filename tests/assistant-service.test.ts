import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createConversation,
  appendUserMessage,
  answerQuestion,
  deleteConversation,
  purgeExpiredConversations,
  getConversationMessages,
  listUserConversations,
  type AssistantDb,
} from '../src/server/modules/assistant/assistant.service.ts';
import { FakeAiProvider } from '../src/server/infrastructure/ai/fake-provider.ts';
import { resetAiQuotaStore } from '../src/server/infrastructure/ai/quota.ts';
import type { Principal } from '../src/shared/types/assistant.ts';

describe('Commerce Intelligence: Assistant Service & Orchestration', () => {
  let memoryStore: {
    conversations: Map<string, any>;
    messages: Map<string, any[]>;
  };
  let mockDb: AssistantDb;

  beforeEach(async () => {
    await resetAiQuotaStore();
    memoryStore = {
      conversations: new Map(),
      messages: new Map(),
    };

    mockDb = {
      assistantConversation: {
        create: async ({ data }: any) => {
          const conv = {
            id: data.id || `conv_${Date.now()}_${Math.random()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          memoryStore.conversations.set(conv.id, conv);
          if (!memoryStore.messages.has(conv.id)) {
            memoryStore.messages.set(conv.id, []);
          }
          return conv;
        },
        findUnique: async ({ where }: any) => {
          return memoryStore.conversations.get(where.id) || null;
        },
        findMany: async ({ where }: any) => {
          return Array.from(memoryStore.conversations.values()).filter((c) => {
            if (where.userId && c.userId !== where.userId) return false;
            if (where.anonymousTokenHash && c.anonymousTokenHash !== where.anonymousTokenHash)
              return false;
            if (where.expiresAt?.lte && c.expiresAt > where.expiresAt.lte) return false;
            return true;
          });
        },
        update: async ({ where, data }: any) => {
          const conv = memoryStore.conversations.get(where.id);
          if (!conv) throw new Error('Not found');
          Object.assign(conv, data, { updatedAt: new Date() });
          return conv;
        },
        delete: async ({ where }: any) => {
          const conv = memoryStore.conversations.get(where.id);
          if (conv) {
            memoryStore.conversations.delete(where.id);
            memoryStore.messages.delete(where.id);
          }
          return conv;
        },
        deleteMany: async ({ where }: any) => {
          let count = 0;
          for (const [id, c] of Array.from(memoryStore.conversations.entries())) {
            if (where.expiresAt?.lte && c.expiresAt <= where.expiresAt.lte) {
              memoryStore.conversations.delete(id);
              memoryStore.messages.delete(id);
              count++;
            }
          }
          return { count };
        },
      },
      assistantMessage: {
        create: async ({ data }: any) => {
          const msg = {
            id: data.id || `msg_${Date.now()}_${Math.random()}`,
            ...data,
            createdAt: new Date(),
          };
          const list = memoryStore.messages.get(data.conversationId) || [];
          list.push(msg);
          memoryStore.messages.set(data.conversationId, list);
          return msg;
        },
        findMany: async ({ where }: any) => {
          return memoryStore.messages.get(where.conversationId) || [];
        },
      },
      product: {
        findMany: async () => [
          {
            id: 'prod_mba_m2',
            name: 'MacBook Air M2 (2022)',
            brand: { name: 'Apple' },
            price: BigInt(24990000),
            stock: 12,
            specValues: { ram: 8, storage: 256 },
          },
        ],
      },
      dataSource: {
        findMany: async () => [
          {
            id: 'src_apple',
            name: 'Apple Vietnam',
            sourceType: 'PRODUCT_SPEC',
            status: 'ACTIVE',
            isSynthetic: false,
          },
        ],
      },
    };
  });

  it('creates conversation for registered user with 30-day retention', async () => {
    const principal: Principal = {
      userId: 'user_buyer_1',
      role: 'CUSTOMER',
      ip: '127.0.0.1',
    };

    const conv = await createConversation(principal, { title: 'Tư vấn MacBook' }, mockDb);

    assert.ok(conv.id.startsWith('conv_'));
    assert.equal(conv.userId, 'user_buyer_1');
    assert.equal(conv.title, 'Tư vấn MacBook');

    const expectedExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const actualExpiry = new Date(conv.expiresAt).getTime();
    assert.ok(Math.abs(actualExpiry - expectedExpiry) < 5000);
  });

  it('creates anonymous conversation using hashed token', async () => {
    const principal: Principal = {
      anonymousTokenHash: 'hash_anonymous_session_999',
      ip: '127.0.0.1',
    };

    const conv = await createConversation(principal, {}, mockDb);

    assert.equal(conv.userId, null);
    assert.equal(conv.anonymousTokenHash, 'hash_anonymous_session_999');
  });

  it('enforces strict ownership preventing cross-user access', async () => {
    const userA: Principal = { userId: 'user_A', role: 'CUSTOMER', ip: '1.1.1.1' };
    const userB: Principal = { userId: 'user_B', role: 'CUSTOMER', ip: '2.2.2.2' };

    const convA = await createConversation(userA, {}, mockDb);

    // User B trying to append message to User A conversation must fail
    await assert.rejects(
      async () => {
        await appendUserMessage(
          { conversationId: convA.id, content: 'Trộm thông tin' },
          userB,
          mockDb
        );
      },
      (err: Error) => err.message.includes('FORBIDDEN') || err.message.includes('OWNERSHIP')
    );

    // User B trying to view messages must fail
    await assert.rejects(
      async () => {
        await getConversationMessages(convA.id, userB, mockDb);
      },
      (err: Error) => err.message.includes('FORBIDDEN') || err.message.includes('OWNERSHIP')
    );
  });

  it('allows idempotent early deletion by owner', async () => {
    const user: Principal = { userId: 'u_del', role: 'CUSTOMER', ip: '1.1.1.1' };
    const conv = await createConversation(user, {}, mockDb);

    const deletedFirst = await deleteConversation(conv.id, user, mockDb);
    assert.equal(deletedFirst, true);

    // Second call is idempotent
    const deletedSecond = await deleteConversation(conv.id, user, mockDb);
    assert.equal(deletedSecond, true);
  });

  it('purges expired conversations past 30 days', async () => {
    const user: Principal = { userId: 'u_purge', role: 'CUSTOMER', ip: '1.1.1.1' };
    const convOld = await createConversation(user, {}, mockDb);

    // Force expire convOld
    const conv = memoryStore.conversations.get(convOld.id);
    conv.expiresAt = new Date(Date.now() - 1000);

    const convNew = await createConversation(user, {}, mockDb);

    const purgedCount = await purgeExpiredConversations(new Date(), mockDb);
    assert.equal(purgedCount, 1);
    assert.equal(memoryStore.conversations.has(convOld.id), false);
    assert.equal(memoryStore.conversations.has(convNew.id), true);
  });

  it('orchestrates question answering with grounded provider and saves messages', async () => {
    const user: Principal = { userId: 'u_ask', role: 'CUSTOMER', ip: '1.1.1.1' };
    const conv = await createConversation(user, {}, mockDb);

    const provider = new FakeAiProvider();
    provider.enqueueResponse({
      text: JSON.stringify({
        answer: 'MacBook Air M2 có giá 24.990.000₫ và còn 12 máy trong kho.',
        followUpQuestion: 'Bạn có cần thêm phụ kiện sạc nhanh hoặc chuột không?',
        citations: ['src_apple'],
        claims: [
          {
            type: 'PRICE',
            claimText: '24990000',
            subjectProduct: 'prod_mba_m2',
            field: 'livePriceVnd',
            claimedValue: '24990000',
          },
          {
            type: 'STOCK',
            claimText: '12',
            subjectProduct: 'prod_mba_m2',
            field: 'liveStock',
            claimedValue: 12,
          },
        ],
      }),
      finishReason: 'stop',
      usage: { promptTokens: 80, completionTokens: 40, totalTokens: 120, latencyMs: 25 },
    });

    const controller = new AbortController();
    const answer = await answerQuestion(
      {
        conversationId: conv.id,
        content: 'MacBook Air M2 giá bao nhiêu?',
        productIds: ['prod_mba_m2'],
      },
      user,
      provider,
      controller.signal,
      mockDb
    );

    assert.equal(answer.isGrounded, true);
    assert.ok(answer.answer.includes('24.990.000'));
    assert.ok(answer.followUpQuestion && answer.followUpQuestion.length > 0);

    const messages = await getConversationMessages(conv.id, user, mockDb);
    assert.equal(messages.length, 2); // 1 user message + 1 assistant message
    assert.equal(messages[0].role, 'USER');
    assert.equal(messages[1].role, 'ASSISTANT');
    assert.ok(messages[1].usage !== null);
  });

  it('falls back gracefully to deterministic answer when provider fails', async () => {
    const user: Principal = { userId: 'u_fail', role: 'CUSTOMER', ip: '1.1.1.1' };
    const conv = await createConversation(user, {}, mockDb);

    const provider = new FakeAiProvider();
    provider.enqueueResponse({
      text: '',
      finishReason: 'error',
    });

    const controller = new AbortController();
    const answer = await answerQuestion(
      {
        conversationId: conv.id,
        content: 'Tư vấn nhanh',
        productIds: ['prod_mba_m2'],
      },
      user,
      provider,
      controller.signal,
      mockDb
    );

    assert.equal(answer.isGrounded, true);
    assert.ok(answer.answer.includes('MacBook Air M2'));
    assert.ok(answer.fallbackReason !== undefined);
  });

  it('answers a general shop inventory question from active categories without AI invention', async () => {
    const user: Principal = { userId: 'u_catalog', role: 'CUSTOMER', ip: '1.1.1.1' };
    const conv = await createConversation(user, {}, mockDb);
    mockDb.product.findMany = async () => [
      { id: 'p_laptop', name: 'Laptop Dell', category: 'Công nghệ' },
      { id: 'p_shirt', name: 'Áo sơ mi', category: 'Thời trang' },
    ];
    const provider = new FakeAiProvider();
    let providerCalled = false;
    const generate = provider.generate.bind(provider);
    provider.generate = async (request, options) => {
      providerCalled = true;
      return generate(request, options);
    };

    const answer = await answerQuestion(
      { conversationId: conv.id, content: 'shop có những sản phẩm gì?' },
      user, provider, new AbortController().signal, mockDb
    );

    assert.match(answer.answer, /Công nghệ.*Laptop Dell/s);
    assert.match(answer.answer, /Thời trang.*Áo sơ mi/s);
    assert.equal(answer.isGrounded, true);
    assert.equal(answer.citations.length, 2);
    assert.equal(providerCalled, false);
  });

  it('uses verified product data when AI returns an unsupported price', async () => {
    const user: Principal = { userId: 'u_bad_price', role: 'CUSTOMER', ip: '1.1.1.1' };
    const conv = await createConversation(user, {}, mockDb);
    const provider = new FakeAiProvider();
    provider.enqueueResponse({ text: JSON.stringify({
      answer: 'MacBook Air M2 chỉ có giá 15.000.000đ.',
      citations: ['src_apple'],
      claims: [{ type: 'PRICE', subjectProduct: 'prod_mba_m2', field: 'livePriceVnd', claimedValue: '15000000' }],
    }) });

    const answer = await answerQuestion(
      { conversationId: conv.id, content: 'MacBook Air M2 giá bao nhiêu?', productIds: ['prod_mba_m2'] },
      user, provider, new AbortController().signal, mockDb
    );

    assert.match(answer.answer, /24\.990\.000/);
    assert.doesNotMatch(answer.answer, /15\.000\.000/);
    assert.equal(answer.fallbackReason?.startsWith('PRICE_MISMATCH'), true);
  });

  it('does not invent a product when search returns no evidence', async () => {
    const user: Principal = { userId: 'u_no_match', role: 'CUSTOMER', ip: '1.1.1.1' };
    const conv = await createConversation(user, {}, mockDb);
    mockDb.product.findMany = async () => [];
    const provider = new FakeAiProvider();
    let providerCalled = false;
    const generate = provider.generate.bind(provider);
    provider.generate = async (request, options) => {
      providerCalled = true;
      return generate(request, options);
    };

    const answer = await answerQuestion(
      { conversationId: conv.id, content: 'Shop có máy ảnh Fujifilm X100VI không?' },
      user, provider, new AbortController().signal, mockDb
    );

    assert.match(answer.answer, /chưa tìm thấy sản phẩm/i);
    assert.equal(answer.fallbackReason, 'NO_MATCH');
    assert.equal(providerCalled, false);
  });

  it('rejects a product answer without verifiable claims or citations', async () => {
    const user: Principal = { userId: 'u_no_claims', role: 'CUSTOMER', ip: '1.1.1.1' };
    const conv = await createConversation(user, {}, mockDb);
    const provider = new FakeAiProvider();
    provider.enqueueResponse({ text: JSON.stringify({
      answer: 'MacBook Air M2 có giá 15.000.000đ.', citations: [], claims: [],
    }) });

    const answer = await answerQuestion(
      { conversationId: conv.id, content: 'MacBook Air M2 giá bao nhiêu?', productIds: ['prod_mba_m2'] },
      user, provider, new AbortController().signal, mockDb
    );

    assert.match(answer.answer, /24\.990\.000/);
    assert.doesNotMatch(answer.answer, /15\.000\.000/);
    assert.equal(answer.fallbackReason, 'GROUNDING_FAILED');
  });
});
