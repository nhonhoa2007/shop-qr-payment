import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { getNetSales } from '@server/modules/intelligence/sales.service.ts';

const db = new PrismaClient();
const tag = crypto.randomUUID().slice(0, 8);

test('Commerce Intelligence Integration: Net Sales DB aggregation and completed window filtering', async (t) => {
  try {
    await db.$connect();
  } catch {
    t.skip('Skipping database-dependent test: PostgreSQL is not running locally');
    return;
  }

  // Setup test category, brand, and product
  const category = await db.category.create({
    data: {
      name: `Laptop-Sales-${tag}`,
      slug: `laptop-sales-${tag}`,
      kind: 'LAPTOP',
      specSchema: {},
    },
  });

  const brand = await db.brand.create({
    data: {
      name: `Dell-${tag}`,
      slug: `dell-${tag}`,
    },
  });

  const product = await db.product.create({
    data: {
      name: `XPS 13-${tag}`,
      categoryId: category.id,
      brandId: brand.id,
      kind: 'LAPTOP',
      price: BigInt(30_000_000),
      stock: 20,
    },
  });

  const now = new Date();
  const past5Days = new Date(now.getTime() - 5 * 24 * 3600 * 1000);
  const past20Days = new Date(now.getTime() - 20 * 24 * 3600 * 1000);

  // 1. Order COMPLETED inside window (5 days ago)
  const completedOrder = await db.order.create({
    data: {
      orderCode: `DH_SALES_1_${tag}`,
      customerName: 'Sales Buyer',
      customerPhone: '0900000000',
      customerAddress: '123 Tech Street',
      totalAmount: BigInt(60_000_000),
      shippingFee: BigInt(0),
      discountAmount: BigInt(0),
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      completedAt: past5Days,
      items: {
        create: [
          {
            productId: product.id,
            quantity: 2,
            price: BigInt(30_000_000),
          },
        ],
      },
    },
  });

  // 2. Order COMPLETED outside window (20 days ago)
  const oldOrder = await db.order.create({
    data: {
      orderCode: `DH_SALES_OLD_${tag}`,
      customerName: 'Sales Buyer',
      customerPhone: '0900000000',
      customerAddress: '123 Tech Street',
      totalAmount: BigInt(30_000_000),
      shippingFee: BigInt(0),
      discountAmount: BigInt(0),
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      completedAt: past20Days,
      items: {
        create: [
          {
            productId: product.id,
            quantity: 1,
            price: BigInt(30_000_000),
          },
        ],
      },
    },
  });

  // 3. Order PAID but PENDING / SHIPPING (not COMPLETED yet)
  const pendingOrder = await db.order.create({
    data: {
      orderCode: `DH_SALES_PEND_${tag}`,
      customerName: 'Sales Buyer',
      customerPhone: '0900000000',
      customerAddress: '123 Tech Street',
      totalAmount: BigInt(30_000_000),
      shippingFee: BigInt(0),
      discountAmount: BigInt(0),
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      items: {
        create: [
          {
            productId: product.id,
            quantity: 1,
            price: BigInt(30_000_000),
          },
        ],
      },
    },
  });

  try {
    const windowStart = new Date(now.getTime() - 10 * 24 * 3600 * 1000);
    const windowEnd = now;

    const netSales = await getNetSales(
      {
        productIds: [product.id],
        from: windowStart,
        to: windowEnd,
      },
      db
    );

    assert.equal(netSales.length, 1);
    assert.equal(netSales[0].productId, product.id);
    assert.equal(netSales[0].grossUnits, 2); // Only completedOrder within 10 days
    assert.equal(netSales[0].netUnits, 2);
    assert.equal(netSales[0].grossRevenueVnd, '60000000');
    assert.equal(netSales[0].netRevenueVnd, '60000000');
    assert.equal(netSales[0].status, 'AVAILABLE');
  } finally {
    // Cleanup test data
    await db.orderItem.deleteMany({
      where: {
        orderId: { in: [completedOrder.id, oldOrder.id, pendingOrder.id] },
      },
    });
    await db.order.deleteMany({
      where: {
        id: { in: [completedOrder.id, oldOrder.id, pendingOrder.id] },
      },
    });
    await db.product.delete({ where: { id: product.id } });
    await db.brand.delete({ where: { id: brand.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.$disconnect();
  }
});
