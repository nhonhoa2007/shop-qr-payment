import type { PrismaClient } from '@prisma/client';

export type DiscrepancySeverity = 'CRITICAL' | 'WARNING';

export interface InventoryDiscrepancy {
  type:
    | 'PARENT_STOCK_MISMATCH'
    | 'MOVEMENT_SUM_MISMATCH'
    | 'NEGATIVE_STOCK'
    | 'SERIAL_COUNT_MISMATCH'
    | 'SERIAL_ORDER_MISMATCH';
  severity: DiscrepancySeverity;
  message: string;
  productId?: string;
  variantId?: string;
  unitId?: string;
  expected?: number;
  actual?: number;
  details?: Record<string, unknown>;
}

export interface InventoryReconciliationReport {
  status: 'CLEAN' | 'DISCREPANCIES_DETECTED';
  repairAttempted: false;
  totalProductsChecked: number;
  totalVariantsChecked: number;
  totalMovementsChecked: number;
  totalSerialsChecked: number;
  discrepancies: InventoryDiscrepancy[];
  generatedAt: string;
}

export interface MoneyDiscrepancy {
  type:
    | 'WALLET_LEDGER_MISMATCH'
    | 'REFUND_EXCEEDS_ENTITLEMENT'
    | 'PAID_ORDER_PAYMENT_MISSING'
    | 'DUPLICATE_PAYMENT_REFERENCE';
  severity: DiscrepancySeverity;
  message: string;
  walletId?: string;
  orderId?: string;
  expected?: string;
  actual?: string;
  details?: Record<string, unknown>;
}

export interface MoneyReconciliationReport {
  status: 'CLEAN' | 'DISCREPANCIES_DETECTED';
  totalWalletsChecked: number;
  totalOrdersChecked: number;
  totalTransactionsChecked: number;
  discrepancies: MoneyDiscrepancy[];
  generatedAt: string;
}

/**
 * Reconciles inventory stock projections against immutable movements and serials in read-only mode.
 */
export async function reconcileInventory(
  db: PrismaClient,
  options?: { repair?: boolean }
): Promise<InventoryReconciliationReport> {
  if (options?.repair === true) {
    throw new Error(
      'Read-only reconciliation: repair mode is strictly forbidden. Discrepancies must be reviewed through approved ADR or explicit administrative workflows.'
    );
  }

  const discrepancies: InventoryDiscrepancy[] = [];

  const products = await db.product.findMany({
    include: {
      variants: true,
    },
  });

  const movements = await db.inventoryMovement.findMany();
  const serializedUnits = await db.serializedUnit.findMany({
    include: {
      orderItem: true,
    },
  });

  let totalVariants = 0;

  // Group movements by variantId
  const movementsByVariant = new Map<string, number>();
  for (const m of movements) {
    if (m.variantId) {
      const delta = (m as any).deltaOnHand ?? (m as any).delta ?? 0;
      const current = movementsByVariant.get(m.variantId) ?? 0;
      movementsByVariant.set(m.variantId, current + delta);
    }
  }

  // Group serials by variantId
  const serialsByVariant = new Map<string, typeof serializedUnits>();
  for (const u of serializedUnits) {
    if (u.variantId) {
      const list = serialsByVariant.get(u.variantId) ?? [];
      list.push(u);
      serialsByVariant.set(u.variantId, list);
    }
  }

  for (const product of products) {
    totalVariants += product.variants.length;

    // 1. Negative stock check on Product
    if (product.stock < 0) {
      discrepancies.push({
        type: 'NEGATIVE_STOCK',
        severity: 'CRITICAL',
        message: `Product ${product.id} (${product.name}) has negative stock (${product.stock})`,
        productId: product.id,
        actual: product.stock,
      });
    }

    // 2. Parent-variant stock sum check
    const variantStockSum = product.variants.reduce((acc, v) => acc + v.stock, 0);
    if (product.stock !== variantStockSum) {
      discrepancies.push({
        type: 'PARENT_STOCK_MISMATCH',
        severity: 'CRITICAL',
        message: `Product ${product.id} stock (${product.stock}) does not match sum of its variants (${variantStockSum})`,
        productId: product.id,
        expected: variantStockSum,
        actual: product.stock,
      });
    }

    // 3. Variant checks
    for (const variant of product.variants) {
      if (variant.stock < 0) {
        discrepancies.push({
          type: 'NEGATIVE_STOCK',
          severity: 'CRITICAL',
          message: `Variant ${variant.id} (${variant.sku}) has negative stock (${variant.stock})`,
          productId: product.id,
          variantId: variant.id,
          actual: variant.stock,
        });
      }

      // Movement ledger check if movements exist
      if (movementsByVariant.has(variant.id)) {
        const movementSum = movementsByVariant.get(variant.id)!;
        if (movementSum !== variant.stock) {
          discrepancies.push({
            type: 'MOVEMENT_SUM_MISMATCH',
            severity: 'CRITICAL',
            message: `Variant ${variant.id} (${variant.sku}) stock (${variant.stock}) does not match inventory movement ledger sum (${movementSum})`,
            productId: product.id,
            variantId: variant.id,
            expected: movementSum,
            actual: variant.stock,
          });
        }
      }

      // Serialized unit check
      if (variant.serializationRequired) {
        const units = serialsByVariant.get(variant.id) ?? [];
        const inStockCount = units.filter((u) => u.status === 'AVAILABLE' || (u.status as string) === 'IN_STOCK').length;
        if (inStockCount !== variant.stock) {
          discrepancies.push({
            type: 'SERIAL_COUNT_MISMATCH',
            severity: 'CRITICAL',
            message: `Serialized variant ${variant.id} (${variant.sku}) stock (${variant.stock}) does not match in-stock serialized units count (${inStockCount})`,
            productId: product.id,
            variantId: variant.id,
            expected: variant.stock,
            actual: inStockCount,
          });
        }
      }
    }
  }

  // 4. Serial order assignment check
  for (const unit of serializedUnits) {
    if (unit.orderItemId) {
      if (unit.orderItem && unit.orderItem.variantId !== unit.variantId) {
        discrepancies.push({
          type: 'SERIAL_ORDER_MISMATCH',
          severity: 'CRITICAL',
          message: `Serialized unit ${unit.id} variant (${unit.variantId}) does not match assigned order item variant (${unit.orderItem.variantId})`,
          variantId: unit.variantId ?? undefined,
          unitId: unit.id,
          details: {
            orderItemId: unit.orderItemId,
            orderItemVariantId: unit.orderItem.variantId,
          },
        });
      }
    }
  }

  return {
    status: discrepancies.length === 0 ? 'CLEAN' : 'DISCREPANCIES_DETECTED',
    repairAttempted: false,
    totalProductsChecked: products.length,
    totalVariantsChecked: totalVariants,
    totalMovementsChecked: movements.length,
    totalSerialsChecked: serializedUnits.length,
    discrepancies,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Reconciles financial ledgers, wallets, orders, bank transfers, and refunds in read-only mode.
 */
export async function reconcileMoney(
  db: PrismaClient
): Promise<MoneyReconciliationReport> {
  const discrepancies: MoneyDiscrepancy[] = [];

  const wallets = await db.userWallet.findMany();
  const walletTransactions = await db.walletTransaction.findMany();
  const orders = await (db.order.findMany as any)({
    include: {
      bankTransfers: true,
      refundCases: true,
      items: true,
    },
  });

  // Group wallet transactions by walletId
  const transactionsByWallet = new Map<string, bigint>();
  for (const tx of walletTransactions) {
    const current = transactionsByWallet.get(tx.walletId) ?? 0n;
    transactionsByWallet.set(tx.walletId, current + BigInt(tx.amount));
  }

  // 1. Wallet ledger consistency check
  for (const wallet of wallets) {
    const expectedBalance = transactionsByWallet.get(wallet.id) ?? 0n;
    const actualBalance = BigInt(wallet.balance);

    if (expectedBalance !== actualBalance) {
      discrepancies.push({
        type: 'WALLET_LEDGER_MISMATCH',
        severity: 'CRITICAL',
        message: `Wallet ${wallet.id} balance (${actualBalance}) does not match sum of transactions (${expectedBalance})`,
        walletId: wallet.id,
        expected: expectedBalance.toString(),
        actual: actualBalance.toString(),
        details: {
          maskedUserId: wallet.userId.slice(0, 8) + '***',
        },
      });
    }
  }

  // 2. Order payments and refund entitlements check
  for (const order of orders as any[]) {
    const orderTotal = BigInt(order.totalAmount);

    // Check refund ceiling
    const completedRefunds = ((order.refundCases ?? []) as any[]).filter(
      (r: any) => r.status === 'COMPLETED'
    );
    const totalRefunded = completedRefunds.reduce(
      (acc: bigint, r: any) => acc + BigInt(r.amount),
      0n
    );

    if (totalRefunded > orderTotal) {
      discrepancies.push({
        type: 'REFUND_EXCEEDS_ENTITLEMENT',
        severity: 'CRITICAL',
        message: `Order ${order.orderCode} (${order.id}) total completed refunds (${totalRefunded}) exceeds order total (${orderTotal})`,
        orderId: order.id,
        expected: orderTotal.toString(),
        actual: totalRefunded.toString(),
        details: {
          orderCode: order.orderCode,
        },
      });
    }

    // Check paid orders have recorded payment
    if (order.paymentStatus === 'PAID') {
      const transfers = ((order.bankTransfers ?? []) as any[]);
      const validTransfers = transfers.filter(
        (bt: any) => bt.status === 'APPLIED_ORDER'
      );
      const totalPaid = validTransfers.reduce(
        (acc: bigint, bt: any) => acc + BigInt(bt.amount),
        0n
      );

      // If order is PAID via bank transfer or QR, verify payment exists
      if (transfers.length === 0 || (validTransfers.length > 0 && totalPaid < orderTotal)) {
        discrepancies.push({
          type: 'PAID_ORDER_PAYMENT_MISSING',
          severity: 'CRITICAL',
          message: `Order ${order.orderCode} is marked PAID but valid bank transfer payments (${totalPaid}) are below order total (${orderTotal})`,
          orderId: order.id,
          expected: orderTotal.toString(),
          actual: totalPaid.toString(),
          details: {
            orderCode: order.orderCode,
            transfersFound: validTransfers.length,
          },
        });
      }
    }
  }

  return {
    status: discrepancies.length === 0 ? 'CLEAN' : 'DISCREPANCIES_DETECTED',
    totalWalletsChecked: wallets.length,
    totalOrdersChecked: orders.length,
    totalTransactionsChecked: walletTransactions.length,
    discrepancies,
    generatedAt: new Date().toISOString(),
  };
}
