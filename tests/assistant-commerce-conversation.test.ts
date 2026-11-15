import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createConversation, answerQuestion, getConversationMessages, type AssistantDb } from '../src/server/modules/assistant/assistant.service.ts';
import { resetAiQuotaStore } from '../src/server/infrastructure/ai/quota.ts';
import { FakeAiProvider } from '../src/server/infrastructure/ai/fake-provider.ts';
import { resolveAssistantIdentity } from '../src/server/modules/assistant/assistant-identity.ts';

function fixture() {
  let seq = 0;
  const conversations: any[] = [], messages: any[] = [];
  const products = ['a', 'b'].map((id, i) => ({ id, name: `Laptop Lenovo ${id}`, kind: 'LAPTOP', categoryId: 'laptops',
    categoryRef: { id: 'laptops', name: 'Laptop' }, isActive: true, price: BigInt(15_000_000 + i * 1_000_000), stock: 3,
    inventoryMode: 'BASE', specs: { values: { ram_capacity_gb: { state: 'KNOWN', value: 16 } } } }));
  const db = {
    assistantConversation: {
      create: async ({data}: any) => { const c = {...data, id: `c${++seq}`, createdAt: new Date(), updatedAt: new Date()}; conversations.push(c); return c; },
      findUnique: async ({where}: any) => conversations.find(c => c.id === where.id),
      update: async ({where,data}: any) => Object.assign(conversations.find(c => c.id === where.id),data),
    },
    assistantMessage: {
      create: async ({data}: any) => { const m = {...data, id: `m${++seq}`, createdAt: new Date(Date.now() + seq * 10)}; messages.push(m); return m; },
      findMany: async ({where,orderBy,take}: any) => { let list = messages.filter(m => m.conversationId === where.conversationId && (!where.role || m.role === where.role)); if (orderBy?.createdAt === 'desc') list = [...list].reverse(); return list.slice(0,take); },
    },
    product: { findMany: async ({where}: any) => products.filter(p => p.isActive && (!where?.id?.in || where.id.in.includes(p.id))) },
    dataSource: {findMany: async () => []},
  } as unknown as AssistantDb;
  return { db, products, messages };
}
const buyer = {userId: 'u1', role: 'CUSTOMER', ip: '127.0.0.1'};
describe('Assistant commerce conversation', () => {
  beforeEach(async () => { await resetAiQuotaStore(); });
  it('persists search cards, understands first-two follow-up and refreshes history without provider access', async () => {
    const {db,products,messages} = fixture();
    const conv = await createConversation(buyer, {}, db);
    const provider = {providerName: 'offline', generate: async () => { throw new Error('must not call model for factual commerce'); }};
    const ask = (content: string) => answerQuestion({conversationId: conv.id, content}, buyer, provider, new AbortController().signal, db);
    const search = await ask('tìm laptop RAM 16GB dưới 20tr');
    assert.equal(search.commerce?.products.length, 2);
    const comparison = await ask('so sánh hai chiếc đầu tiên');
    assert.equal(comparison.commerce?.kind, 'comparison');
    assert.ok(comparison.messageId);
    products[0].price = 14_000_000n;
    const history = await getConversationMessages(conv.id, buyer, db);
    assert.equal(history.at(-1)?.commerce?.products[0].price.min, '14000000');
    assert.equal(history.at(-1)?.commerce?.refreshed, true);
    assert.ok(messages.some(m => m.citations?.some((c: any) => c.productRef)));
  });
  it('isolates users and conversations, including zero-result context', async () => {
    const {db} = fixture(); const a = await createConversation(buyer,{},db);
    const provider = new FakeAiProvider();
    await answerQuestion({conversationId:a.id,content:'tìm laptop'},buyer,provider,new AbortController().signal,db);
    await assert.rejects(() => answerQuestion({conversationId:a.id,content:'so sánh hai chiếc đầu tiên'},{...buyer,userId:'other'},provider,new AbortController().signal,db), /FORBIDDEN/);
    const b = await createConversation(buyer,{},db);
    const response = await answerQuestion({conversationId:b.id,content:'so sánh hai chiếc đầu tiên'},buyer,provider,new AbortController().signal,db);
    assert.equal(response.commerce?.kind,'clarification');
    const noMatch = await answerQuestion({conversationId:a.id,content:'laptop dưới 1 triệu'},buyer,provider,new AbortController().signal,db);
    assert.equal(noMatch.commerce?.products.length,0);
    const afterEmpty = await answerQuestion({conversationId:a.id,content:'so sánh hai chiếc đầu tiên'},buyer,provider,new AbortController().signal,db);
    assert.equal(afterEmpty.commerce?.kind,'clarification');
  });
  it('loads legacy messages and handles delisted products', async () => {
    const {db,products,messages} = fixture(); const conv = await createConversation(buyer,{},db);
    messages.push({ id:'legacy',conversationId:conv.id,role:'ASSISTANT',content:'Câu trả lời cũ',citations:[],isGrounded:true,createdAt:new Date() });
    await answerQuestion({conversationId:conv.id,content:'tìm laptop'},buyer,new FakeAiProvider(),new AbortController().signal,db);
    products[0].isActive=false;
    const history=await getConversationMessages(conv.id,buyer,db);
    assert.equal(history[0].content,'Câu trả lời cũ'); assert.equal(history[0].commerce,undefined);
    assert.equal(history.at(-1)?.commerce?.products.length,1);
    assert.match(history.at(-1)?.commerce?.notice || '',/không còn/);
  });
  it('issues separate anonymous cookies and rejects a shared default identity', () => {
    const a=resolveAssistantIdentity(new Request('http://localhost/api/assistant/conversations'),null);
    const b=resolveAssistantIdentity(new Request('http://localhost/api/assistant/conversations'),null);
    assert.notEqual(a.principal.anonymousTokenHash,b.principal.anonymousTokenHash);
    assert.ok(a.cookie);
    const next=resolveAssistantIdentity(new Request('http://localhost/api/assistant/conversations',{headers:{cookie:a.cookie!.split(';')[0]}}),null);
    assert.equal(a.principal.anonymousTokenHash,next.principal.anonymousTokenHash);
  });
});
