import { it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { reserveOrderStock, releaseOrderStock } from '@server/modules/inventory/inventory.service';

it('PostgreSQL: cancellation releases inactive products and variants atomically and only once', {
  skip: process.env.INVENTORY_DATABASE_TEST !== '1',
}, async () => {
  const db = new PrismaClient();
  const prefix = `cancel-inactive-${randomUUID()}`;
  const productIds = [`${prefix}-base`, `${prefix}-parent`];
  const orderId = `${prefix}-order`;
  try {
    await db.product.createMany({ data: productIds.map((id, index) => ({
      id, name: id, price: 100_000n, stock: 2, onHandStock: 2,
      inventoryMode: index === 0 ? 'BASE' as const : 'VARIANT' as const,
    })) });
    const variant = await db.productVariant.create({ data: {
      productId: productIds[1], sku: prefix, title: 'Test variant',
      price: 100_000n, stock: 2, onHandStock: 2,
    } });
    const items = [
      { productId: productIds[0], quantity: 1 },
      { productId: productIds[1], variantId: variant.id, quantity: 1 },
    ];
    await db.order.create({ data: {
      id: orderId, orderCode: prefix, customerName: 'Cancellation regression fixture',
      customerPhone: '0900000000', customerAddress: 'Test fixture',
      subtotal: 200_000n, totalAmount: 200_000n, expiresAt: new Date(Date.now() + 3_600_000),
      items: { create: items.map(item => ({ ...item, price: 100_000n })) },
    } });
    assert.equal(await db.$transaction(tx => reserveOrderStock(tx, items, `${orderId}:reserve`)), null);
    await db.product.updateMany({ where: { id: { in: productIds } }, data: { isActive: false } });
    await db.productVariant.update({ where: { id: variant.id }, data: { isActive: false } });

    const releaseKey = `${orderId}:cancel:release`;
    const cancel = () => db.$transaction(async tx => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: 'PENDING', paymentStatus: 'UNPAID' },
        data: { status: 'CANCELLED' },
      });
      if (updated.count === 1) await releaseOrderStock(tx, items, releaseKey);
      return updated.count;
    });

    // A later error must roll back both the status and all stock movements.
    const rollback = new Error('intentional rollback');
    await assert.rejects(db.$transaction(async tx => {
      await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
      await releaseOrderStock(tx, items, releaseKey);
      throw rollback;
    }), error => error === rollback);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, 'PENDING');
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: productIds[0] } })).reservedStock, 1);
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).reservedStock, 1);
    assert.equal(await db.inventoryMovement.count({ where: { productId: { in: productIds }, kind: 'RELEASE' } }), 0);

    assert.equal(await cancel(), 1);
    assert.equal(await cancel(), 0);
    await db.$transaction(tx => releaseOrderStock(tx, items, releaseKey));
    const projections = [
      ...await db.product.findMany({ where: { id: { in: productIds } } }),
      await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } }),
    ];
    for (const projection of projections) {
      assert.equal(projection.isActive, false);
      assert.equal(projection.onHandStock, 2);
      assert.equal(projection.reservedStock, 0);
      assert.equal(projection.stock, 2);
      assert.equal(projection.stockVersion, 2);
    }
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, 'CANCELLED');
    assert.equal(await db.inventoryMovement.count({ where: { productId: { in: productIds }, kind: 'RELEASE' } }), 2);
  } finally {
    await db.orderItem.deleteMany({ where: { orderId } });
    await db.order.deleteMany({ where: { id: orderId } });
    await db.inventoryMovement.deleteMany({ where: { productId: { in: productIds } } });
    await db.product.deleteMany({ where: { id: { in: productIds } } });
    await db.$disconnect();
  }
});
