import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Keep the real handler and JSON boundary; replace only request authentication and database I/O.
const modules = new Map([
  ['next-auth', `export async function getServerSession() { return { user: { id: 'user-1' } }; }`],
  ['@server/modules/auth/auth-options', `export const authOptions = {};`],
  ['@server/database/prisma', `export const prisma = { wishlist: { async findMany(query) {
    if (query.where.userId !== 'user-1') throw new Error('Wishlist must be account-scoped');
    return [{ id: 'wish-1', userId: 'user-1', productId: 'prod-1',
      createdAt: new Date('2026-11-15T00:00:00Z'),
      product: { id: 'prod-1', name: 'Laptop', price: 35000000n,
        image: null, category: null, stock: 2, isActive: true } }];
  } } };`],
]);

test('wishlist GET returns saved products with JSON-safe prices in both response aliases', async () => {
  const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    const source = context.parentURL?.endsWith('/wishlist.controller.ts') ? modules.get(specifier) : undefined;
    return source
      ? { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true }
      : nextResolve(specifier, context);
  } });
  try {
    const { GET } = await import('@server/modules/wishlist/wishlist.controller');
    const response = await GET();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].productId, 'prod-1');
    assert.equal(body.items[0].product.price, '35000000');
    assert.equal(body.items[0].product.stock, 2);
    assert.deepEqual(body.wishlist, body.items);
  } finally {
    hooks.deregister();
  }
});
