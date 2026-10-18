import {
  assertValidReturnTransition,
  validateReturnItemsPayload,
  validateReturnDisposition,
} from '@server/modules/returns/return.fsm';
import { applyInventoryMovement } from '@server/modules/inventory/inventory-ledger.service';
import { appendAdminAudit } from '@server/modules/admin/audit-log.service';
import type {
  RequestReturnInput,
  ReturnTransitionInput,
  ReturnDispositionInput,
  ReturnRequestDto,
  ReturnTimelineEntry,
  ReturnItemPayload,
} from '@shared/types/return';

function mapReturnToDto(ret: any): ReturnRequestDto {
  return {
    id: ret.id,
    returnNumber: ret.returnNumber,
    customerId: ret.customerId,
    orderId: ret.orderId,
    status: ret.status,
    reason: ret.reason,
    items: (ret.items as ReturnItemPayload[]) ?? [],
    timeline: (ret.timeline as ReturnTimelineEntry[]) ?? [],
    evidenceRefs: (ret.evidenceRefs as any[]) ?? [],
    disposition: ret.disposition ?? null,
    dispositionNotes: ret.dispositionNotes ?? null,
    refundCaseId: ret.refundCaseId ?? null,
    version: ret.version,
    lastOperationKey: ret.lastOperationKey ?? null,
    resolvedAt: ret.resolvedAt ?? null,
    createdAt: ret.createdAt,
    updatedAt: ret.updatedAt,
  };
}

export function generateReturnNumber(): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TH${timestamp}${random}`;
}

export async function requestReturn(
  tx: any,
  input: RequestReturnInput,
  customerId: string
): Promise<ReturnRequestDto> {
  const itemsVal = validateReturnItemsPayload(input.items);
  if (!itemsVal.valid) {
    throw new Error(itemsVal.error);
  }

  // 1. Verify order
  const order = await tx.order.findUnique({
    where: { id: input.orderId },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  if (order.userId !== customerId) {
    throw new Error('Order ownership verification failed: Customer does not own this order');
  }

  if (order.status !== 'COMPLETED' || !order.completedAt) {
    throw new Error('Return request requires a COMPLETED order with non-null completion date');
  }

  // Fetch active returns for this order to calculate in-flight requested quantities
  const activeStatuses = ['REQUESTED', 'APPROVED', 'ITEM_RECEIVED', 'INSPECTED'];
  const existingReturns = await tx.returnRequest.findMany({
    where: {
      orderId: input.orderId,
      status: { in: activeStatuses },
    },
  });

  // 2. Validate each item's quantity and serials
  for (const item of input.items) {
    const orderItem = await tx.orderItem.findUnique({
      where: { id: item.orderItemId },
    });

    if (!orderItem || orderItem.orderId !== order.id) {
      throw new Error(`Order item ${item.orderItemId} does not belong to this order`);
    }

    // Sum in-flight quantities for this orderItem across other active returns
    let inFlightQuantity = 0;
    for (const er of existingReturns) {
      for (const ei of (er.items as ReturnItemPayload[])) {
        if (ei.orderItemId === item.orderItemId) {
          inFlightQuantity += ei.quantity;
        }
      }
    }

    const availableReturnable = orderItem.quantity - orderItem.returnedQuantity - inFlightQuantity;

    if (item.quantity > availableReturnable) {
      throw new Error(
        `Requested return quantity (${item.quantity}) exceeds purchased quantity / remaining returnable (${availableReturnable}) for item ${orderItem.productName || orderItem.id}`
      );
    }

    // Validate serialized units if provided
    if (item.serializedUnitIds && item.serializedUnitIds.length > 0) {
      for (const unitId of item.serializedUnitIds) {
        const unit = await tx.serializedUnit.findUnique({
          where: { id: unitId },
        });

        if (!unit || unit.orderItemId !== item.orderItemId) {
          throw new Error(`Serialized unit ${unitId} does not belong to order item ${item.orderItemId}`);
        }

        // Check if unit is already in an active return request
        const isUnitActive = existingReturns.some((er: any) =>
          (er.items as ReturnItemPayload[]).some((ei) =>
            ei.serializedUnitIds?.includes(unitId)
          )
        );

        if (isUnitActive) {
          throw new Error(`Serialized unit ${unitId} is already in an active return request`);
        }
      }
    }
  }

  const returnNumber = generateReturnNumber();
  const initialTimeline: ReturnTimelineEntry[] = [
    {
      status: 'REQUESTED',
      actorId: customerId,
      actorRole: 'CUSTOMER',
      timestamp: new Date().toISOString(),
      note: input.reason,
    },
  ];

  const ret = await tx.returnRequest.create({
    data: {
      returnNumber,
      customerId,
      orderId: input.orderId,
      status: 'REQUESTED',
      reason: input.reason,
      items: input.items,
      timeline: initialTimeline,
      evidenceRefs: input.evidenceRefs ?? [],
      disposition: null,
      dispositionNotes: null,
      version: 1,
    },
  });

  return mapReturnToDto(ret);
}

export async function transitionReturn(
  tx: any,
  input: ReturnTransitionInput
): Promise<ReturnRequestDto> {
  const ret = await tx.returnRequest.findUnique({
    where: { id: input.requestId },
  });

  if (!ret) {
    throw new Error(`Return request ${input.requestId} not found`);
  }

  // 1. Replay check
  if (ret.lastOperationKey === input.operationKey) {
    if (ret.status === input.targetStatus) {
      return mapReturnToDto(ret);
    }
    throw new Error('Operation key conflict: duplicate key with different transition target status');
  }

  // 2. State transition check
  assertValidReturnTransition(ret.status, input.targetStatus);

  // 3. CAS version check
  if (ret.version !== input.expectedVersion) {
    throw new Error(
      `Stale return request version: expected version ${input.expectedVersion} but current is ${ret.version}`
    );
  }

  // 4. If transition to APPROVED: lock returnedQuantity on OrderItem via CAS
  if (input.targetStatus === 'APPROVED') {
    for (const item of (ret.items as ReturnItemPayload[])) {
      await tx.orderItem.update({
        where: { id: item.orderItemId },
        data: {
          returnedQuantity: { increment: item.quantity },
        },
      });
    }
  }

  // 5. If transition to REJECTED or CANCELLED from APPROVED or later: release returnedQuantity
  if (
    (input.targetStatus === 'REJECTED' || input.targetStatus === 'CANCELLED') &&
    ['APPROVED', 'ITEM_RECEIVED', 'INSPECTED'].includes(ret.status)
  ) {
    for (const item of (ret.items as ReturnItemPayload[])) {
      await tx.orderItem.update({
        where: { id: item.orderItemId },
        data: {
          returnedQuantity: { decrement: item.quantity },
        },
      });
    }
  }

  // 6. If transition to ITEM_RECEIVED: place stock in QUARANTINE
  if (input.targetStatus === 'ITEM_RECEIVED') {
    for (const item of (ret.items as ReturnItemPayload[])) {
      const itemKey = `${input.operationKey}:quarantine:${item.productId}:${item.variantId ?? 'base'}`;
      await applyInventoryMovement(tx, {
        operationKey: itemKey,
        target: { productId: item.productId, variantId: item.variantId },
        kind: 'QUARANTINE',
        deltaOnHand: item.quantity,
        deltaReserved: 0,
        deltaQuarantined: item.quantity,
        reason: `Returned stock received into quarantine from return ${ret.returnNumber}`,
        referenceType: 'RETURN_REQUEST',
        referenceId: ret.id,
      });

      // Update serialized units to QUARANTINED if any
      if (item.serializedUnitIds && item.serializedUnitIds.length > 0) {
        for (const unitId of item.serializedUnitIds) {
          await tx.serializedUnit.update({
            where: { id: unitId },
            data: {
              status: 'QUARANTINED',
              quarantinedAt: new Date(),
              notes: `Received into quarantine from return ${ret.returnNumber}`,
            },
          });
        }
      }
    }
  }

  const newTimelineEntry: ReturnTimelineEntry = {
    status: input.targetStatus,
    actorId: input.actorId,
    actorRole: input.actorRole,
    timestamp: new Date().toISOString(),
    note: input.note,
    reason: input.reason,
  };
  const updatedTimeline = [...((ret.timeline as ReturnTimelineEntry[]) ?? []), newTimelineEntry];

  let updatedRet: any;
  try {
    updatedRet = await tx.returnRequest.update({
      where: {
        id: ret.id,
        version: input.expectedVersion,
      },
      data: {
        status: input.targetStatus,
        version: { increment: 1 },
        lastOperationKey: input.operationKey,
        timeline: updatedTimeline,
        disposition: input.disposition ?? ret.disposition,
        dispositionNotes: input.dispositionNotes ?? ret.dispositionNotes,
        resolvedAt: input.targetStatus === 'RESOLVED' ? new Date() : ret.resolvedAt,
      },
    });
  } catch (err: any) {
    if (err?.code === 'P2025' || err?.message?.includes('Version mismatch')) {
      throw new Error(`Stale return request version: expected version ${input.expectedVersion} conflict`);
    }
    throw err;
  }

  // 7. Audit log
  await appendAdminAudit(tx, {
    operationKey: input.operationKey,
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: 'RETURN_TRANSITION',
    entityType: 'ReturnRequest',
    entityId: ret.id,
    beforeState: { status: ret.status, version: ret.version },
    afterState: { status: input.targetStatus, version: updatedRet.version },
    reason: input.reason ?? input.note ?? null,
  });

  return mapReturnToDto(updatedRet);
}

export async function applyReturnDisposition(
  tx: any,
  input: ReturnDispositionInput
): Promise<void> {
  const ret = await tx.returnRequest.findUnique({
    where: { id: input.requestId },
  });

  if (!ret) {
    throw new Error(`Return request ${input.requestId} not found`);
  }

  const dispVal = validateReturnDisposition(input.disposition);
  if (!dispVal.valid) {
    throw new Error(dispVal.error);
  }

  if (ret.disposition) {
    throw new Error(`Disposition has already been applied (${ret.disposition}) to return request ${ret.returnNumber}`);
  }

  // Disposition RESTOCKABLE moves stock from quarantine to available
  if (input.disposition === 'RESTOCKABLE') {
    for (const item of (ret.items as ReturnItemPayload[])) {
      const itemKey = `${input.operationKey}:restock:${item.productId}:${item.variantId ?? 'base'}`;
      await applyInventoryMovement(tx, {
        operationKey: itemKey,
        target: { productId: item.productId, variantId: item.variantId },
        kind: 'RESTOCK',
        deltaOnHand: 0,
        deltaReserved: 0,
        deltaQuarantined: -item.quantity,
        reason: `Return disposition RESTOCKABLE: returned to available stock from return ${ret.returnNumber}`,
        referenceType: 'RETURN_DISPOSITION',
        referenceId: ret.id,
      });

      if (item.serializedUnitIds && item.serializedUnitIds.length > 0) {
        for (const unitId of item.serializedUnitIds) {
          await tx.serializedUnit.update({
            where: { id: unitId },
            data: {
              status: 'AVAILABLE',
              orderId: null,
              orderItemId: null,
              notes: `Restocked as available from return ${ret.returnNumber}`,
            },
          });
        }
      }
    }
  } else if (input.disposition === 'DISPOSED' || input.disposition === 'RETURN_TO_SUPPLIER') {
    // Written off: remove from quarantine and onHand without touching available
    for (const item of (ret.items as ReturnItemPayload[])) {
      const itemKey = `${input.operationKey}:dispose:${item.productId}:${item.variantId ?? 'base'}`;
      await applyInventoryMovement(tx, {
        operationKey: itemKey,
        target: { productId: item.productId, variantId: item.variantId },
        kind: 'ADJUST',
        deltaOnHand: -item.quantity,
        deltaReserved: 0,
        deltaQuarantined: -item.quantity,
        reason: `Return disposition ${input.disposition}: written off from quarantine`,
        referenceType: 'RETURN_DISPOSITION',
        referenceId: ret.id,
      });

      if (item.serializedUnitIds && item.serializedUnitIds.length > 0) {
        for (const unitId of item.serializedUnitIds) {
          await tx.serializedUnit.update({
            where: { id: unitId },
            data: {
              status: 'DEFECTIVE',
              notes: `Written off under disposition ${input.disposition}`,
            },
          });
        }
      }
    }
  }

  await tx.returnRequest.update({
    where: { id: ret.id },
    data: {
      disposition: input.disposition,
      dispositionNotes: input.notes ?? null,
    },
  });

  await appendAdminAudit(tx, {
    operationKey: input.operationKey,
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: 'RETURN_DISPOSITION',
    entityType: 'ReturnRequest',
    entityId: ret.id,
    beforeState: { disposition: ret.disposition },
    afterState: { disposition: input.disposition },
    reason: input.notes ?? null,
  });
}
