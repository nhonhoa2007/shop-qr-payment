import { createHash } from 'node:crypto';
import type {
  ApplyMovementInput,
  InventoryProjectionDto,
  LedgerReconciliationReport,
  StockTarget,
} from '@shared/types/inventory-ledger';

export class InsufficientStockError extends Error {}

export function computeMovementFingerprint(input: ApplyMovementInput): string {
  const normalized = {
    target: {
      productId: input.target.productId,
      variantId: input.target.variantId ?? null,
    },
    kind: input.kind,
    deltaOnHand: input.deltaOnHand,
    deltaReserved: input.deltaReserved,
    deltaQuarantined: input.deltaQuarantined,
    reason: input.reason.trim(),
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    purchaseOrderItemId: input.purchaseOrderItemId ?? null,
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export async function applyInventoryMovement(
  tx: any,
  input: ApplyMovementInput
): Promise<InventoryProjectionDto> {
  const fingerprint = input.payloadFingerprint ?? computeMovementFingerprint(input);

  // 1. Idempotency check: check if operationKey already exists
  const existingMovement = await tx.inventoryMovement.findUnique({
    where: { operationKey: input.operationKey },
  });

  if (existingMovement) {
    const existingFingerprint =
      existingMovement.payloadFingerprint ??
      computeMovementFingerprint({
        operationKey: existingMovement.operationKey,
        target: {
          productId: existingMovement.productId,
          variantId: existingMovement.variantId,
        },
        kind: existingMovement.kind,
        deltaOnHand: existingMovement.deltaOnHand,
        deltaReserved: existingMovement.deltaReserved,
        deltaQuarantined: existingMovement.deltaQuarantined,
        reason: existingMovement.reason,
        referenceType: existingMovement.referenceType,
        referenceId: existingMovement.referenceId,
        purchaseOrderItemId: existingMovement.purchaseOrderItemId ?? undefined,
      });

    if (existingFingerprint !== fingerprint) {
      throw new Error(
        `Operation key conflict: operationKey '${input.operationKey}' already exists with different payload`
      );
    }

    // Replay with exact same payload: return current projection
    return getInventoryProjection(tx, input.target);
  }

  // 2. Load target entity
  const isVariant = Boolean(input.target.variantId);
  let parentProduct: any = null;
  let targetEntity: any = null;

  if (isVariant) {
    const variant = await tx.productVariant.findUnique({
      where: { id: input.target.variantId },
    });
    if (!variant || variant.productId !== input.target.productId) {
      throw new Error(
        `Product variant '${input.target.variantId}' not found for product '${input.target.productId}'`
      );
    }
    targetEntity = variant;

    parentProduct = await tx.product.findUnique({
      where: { id: input.target.productId },
    });
    if (!parentProduct) {
      throw new Error(`Parent product '${input.target.productId}' not found`);
    }
  } else {
    const product = await tx.product.findUnique({
      where: { id: input.target.productId },
    });
    if (!product) {
      throw new Error(`Product '${input.target.productId}' not found`);
    }
    targetEntity = product;
  }

  // 3. Current projection values
  const beforeOnHand = targetEntity.onHandStock ?? targetEntity.stock ?? 0;
  const beforeReserved = targetEntity.reservedStock ?? 0;
  const beforeQuarantined = targetEntity.quarantinedStock ?? 0;
  const beforeAvailable = beforeOnHand - beforeReserved - beforeQuarantined;
  const beforeVersion = targetEntity.stockVersion ?? 0;

  // 4. Compute target projection
  const afterOnHand = beforeOnHand + input.deltaOnHand;
  const afterReserved = beforeReserved + input.deltaReserved;
  const afterQuarantined = beforeQuarantined + input.deltaQuarantined;
  const afterAvailable = afterOnHand - afterReserved - afterQuarantined;
  const afterVersion = beforeVersion + 1;

  // 5. Check invariants
  if (afterOnHand < 0) {
    throw new Error(`Negative on-hand stock not allowed: ${afterOnHand} < 0`);
  }
  if (afterReserved < 0) {
    throw new Error(`Negative reserved stock not allowed: ${afterReserved} < 0`);
  }
  if (afterQuarantined < 0) {
    throw new Error(`Negative quarantined stock not allowed: ${afterQuarantined} < 0`);
  }
  if (afterAvailable < 0) {
    throw new InsufficientStockError(`Insufficient stock: available stock cannot be negative (${afterAvailable})`);
  }

  const deltaStock = afterAvailable - beforeAvailable;

  // 6. CAS update on projection fields
  if (isVariant) {
    const updateResult = await tx.productVariant.updateMany({
      where: {
        id: targetEntity.id,
        stockVersion: beforeVersion,
        isActive: true,
      },
      data: {
        onHandStock: { increment: input.deltaOnHand },
        reservedStock: { increment: input.deltaReserved },
        quarantinedStock: { increment: input.deltaQuarantined },
        stock: { increment: deltaStock },
        stockVersion: { increment: 1 },
      },
    });

    if (updateResult.count === 0) {
      throw new Error(
        `Concurrent stock modification detected for variant '${targetEntity.id}' (expected version ${beforeVersion})`
      );
    }

    // Synchronize parent product projection atomically
    await tx.product.update({
      where: { id: parentProduct.id },
      data: {
        onHandStock: { increment: input.deltaOnHand },
        reservedStock: { increment: input.deltaReserved },
        quarantinedStock: { increment: input.deltaQuarantined },
        stock: { increment: deltaStock },
        stockVersion: { increment: 1 },
      },
    });
  } else {
    const updateResult = await tx.product.updateMany({
      where: {
        id: targetEntity.id,
        stockVersion: beforeVersion,
        isActive: true,
      },
      data: {
        onHandStock: { increment: input.deltaOnHand },
        reservedStock: { increment: input.deltaReserved },
        quarantinedStock: { increment: input.deltaQuarantined },
        stock: { increment: deltaStock },
        stockVersion: { increment: 1 },
      },
    });

    if (updateResult.count === 0) {
      throw new Error(
        `Concurrent stock modification detected for product '${targetEntity.id}' (expected version ${beforeVersion})`
      );
    }
  }

  // 7. Insert append-only movement
  await tx.inventoryMovement.create({
    data: {
      operationKey: input.operationKey,
      payloadFingerprint: fingerprint,
      productId: input.target.productId,
      variantId: input.target.variantId ?? null,
      kind: input.kind,
      deltaOnHand: input.deltaOnHand,
      deltaReserved: input.deltaReserved,
      deltaQuarantined: input.deltaQuarantined,
      beforeOnHand,
      afterOnHand,
      beforeReserved,
      afterReserved,
      beforeQuarantined,
      afterQuarantined,
      beforeAvailable,
      afterAvailable,
      beforeVersion,
      afterVersion,
      reason: input.reason,
      actorId: input.actorId ?? null,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      purchaseOrderItemId: input.purchaseOrderItemId ?? null,
    },
  });

  return {
    target: input.target,
    onHandStock: afterOnHand,
    reservedStock: afterReserved,
    quarantinedStock: afterQuarantined,
    availableStock: afterAvailable,
    stockVersion: afterVersion,
  };
}

export async function getInventoryProjection(
  tx: any,
  target: StockTarget
): Promise<InventoryProjectionDto> {
  if (target.variantId) {
    const variant = await tx.productVariant.findUnique({
      where: { id: target.variantId },
    });
    if (!variant) throw new Error(`Variant '${target.variantId}' not found`);
    const onHand = variant.onHandStock ?? variant.stock ?? 0;
    const reserved = variant.reservedStock ?? 0;
    const quarantined = variant.quarantinedStock ?? 0;
    return {
      target,
      onHandStock: onHand,
      reservedStock: reserved,
      quarantinedStock: quarantined,
      availableStock: onHand - reserved - quarantined,
      stockVersion: variant.stockVersion ?? 0,
    };
  }

  const product = await tx.product.findUnique({
    where: { id: target.productId },
  });
  if (!product) throw new Error(`Product '${target.productId}' not found`);
  const onHand = product.onHandStock ?? product.stock ?? 0;
  const reserved = product.reservedStock ?? 0;
  const quarantined = product.quarantinedStock ?? 0;
  return {
    target,
    onHandStock: onHand,
    reservedStock: reserved,
    quarantinedStock: quarantined,
    availableStock: onHand - reserved - quarantined,
    stockVersion: product.stockVersion ?? 0,
  };
}

export async function reconcileInventoryLedger(
  tx: any,
  target: StockTarget
): Promise<LedgerReconciliationReport> {
  const movements = await tx.inventoryMovement.findMany({
    where: {
      productId: target.productId,
      variantId: target.variantId ?? null,
    },
  });

  let sumOnHand = 0;
  let sumReserved = 0;
  let sumQuarantined = 0;

  for (const m of movements) {
    sumOnHand += m.deltaOnHand;
    sumReserved += m.deltaReserved;
    sumQuarantined += m.deltaQuarantined;
  }

  const projection = await getInventoryProjection(tx, target);

  const isReconciled =
    sumOnHand === projection.onHandStock &&
    sumReserved === projection.reservedStock &&
    sumQuarantined === projection.quarantinedStock;

  return {
    target,
    isReconciled,
    sumOnHand,
    sumReserved,
    sumQuarantined,
    projectionOnHand: projection.onHandStock,
    projectionReserved: projection.reservedStock,
    projectionQuarantined: projection.quarantinedStock,
    movementCount: movements.length,
  };
}

function needsLegacyOpening(entity: { stock?: number | null; onHandStock?: number | null; reservedStock?: number | null; quarantinedStock?: number | null }): boolean {
  return (entity.stock ?? 0) > 0 && entity.onHandStock === 0 && entity.reservedStock === 0 && entity.quarantinedStock === 0;
}

export async function backfillOpeningLegacyMovements(
  tx: any
): Promise<{ createdCount: number }> {
  let createdCount = 0;

  // 1. Process variants first (if any exist with stock > 0)
  const variants = await tx.productVariant.findMany({
    where: { stock: { gt: 0 } },
  });

  for (const variant of variants) {
    if (!needsLegacyOpening(variant)) continue;
    const movements = await tx.inventoryMovement.findMany({
      where: { productId: variant.productId, variantId: variant.id },
      take: 1,
    });
    if (movements.length === 0) {
      const stock = variant.stock ?? 0;
      const updated = await tx.productVariant.updateMany({
        where: { id: variant.id, stock, onHandStock: 0, reservedStock: 0, quarantinedStock: 0, stockVersion: variant.stockVersion },
        data: {
          onHandStock: stock,
          reservedStock: 0,
          quarantinedStock: 0,
        },
      });
      if (updated.count !== 1) throw new Error(`Legacy variant stock changed during backfill: ${variant.id}`);

      await tx.inventoryMovement.create({
        data: {
          operationKey: `opening:legacy:variant:${variant.id}`,
          payloadFingerprint: null,
          productId: variant.productId,
          variantId: variant.id,
          kind: 'OPENING_LEGACY',
          deltaOnHand: stock,
          deltaReserved: 0,
          deltaQuarantined: 0,
          beforeOnHand: 0,
          afterOnHand: stock,
          beforeReserved: 0,
          afterReserved: 0,
          beforeQuarantined: 0,
          afterQuarantined: 0,
          beforeAvailable: 0,
          afterAvailable: stock,
          beforeVersion: variant.stockVersion ?? 0,
          afterVersion: variant.stockVersion ?? 0,
          reason: 'Initial baseline stock backfill',
          referenceType: 'SYSTEM',
          referenceId: 'legacy_init',
        },
      });
      createdCount++;
    }
  }

  // 2. Process base products (BASE mode, or standalone products)
  const products = await tx.product.findMany({
    where: { stock: { gt: 0 } },
  });

  for (const product of products) {
    if (!needsLegacyOpening(product)) continue;
    const movements = await tx.inventoryMovement.findMany({
      where: { productId: product.id, variantId: null },
      take: 1,
    });
    if (movements.length === 0) {
      const stock = product.stock ?? 0;
      const updated = await tx.product.updateMany({
        where: { id: product.id, stock, onHandStock: 0, reservedStock: 0, quarantinedStock: 0, stockVersion: product.stockVersion },
        data: {
          onHandStock: stock,
          reservedStock: 0,
          quarantinedStock: 0,
        },
      });
      if (updated.count !== 1) throw new Error(`Legacy product stock changed during backfill: ${product.id}`);

      await tx.inventoryMovement.create({
        data: {
          operationKey: `opening:legacy:product:${product.id}`,
          payloadFingerprint: null,
          productId: product.id,
          variantId: null,
          kind: 'OPENING_LEGACY',
          deltaOnHand: stock,
          deltaReserved: 0,
          deltaQuarantined: 0,
          beforeOnHand: 0,
          afterOnHand: stock,
          beforeReserved: 0,
          afterReserved: 0,
          beforeQuarantined: 0,
          afterQuarantined: 0,
          beforeAvailable: 0,
          afterAvailable: stock,
          beforeVersion: product.stockVersion ?? 0,
          afterVersion: product.stockVersion ?? 0,
          reason: 'Initial baseline stock backfill',
          referenceType: 'SYSTEM',
          referenceId: 'legacy_init',
        },
      });
      createdCount++;
    }
  }

  return { createdCount };
}
