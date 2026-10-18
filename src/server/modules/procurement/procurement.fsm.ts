import type { PurchaseOrderStatus, CreatePoInput } from '@shared/types/procurement';

const VALID_PO_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: ['ORDERED', 'CANCELLED'],
  ORDERED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['RECEIVED'],
  RECEIVED: [],
  CANCELLED: [],
};

export function canTransitionPurchaseOrder(
  currentStatus: PurchaseOrderStatus,
  nextStatus: PurchaseOrderStatus
): { allowed: boolean; reason?: string } {
  if (currentStatus === nextStatus) {
    return { allowed: true };
  }

  const allowedNext = VALID_PO_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(nextStatus)) {
    return {
      allowed: false,
      reason: `Cannot transition purchase order from ${currentStatus} to ${nextStatus}`,
    };
  }

  return { allowed: true };
}

export function validateCreatePoInput(input: CreatePoInput): void {
  if (!input.supplierId || typeof input.supplierId !== 'string' || !input.supplierId.trim()) {
    throw new Error('supplierId is required');
  }

  if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
    throw new Error('Purchase order must contain at least one item');
  }

  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i];
    if (!item.productId || typeof item.productId !== 'string') {
      throw new Error(`Item [${i}] productId is required`);
    }

    if (!Number.isInteger(item.orderedQuantity) || item.orderedQuantity <= 0) {
      throw new Error(`Item [${i}] must have a positive quantity (got ${item.orderedQuantity})`);
    }

    const unitCost = BigInt(item.unitCost ?? 0);
    if (unitCost < 0n) {
      throw new Error(`Item [${i}] unit cost cannot be negative`);
    }
  }
}

export function calculatePoTotals(
  items: Array<{ orderedQuantity: number; unitCost: bigint | number | string }>
): { lineTotals: bigint[]; totalAmount: bigint } {
  let totalAmount = 0n;
  const lineTotals: bigint[] = [];

  for (const item of items) {
    const cost = BigInt(item.unitCost ?? 0);
    const lineTotal = cost * BigInt(item.orderedQuantity);
    lineTotals.push(lineTotal);
    totalAmount += lineTotal;
  }

  return { lineTotals, totalAmount };
}
