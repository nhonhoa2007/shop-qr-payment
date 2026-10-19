import { applyInventoryMovement } from '@server/modules/inventory/inventory-ledger.service';

export interface AdjustStockViaLedgerInput {
  operationKey: string;
  productId: string;
  variantId?: string | null;
  delta: number;
  reason: string;
  actorId: string;
  expectedVersion?: number;
}

export async function migrateStockAdjustmentsToMovements(
  tx: any
): Promise<{ migratedCount: number; skippedCount: number }> {
  let migratedCount = 0;
  let skippedCount = 0;

  if (!('stockAdjustment' in tx) || typeof (tx as any).stockAdjustment?.findMany !== 'function') {
    return { migratedCount: 0, skippedCount: 0 };
  }

  const legacyAdjustments = await tx.stockAdjustment.findMany();

  for (const adj of legacyAdjustments) {
    const existing = await tx.inventoryMovement.findUnique({
      where: { operationKey: adj.operationKey },
    });

    if (existing) {
      skippedCount++;
      continue;
    }

    await tx.inventoryMovement.create({
      data: {
        operationKey: adj.operationKey,
        payloadFingerprint: null,
        productId: adj.productId,
        variantId: adj.variantId ?? null,
        kind: 'ADJUST',
        deltaOnHand: adj.delta,
        deltaReserved: 0,
        deltaQuarantined: 0,
        beforeOnHand: adj.previousStock,
        afterOnHand: adj.newStock,
        beforeReserved: 0,
        afterReserved: 0,
        beforeQuarantined: 0,
        afterQuarantined: 0,
        beforeAvailable: adj.previousStock,
        afterAvailable: adj.newStock,
        beforeVersion: Math.max(0, adj.version - 1),
        afterVersion: adj.version,
        reason: adj.reason,
        actorId: adj.actorId,
        referenceType: 'STOCK_ADJUSTMENT',
        referenceId: adj.id,
        createdAt: adj.createdAt,
      },
    });

    migratedCount++;
  }

  return { migratedCount, skippedCount };
}

export async function adjustStockViaLedger(
  tx: any,
  input: AdjustStockViaLedgerInput
): Promise<{ success: boolean; newStock: number; error?: string }> {
  try {
    const projection = await applyInventoryMovement(tx, {
      operationKey: input.operationKey,
      target: { productId: input.productId, variantId: input.variantId },
      kind: 'ADJUST',
      deltaOnHand: input.delta,
      deltaReserved: 0,
      deltaQuarantined: 0,
      reason: input.reason,
      actorId: input.actorId,
      referenceType: 'MANUAL_ADJUSTMENT',
      referenceId: input.operationKey,
    });

    return {
      success: true,
      newStock: projection.availableStock,
    };
  } catch (err: any) {
    return {
      success: false,
      newStock: 0,
      error: err.message || 'Lỗi điều chỉnh tồn kho',
    };
  }
}
