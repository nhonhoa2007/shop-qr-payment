import {
  canTransitionPurchaseOrder,
  validateCreatePoInput,
  calculatePoTotals,
} from '@server/modules/procurement/procurement.fsm';
import { applyInventoryMovement } from '@server/modules/inventory/inventory-ledger.service';
import type {
  CreatePoInput,
  PoTransitionInput,
  PurchaseOrderDto,
  ReceivePoInput,
  ReceiptResultDto,
  ReceiptItemResultDto,
  PurchaseOrderStatus,
} from '@shared/types/procurement';

export async function createPurchaseOrder(
  tx: any,
  input: CreatePoInput
): Promise<PurchaseOrderDto> {
  validateCreatePoInput(input);

  const supplier = await tx.supplier.findUnique({
    where: { id: input.supplierId },
  });
  if (!supplier) {
    throw new Error(`Supplier '${input.supplierId}' not found`);
  }

  const { totalAmount } = calculatePoTotals(input.items);
  const poNumber = input.poNumber || `PO-${Date.now()}`;

  const po = await tx.purchaseOrder.create({
    data: {
      poNumber,
      supplierId: input.supplierId,
      status: 'DRAFT',
      totalAmount,
      currency: 'VND',
      expectedDeliveryAt: input.expectedDeliveryAt ? new Date(input.expectedDeliveryAt) : null,
      notes: input.notes ?? null,
      createdById: input.createdById ?? null,
    },
  });

  const createdItems = [];
  for (const item of input.items) {
    const unitCost = BigInt(item.unitCost ?? 0);
    const poi = await tx.purchaseOrderItem.create({
      data: {
        purchaseOrderId: po.id,
        productId: item.productId,
        variantId: item.variantId ?? null,
        orderedQuantity: item.orderedQuantity,
        receivedQuantity: 0,
        unitCost,
      },
    });
    createdItems.push(poi);
  }

  return {
    id: po.id,
    poNumber: po.poNumber,
    supplierId: po.supplierId,
    status: po.status as PurchaseOrderStatus,
    totalAmount: totalAmount.toString(),
    currency: po.currency,
    orderedAt: po.orderedAt,
    expectedDeliveryAt: po.expectedDeliveryAt,
    notes: po.notes,
    createdById: po.createdById,
    items: createdItems.map((item) => ({
      id: item.id,
      purchaseOrderId: item.purchaseOrderId,
      productId: item.productId,
      variantId: item.variantId,
      orderedQuantity: item.orderedQuantity,
      receivedQuantity: item.receivedQuantity,
      remainingQuantity: item.orderedQuantity - item.receivedQuantity,
      unitCost: item.unitCost.toString(),
      totalCost: (BigInt(item.unitCost) * BigInt(item.orderedQuantity)).toString(),
    })),
    createdAt: po.createdAt,
    updatedAt: po.updatedAt,
  };
}

export async function transitionPurchaseOrder(
  tx: any,
  input: PoTransitionInput
): Promise<PurchaseOrderDto> {
  const po = await tx.purchaseOrder.findUnique({
    where: { id: input.purchaseOrderId },
  });
  if (!po) {
    throw new Error(`Purchase order '${input.purchaseOrderId}' not found`);
  }

  const transitionCheck = canTransitionPurchaseOrder(
    po.status as PurchaseOrderStatus,
    input.nextStatus
  );
  if (!transitionCheck.allowed) {
    throw new Error(transitionCheck.reason || 'Invalid PO state transition');
  }

  const updateData: any = { status: input.nextStatus };
  if (input.nextStatus === 'ORDERED' && !po.orderedAt) {
    updateData.orderedAt = new Date();
  }

  const updated = await tx.purchaseOrder.update({
    where: { id: input.purchaseOrderId },
    data: updateData,
  });

  const items = await tx.purchaseOrderItem.findMany({
    where: { purchaseOrderId: po.id },
  });

  return {
    id: updated.id,
    poNumber: updated.poNumber,
    supplierId: updated.supplierId,
    status: updated.status as PurchaseOrderStatus,
    totalAmount: updated.totalAmount.toString(),
    currency: updated.currency,
    orderedAt: updated.orderedAt,
    expectedDeliveryAt: updated.expectedDeliveryAt,
    notes: updated.notes,
    createdById: updated.createdById,
    items: items.map((item: any) => ({
      id: item.id,
      purchaseOrderId: item.purchaseOrderId,
      productId: item.productId,
      variantId: item.variantId,
      orderedQuantity: item.orderedQuantity,
      receivedQuantity: item.receivedQuantity,
      remainingQuantity: item.orderedQuantity - item.receivedQuantity,
      unitCost: item.unitCost.toString(),
      totalCost: (BigInt(item.unitCost) * BigInt(item.orderedQuantity)).toString(),
    })),
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

export async function receivePurchaseOrderItems(
  tx: any,
  input: ReceivePoInput
): Promise<ReceiptResultDto> {
  const po = await tx.purchaseOrder.findUnique({
    where: { id: input.purchaseOrderId },
  });
  if (!po) {
    throw new Error(`Purchase order '${input.purchaseOrderId}' not found`);
  }

  if (po.status !== 'ORDERED' && po.status !== 'PARTIALLY_RECEIVED') {
    throw new Error(
      `Cannot receive items for purchase order in '${po.status}' status (must be ORDERED or PARTIALLY_RECEIVED)`
    );
  }

  // Idempotency / replay check: check if first item movement exists
  const firstItem = input.items[0];
  const firstItemOpKey = `${input.operationKey}:${firstItem.purchaseOrderItemId}`;
  const existingMovement = await tx.inventoryMovement.findUnique({
    where: { operationKey: firstItemOpKey },
  });

  if (existingMovement) {
    // Replay with same operationKey: return current receipt projection
    const allItems = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: po.id },
    });
    const isFullyReceived = allItems.every(
      (item: any) => item.receivedQuantity >= item.orderedQuantity
    );

    const receivedItemsResult: ReceiptItemResultDto[] = input.items.map((inpItem) => {
      const dbItem = allItems.find((it: any) => it.id === inpItem.purchaseOrderItemId)!;
      return {
        purchaseOrderItemId: dbItem.id,
        productId: dbItem.productId,
        variantId: dbItem.variantId,
        quantityReceived: inpItem.quantity,
        cumulativeReceivedQuantity: dbItem.receivedQuantity,
        orderedQuantity: dbItem.orderedQuantity,
        remainingQuantity: dbItem.orderedQuantity - dbItem.receivedQuantity,
        movementId: existingMovement.id,
      };
    });

    return {
      operationKey: input.operationKey,
      purchaseOrderId: po.id,
      status: po.status as PurchaseOrderStatus,
      isFullyReceived,
      receivedItems: receivedItemsResult,
    };
  }

  const receivedItemsResult: ReceiptItemResultDto[] = [];

  for (const itemInput of input.items) {
    const poItem = await tx.purchaseOrderItem.findUnique({
      where: { id: itemInput.purchaseOrderItemId },
    });
    if (!poItem || poItem.purchaseOrderId !== po.id) {
      throw new Error(`Purchase order item '${itemInput.purchaseOrderItemId}' not found on PO`);
    }

    const remaining = poItem.orderedQuantity - poItem.receivedQuantity;
    if (itemInput.quantity > remaining) {
      throw new Error(
        `Received quantity (${itemInput.quantity}) cannot exceed ordered quantity (remaining: ${remaining})`
      );
    }

    const itemOpKey = `${input.operationKey}:${poItem.id}`;
    await applyInventoryMovement(tx, {
      operationKey: itemOpKey,
      target: { productId: poItem.productId, variantId: poItem.variantId },
      kind: 'RECEIVE',
      deltaOnHand: itemInput.quantity,
      deltaReserved: 0,
      deltaQuarantined: 0,
      reason: input.reason ?? `Receipt for PO ${po.poNumber}`,
      referenceType: 'PURCHASE_ORDER',
      referenceId: po.id,
      purchaseOrderItemId: poItem.id,
    });

    const createdMovement = await tx.inventoryMovement.findUnique({
      where: { operationKey: itemOpKey },
    });

    const updatedPoItem = await tx.purchaseOrderItem.update({
      where: { id: poItem.id },
      data: {
        receivedQuantity: { increment: itemInput.quantity },
      },
    });

    receivedItemsResult.push({
      purchaseOrderItemId: poItem.id,
      productId: poItem.productId,
      variantId: poItem.variantId,
      quantityReceived: itemInput.quantity,
      cumulativeReceivedQuantity: updatedPoItem.receivedQuantity,
      orderedQuantity: poItem.orderedQuantity,
      remainingQuantity: poItem.orderedQuantity - updatedPoItem.receivedQuantity,
      movementId: createdMovement?.id ?? itemOpKey,
    });
  }

  // Check new status of the PO
  const allPoItems = await tx.purchaseOrderItem.findMany({
    where: { purchaseOrderId: po.id },
  });

  const isFullyReceived = allPoItems.every(
    (item: any) => item.receivedQuantity >= item.orderedQuantity
  );
  const nextStatus: PurchaseOrderStatus = isFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

  if (po.status !== nextStatus) {
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: nextStatus },
    });
  }

  return {
    operationKey: input.operationKey,
    purchaseOrderId: po.id,
    status: nextStatus,
    isFullyReceived,
    receivedItems: receivedItemsResult,
  };
}
