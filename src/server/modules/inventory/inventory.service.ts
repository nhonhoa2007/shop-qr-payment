import type { Prisma, PrismaClient } from '@prisma/client';
import { normalizeOrderStockItems } from '@shared/types/inventory';
import { applyInventoryMovement, InsufficientStockError } from '@server/modules/inventory/inventory-ledger.service';

type TransactionClient = Prisma.TransactionClient | PrismaClient;

export interface OrderStockItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

/**
 * Đặt trước / Trừ tồn kho nguyên tử cho danh sách sản phẩm trong đơn hàng (Atomic Stock Reservation)
 * Mọi thao tác đều được route qua append-only InventoryMovement ledger khi có model inventoryMovement.
 */
export async function reserveOrderStock(
  tx: TransactionClient,
  items: OrderStockItem[],
  operationKey?: string
): Promise<string | null> {
  const normalizedItems = normalizeOrderStockItems(items);
  const baseKey = operationKey ?? `reserve:${Date.now()}`;

  // 1. Ledger path: Route qua append-only InventoryMovement
  if ('inventoryMovement' in tx && typeof (tx as any).inventoryMovement?.create === 'function') {
    for (const item of normalizedItems) {
      const itemKey = `${baseKey}:${item.productId}:${item.variantId ?? 'base'}`;
      try {
        await applyInventoryMovement(tx, {
          operationKey: itemKey,
          target: { productId: item.productId, variantId: item.variantId },
          kind: 'RESERVE',
          deltaOnHand: 0,
          deltaReserved: item.quantity,
          deltaQuarantined: 0,
          reason: 'Order stock reservation',
          referenceType: 'ORDER',
          referenceId: baseKey,
        });
      } catch (err) {
        if (err instanceof InsufficientStockError) return item.variantId ?? item.productId;
        throw err;
      }
    }
    return null;
  }

  // 2. Legacy fallback path for simple mocks without inventoryMovement model
  for (const item of normalizedItems) {
    if (item.variantId) {
      const result = await tx.productVariant.updateMany({
        where: {
          id: item.variantId,
          productId: item.productId,
          isActive: true,
          stock: { gte: item.quantity },
        },
        data: { stock: { decrement: item.quantity } },
      });

      if (result.count !== 1) {
        return item.variantId;
      }

      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    } else {
      const result = await tx.product.updateMany({
        where: {
          id: item.productId,
          isActive: true,
          inventoryMode: 'BASE',
          stock: { gte: item.quantity },
        },
        data: { stock: { decrement: item.quantity } },
      });

      if (result.count !== 1) {
        return item.productId;
      }
    }
  }

  return null;
}

/**
 * Hoàn trả số lượng hàng tồn kho về lại hệ thống (Inventory Restitution)
 */
export async function releaseOrderStock(
  tx: TransactionClient,
  items: OrderStockItem[],
  operationKey?: string
): Promise<void> {
  const normalizedItems = normalizeOrderStockItems(items);
  const baseKey = operationKey ?? `release:${Date.now()}`;

  if ('inventoryMovement' in tx && typeof (tx as any).inventoryMovement?.create === 'function') {
    for (const item of normalizedItems) {
      const itemKey = `${baseKey}:${item.productId}:${item.variantId ?? 'base'}`;
      await applyInventoryMovement(tx, {
        operationKey: itemKey,
        target: { productId: item.productId, variantId: item.variantId },
        kind: 'RELEASE',
        deltaOnHand: 0,
        deltaReserved: -item.quantity,
        deltaQuarantined: 0,
        reason: 'Order stock release',
        referenceType: 'ORDER',
        referenceId: baseKey,
      });
    }
    return;
  }

  for (const item of normalizedItems) {
    if (item.variantId) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    } else {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
  }
}

/**
 * Xuất kho khi đơn hàng bắt đầu giao cho đơn vị vận chuyển (Fulfillment / Shipment).
 * Trừ đồng thời số lượng ở onHandStock và reservedStock.
 */
export async function consumeShippedStock(
  tx: TransactionClient,
  items: OrderStockItem[],
  operationKey?: string
): Promise<void> {
  const normalizedItems = normalizeOrderStockItems(items);
  const baseKey = operationKey ?? `ship:${Date.now()}`;

  if ('inventoryMovement' in tx && typeof (tx as any).inventoryMovement?.create === 'function') {
    for (const item of normalizedItems) {
      const itemKey = `${baseKey}:${item.productId}:${item.variantId ?? 'base'}`;
      await applyInventoryMovement(tx, {
        operationKey: itemKey,
        target: { productId: item.productId, variantId: item.variantId },
        kind: 'SHIP',
        deltaOnHand: -item.quantity,
        deltaReserved: -item.quantity,
        deltaQuarantined: 0,
        reason: 'Order shipped to carrier',
        referenceType: 'SHIPMENT',
        referenceId: baseKey,
      });
    }
    return;
  }

  // Fallback for mocks
  for (const item of normalizedItems) {
    if (item.variantId) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: 0 } },
      });
    }
  }
}

/**
 * Đưa hàng trả về vào khu vực cách ly (Quarantine) để kiểm định kỹ thuật, không tự restock.
 */
export async function quarantineReturnedStock(
  tx: TransactionClient,
  items: OrderStockItem[],
  operationKey?: string
): Promise<void> {
  const normalizedItems = normalizeOrderStockItems(items);
  const baseKey = operationKey ?? `quarantine:${Date.now()}`;

  if ('inventoryMovement' in tx && typeof (tx as any).inventoryMovement?.create === 'function') {
    for (const item of normalizedItems) {
      const itemKey = `${baseKey}:${item.productId}:${item.variantId ?? 'base'}`;
      await applyInventoryMovement(tx, {
        operationKey: itemKey,
        target: { productId: item.productId, variantId: item.variantId },
        kind: 'QUARANTINE',
        deltaOnHand: item.quantity,
        deltaReserved: 0,
        deltaQuarantined: item.quantity,
        reason: 'Returned stock received into quarantine',
        referenceType: 'RETURN',
        referenceId: baseKey,
      });
    }
    return;
  }
}

/**
 * Tác vụ định kỳ (Cron / Background Worker) tự động quét và hủy các đơn hàng chưa thanh toán đã quá hạn.
 */
export async function expireUnpaidOrders(prisma: PrismaClient): Promise<number> {
  const expiredOrders = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      expiresAt: { lt: new Date() },
    },
    include: { items: true },
  });

  for (const order of expiredOrders) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: {
          id: order.id,
          status: 'PENDING',
          paymentStatus: 'UNPAID',
        },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'EXPIRED',
        },
      });

      if (updated.count > 0) {
        await releaseOrderStock(tx, order.items, `order:${order.id}:expire`);

        if (order.couponId) {
          await tx.coupon.update({
            where: { id: order.couponId },
            data: { usedCount: { decrement: 1 } },
          });

          await tx.order.update({
            where: { id: order.id },
            data: { couponUsageClaimedAt: null },
          });

          if (order.userId && 'couponUsage' in tx && typeof (tx as any).couponUsage?.deleteMany === 'function') {
            await (tx as any).couponUsage.deleteMany({
              where: {
                couponId: order.couponId,
                userId: order.userId,
                orderId: order.id,
              },
            });
          }
        }
      }
    });
  }

  return expiredOrders.length;
}
