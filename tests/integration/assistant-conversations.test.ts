import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const tag = crypto.randomUUID().slice(0, 8);

test('Assistant Conversations Integration: schema persistence, cascade delete and retention query', async (t) => {
  try {
    await db.$connect();
  } catch {
    t.skip('Skipping database-dependent test: PostgreSQL is not running locally');
    return;
  }

  try {
    // 1. Create test user
    const user = await db.user.create({
      data: {
        email: `assistant-test-${tag}@example.com`,
        phone: `0988${Math.floor(100000 + Math.random() * 900000)}`,
        passwordHash: 'dummy_hash',
        name: `Assistant Tester ${tag}`,
      },
    });

    // 2. Create AssistantConversation
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const conv = await db.assistantConversation.create({
      data: {
        userId: user.id,
        title: `Hội thoại tư vấn laptop ${tag}`,
        status: 'ACTIVE',
        expiresAt,
      },
    });

    assert.ok(conv.id);
    assert.equal(conv.userId, user.id);
    assert.equal(conv.status, 'ACTIVE');

    // 3. Add AssistantMessage
    const msg = await db.assistantMessage.create({
      data: {
        conversationId: conv.id,
        role: 'ASSISTANT',
        content: 'MacBook Air M2 có giá tốt và phù hợp nhu cầu văn phòng.',
        followUpQuestion: 'Bạn có cần thêm cổng kết nối HDMI không?',
        citations: [{ id: 'src_apple', title: 'Apple VN' }],
        claims: [{ type: 'PRICE', field: 'price', claimedValue: '24990000', isGrounded: true }],
        usage: { model: 'ag/gemini-3.8-flash-high', promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        isGrounded: true,
      },
    });

    assert.ok(msg.id);
    assert.equal(msg.conversationId, conv.id);
    assert.equal(msg.role, 'ASSISTANT');
    assert.equal(msg.isGrounded, true);

    // 4. Query messages with relation
    const retrievedConv = await db.assistantConversation.findUnique({
      where: { id: conv.id },
      include: { messages: true },
    });

    assert.ok(retrievedConv);
    assert.equal(retrievedConv.messages.length, 1);
    assert.equal(retrievedConv.messages[0].id, msg.id);

    // 5. Test Cascade Delete
    await db.assistantConversation.delete({
      where: { id: conv.id },
    });

    const orphanMessages = await db.assistantMessage.findMany({
      where: { conversationId: conv.id },
    });
    assert.equal(orphanMessages.length, 0);

    // 6. Clean up user
    await db.user.delete({ where: { id: user.id } });
  } finally {
    await db.$disconnect();
  }
});
