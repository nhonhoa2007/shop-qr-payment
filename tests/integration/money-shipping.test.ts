import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { refundOrderToWallet } from '@server/modules/wallet/wallet.service';

const db = new PrismaClient();
const tag = crypto.randomUUID().slice(0, 8);

test('GHN quote uses the validated cart and destination, not a client subtotal', async () => {
  const product = await db.product.create({ data: { name: `quote-${tag}`, price: 100_000, stock: 5 } });
  const oldFetch = globalThis.fetch;
  process.env.GHN_TOKEN = 'integration-token';
  process.env.GHN_SHOP_ID = 'integration-shop';
  globalThis.fetch = async (_input, init) => {
    const destination = JSON.parse(String(init?.body)) as { to_district_id: number };
    return Response.json({ code: 200, data: { total: destination.to_district_id === 1442 ? 30_000 : 50_000 } });
  };
  try {
    const { quoteShipping } = await import('@server/modules/shipping/shipping-quote.service');
    const items = [{ productId: product.id, quantity: 2 }];
    const first = await quoteShipping({ items, toDistrictId: 1442, toWardCode: '20101' });
    const second = await quoteShipping({ items, toDistrictId: 2264, toWardCode: '90816' });
    assert.equal(first.subtotal, 200_000);
    assert.equal(first.shippingFee, 30_000);
    assert.equal(second.shippingFee, 50_000);
  } finally {
    globalThis.fetch = oldFetch;
    await db.product.delete({ where: { id: product.id } });
  }
});

test('GHN timeout in production returns an uncertain error without a mock tracking code', async () => {
  const priorEnv = process.env.NODE_ENV;
  const priorFetch = globalThis.fetch;
  process.env.NODE_ENV = 'production';
  globalThis.fetch = async () => { throw new Error('timeout'); };
  try {
    const { createGHNShipment, GHNShipmentError } = await import('@server/modules/shipping/ghn.service');
    await assert.rejects(createGHNShipment({ orderId: 'timeout', orderCode: 'DH999999', customerName: 'Guest', customerPhone: '0900000000', customerAddress: 'Test', toDistrictId: 1442, toWardCode: '20101', items: [] }), (error: unknown) => error instanceof GHNShipmentError && error.mayHaveCreated);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorEnv;
  }
});

test('bank event fingerprint rejects concurrent replay', async () => {
  const data = { fingerprint: `test-${tag}`, bankTransId: `bank-${tag}`, amount: 10_000, description: 'test', rawWebhookData: { id: tag } };
  const results = await Promise.allSettled([db.bankTransfer.create({ data }), db.bankTransfer.create({ data })]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(await db.bankTransfer.count({ where: { fingerprint: data.fingerprint } }), 1);
  await db.bankTransfer.delete({ where: { fingerprint: data.fingerprint } });
});

test('Casso records underpay, overpay, negative, missing ID, and late money for review', async () => {
  const code = `DH${Date.now()}${tag.toUpperCase()}`;
  const order = await db.order.create({ data: { orderCode: code, customerName: 'Guest', customerPhone: '0900000000', customerAddress: 'Test', subtotal: 100_000, totalAmount: 100_000, expiresAt: new Date(Date.now() + 86_400_000) } });
  const priorSecret = process.env.CASSO_WEBHOOK_SECRET;
  process.env.CASSO_WEBHOOK_SECRET = 'integration-casso-secret';
  try {
    const { POST } = await import('@server/modules/payment/casso-webhook.controller');
    const cases = [
      { id: `under-${tag}`, amount: 90_000, description: code },
      { id: `over-${tag}`, amount: 110_000, description: code },
      { id: `negative-${tag}`, amount: -100_000, description: code },
      { amount: 100_000, description: code, when: new Date().toISOString() },
    ];
    const send = (event: Record<string, unknown>) => POST(new Request('http://localhost/api/webhooks/payment', { method: 'POST', headers: { 'secure-token': 'integration-casso-secret', 'content-type': 'application/json' }, body: JSON.stringify({ data: [event] }) }));
    for (const event of cases) assert.equal((await send(event)).status, 200);
    await db.order.update({ where: { id: order.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await send({ id: `late-${tag}`, amount: 100_000, description: code })).status, 200);
    assert.equal((await send(cases[0])).status, 200);
    const ledger = await db.bankTransfer.findMany({ where: { orderId: order.id } });
    assert.equal(ledger.length, 5);
    assert.ok(ledger.every((entry) => entry.status === 'PENDING_REVIEW' && entry.reviewReason));
    assert.equal(await db.transaction.count({ where: { orderId: order.id } }), 0);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus, 'UNPAID');
  } finally {
    if (priorSecret === undefined) delete process.env.CASSO_WEBHOOK_SECRET;
    else process.env.CASSO_WEBHOOK_SECRET = priorSecret;
    await db.bankTransfer.deleteMany({ where: { orderId: order.id } });
    await db.order.delete({ where: { id: order.id } });
  }
});

test('last coupon use can be claimed only once under concurrency', async () => {
  const coupon = await db.coupon.create({ data: { code: `LAST${tag.toUpperCase()}`, discountType: 'FIXED', discountValue: 1000, usageLimit: 1, startDate: new Date(Date.now() - 1000), endDate: new Date(Date.now() + 86_400_000) } });
  try {
    const claim = () => db.coupon.updateMany({ where: { id: coupon.id, usedCount: { lt: 1 } }, data: { usedCount: { increment: 1 } } });
    const results = await Promise.all([claim(), claim()]);
    assert.deepEqual(results.map((result) => result.count).sort(), [0, 1]);
    assert.equal((await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount, 1);
  } finally { await db.coupon.delete({ where: { id: coupon.id } }); }
});

test('guest cancellation creates one refund case and releases stock once', async () => {
  const product = await db.product.create({ data: { name: `refund-${tag}`, price: 100_000, stock: 0 } });
  const order = await db.order.create({ data: { orderCode: `DH${Date.now()}${tag.toUpperCase()}`, customerName: 'Guest', customerPhone: '0900000000', customerAddress: 'Test', subtotal: 100_000, totalAmount: 100_000, status: 'PROCESSING', paymentStatus: 'PAID', expiresAt: new Date(Date.now() + 86_400_000), items: { create: { productId: product.id, quantity: 1, price: 100_000 } } } });
  try {
    const first = await db.$transaction((tx) => refundOrderToWallet(tx, order.id));
    const second = await db.$transaction((tx) => refundOrderToWallet(tx, order.id));
    assert.equal(first.success, true);
    assert.equal(first.isGuest, true);
    assert.equal(second.success, false);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 1);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus, 'PAID');
    assert.equal(await db.refundCase.count({ where: { orderId: order.id } }), 1);
  } finally {
    await db.refundCase.deleteMany({ where: { orderId: order.id } });
    await db.orderItem.deleteMany({ where: { orderId: order.id } });
    await db.order.delete({ where: { id: order.id } });
    await db.product.delete({ where: { id: product.id } });
  }
});

test('GHN return, replay, and late delivery release stock and open one refund case', async () => {
  const product = await db.product.create({ data: { name: `ghn-return-${tag}`, price: 100_000, stock: 0 } });
  const order = await db.order.create({ data: { orderCode: `GHN${Date.now()}${tag.toUpperCase()}`, customerName: 'Guest', customerPhone: '0900000000', customerAddress: 'Test', subtotal: 100_000, totalAmount: 100_000, status: 'SHIPPING', paymentStatus: 'PAID', expiresAt: new Date(Date.now() + 86_400_000), items: { create: { productId: product.id, quantity: 1, price: 100_000 } } } });
  const shipment = await db.shipment.create({ data: { orderId: order.id, trackingCode: `GHN-${tag}`, shippingFee: 30_000, status: 'DELIVERING' } });
  const priorToken = process.env.GHN_WEBHOOK_TOKEN;
  process.env.GHN_WEBHOOK_TOKEN = 'integration-ghn-token';
  try {
    const { POST } = await import('@server/modules/shipping/ghn-webhook.controller');
    const send = (status: string) => POST(new Request('http://localhost/api/webhooks/ghn', { method: 'POST', headers: { token: 'integration-ghn-token', 'content-type': 'application/json' }, body: JSON.stringify({ OrderCode: shipment.trackingCode, Status: status }) }));
    assert.equal((await send('returned')).status, 200);
    assert.equal((await send('returned')).status, 200);
    assert.equal((await send('delivering')).status, 200);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 1);
    assert.equal(await db.refundCase.count({ where: { orderId: order.id } }), 1);
    assert.equal((await db.shipment.findUniqueOrThrow({ where: { id: shipment.id } })).status, 'RETURNED');
  } finally {
    if (priorToken === undefined) delete process.env.GHN_WEBHOOK_TOKEN;
    else process.env.GHN_WEBHOOK_TOKEN = priorToken;
    await db.refundCase.deleteMany({ where: { orderId: order.id } });
    await db.orderItem.deleteMany({ where: { orderId: order.id } });
    await db.order.delete({ where: { id: order.id } });
    await db.product.delete({ where: { id: product.id } });
  }
});

test.after(async () => { await db.$disconnect(); });
