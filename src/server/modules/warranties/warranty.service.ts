import { resolveWarrantyTerms } from '@server/modules/warranties/warranty-policy';
import {
  assertValidWarrantyTransition,
  validateEvidenceRefs,
  validateWarrantyResolution,
} from '@server/modules/warranties/warranty.fsm';
import { applyInventoryMovement } from '@server/modules/inventory/inventory-ledger.service';
import { appendAdminAudit } from '@server/modules/admin/audit-log.service';
import type {
  CreateWarrantyInput,
  WarrantyTransitionInput,
  WarrantyClaimDto,
  WarrantyTimelineEntry,
} from '@shared/types/warranty';

function mapClaimToDto(claim: any): WarrantyClaimDto {
  return {
    id: claim.id,
    claimNumber: claim.claimNumber,
    customerId: claim.customerId,
    orderId: claim.orderId,
    orderItemId: claim.orderItemId,
    serializedUnitId: claim.serializedUnitId ?? null,
    status: claim.status,
    issueDescription: claim.issueDescription,
    timeline: (claim.timeline as WarrantyTimelineEntry[]) ?? [],
    evidenceRefs: (claim.evidenceRefs as any[]) ?? [],
    resolution: claim.resolution ?? null,
    resolutionOutcome: claim.resolutionOutcome ?? null,
    replacementUnitId: claim.replacementUnitId ?? null,
    refundCaseId: claim.refundCaseId ?? null,
    version: claim.version,
    lastOperationKey: claim.lastOperationKey ?? null,
    warrantyTermsSnapshot: (claim.warrantyTermsSnapshot as Record<string, unknown>) ?? {},
    resolvedAt: claim.resolvedAt ?? null,
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
  };
}

export function generateWarrantyClaimNumber(): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BH${timestamp}${random}`;
}

export async function createWarrantyClaim(
  tx: any,
  input: CreateWarrantyInput,
  customerId: string
): Promise<WarrantyClaimDto> {
  const evidenceVal = validateEvidenceRefs(input.evidenceRefs ?? []);
  if (!evidenceVal.valid) {
    throw new Error(evidenceVal.error);
  }

  // 1. Verify order ownership
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
    throw new Error('Warranty claim requires a COMPLETED order with non-null completion date');
  }

  // 2. Verify order item
  const orderItem = await tx.orderItem.findUnique({
    where: { id: input.orderItemId },
  });

  if (!orderItem || orderItem.orderId !== order.id) {
    throw new Error('Order item does not belong to this order');
  }

  // 3. Verify serialized unit if specified
  if (input.serializedUnitId) {
    const unit = await tx.serializedUnit.findUnique({
      where: { id: input.serializedUnitId },
    });

    if (!unit || unit.orderItemId !== input.orderItemId) {
      throw new Error('Serialized unit does not match this order item');
    }
  }

  // 4. Verify warranty terms and period
  const terms = resolveWarrantyTerms(orderItem.warrantySnapshot, order.completedAt);
  if (terms.isExpiredAt(new Date())) {
    throw new Error('Warranty period has expired for this item');
  }

  // 5. Enforce single open claim slot per item / serial unit
  const activeStatuses = ['SUBMITTED', 'RECEIVED', 'INSPECTING', 'WAITING_PARTS'];
  const existingActive = await tx.warrantyClaim.findFirst({
    where: {
      orderItemId: input.orderItemId,
      ...(input.serializedUnitId ? { serializedUnitId: input.serializedUnitId } : {}),
      status: { in: activeStatuses },
    },
  });

  if (existingActive) {
    throw new Error('There is already an active warranty claim for this item');
  }

  const claimNumber = generateWarrantyClaimNumber();
  const initialTimeline: WarrantyTimelineEntry[] = [
    {
      status: 'SUBMITTED',
      actorId: customerId,
      actorRole: 'CUSTOMER',
      timestamp: new Date().toISOString(),
      note: 'Yêu cầu bảo hành được gửi bởi khách hàng',
    },
  ];

  const claim = await tx.warrantyClaim.create({
    data: {
      claimNumber,
      customerId,
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      serializedUnitId: input.serializedUnitId ?? null,
      status: 'SUBMITTED',
      issueDescription: input.issueDescription,
      timeline: initialTimeline,
      evidenceRefs: input.evidenceRefs ?? [],
      warrantyTermsSnapshot: {
        periodMonths: terms.periodMonths,
        startDate: terms.startDate.toISOString(),
        endDate: terms.endDate.toISOString(),
        coverageType: terms.coverageType,
        exclusions: terms.exclusions,
        requiresManualReview: terms.requiresManualReview,
      },
      version: 1,
    },
  });

  return mapClaimToDto(claim);
}

export async function transitionWarranty(
  tx: any,
  input: WarrantyTransitionInput
): Promise<WarrantyClaimDto> {
  const claim = await tx.warrantyClaim.findUnique({
    where: { id: input.claimId },
  });

  if (!claim) {
    throw new Error(`Warranty claim with id ${input.claimId} not found`);
  }

  // 1. Replay check
  if (claim.lastOperationKey === input.operationKey) {
    if (claim.status === input.targetStatus) {
      return mapClaimToDto(claim);
    }
    throw new Error('Operation key conflict: duplicate key with different transition target status');
  }

  // 2. Validate transition
  assertValidWarrantyTransition(claim.status, input.targetStatus);

  // 3. Validate expectedVersion for CAS
  if (claim.version !== input.expectedVersion) {
    throw new Error(
      `Stale warranty claim version: expected version ${input.expectedVersion} but current is ${claim.version}`
    );
  }

  let refundCaseId: string | null = claim.refundCaseId ?? null;
  let replacementUnitId: string | null = claim.replacementUnitId ?? null;

  // 4. Handle resolution details if targetStatus is RESOLVED
  if (input.targetStatus === 'RESOLVED') {
    if (!input.resolution) {
      throw new Error('Resolution data is required when transitioning to RESOLVED');
    }
    const resVal = validateWarrantyResolution(input.resolution);
    if (!resVal.valid) {
      throw new Error(resVal.error);
    }

    if (input.resolution.outcome === 'REPLACED') {
      if (!input.resolution.replacementUnitId) {
        throw new Error('replacementUnitId is required for REPLACED outcome');
      }
      replacementUnitId = input.resolution.replacementUnitId;
      const unit = await tx.serializedUnit.findUnique({
        where: { id: replacementUnitId },
      });
      if (!unit) {
        throw new Error(`Replacement unit ${replacementUnitId} not found`);
      }
      if (unit.status !== 'AVAILABLE') {
        throw new Error(`Replacement unit must be in AVAILABLE status, currently ${unit.status}`);
      }

      // Verify SKU compatibility with order item
      const orderItem = await tx.orderItem.findUnique({
        where: { id: claim.orderItemId },
      });
      if (orderItem) {
        if (unit.productId !== orderItem.productId) {
          throw new Error('Replacement unit must have the same productId as the claimed item');
        }
        if (orderItem.variantId && unit.variantId && unit.variantId !== orderItem.variantId) {
          throw new Error('Replacement unit must have the same variantId as the claimed item');
        }
      }

      // Reassign unit to order / customer
      await tx.serializedUnit.update({
        where: { id: replacementUnitId },
        data: {
          status: 'SOLD',
          orderId: claim.orderId,
          orderItemId: claim.orderItemId,
          notes: `Đổi máy bảo hành từ hồ sơ ${claim.claimNumber}`,
          soldAt: new Date(),
        },
      });

      // Emits inventory movement if ledger is available
      if ('inventoryMovement' in tx && typeof (tx as any).inventoryMovement?.create === 'function') {
        await applyInventoryMovement(tx, {
          operationKey: `${input.operationKey}:replacement:${unit.id}`,
          target: { productId: unit.productId, variantId: unit.variantId },
          kind: 'SHIP',
          deltaOnHand: -1,
          deltaReserved: 0,
          deltaQuarantined: 0,
          reason: `Warranty replacement unit allocated for claim ${claim.claimNumber}`,
          referenceType: 'WARRANTY_CLAIM',
          referenceId: claim.id,
        });
      }
    } else if (input.resolution.outcome === 'REFUND_RECOMMENDED') {
      if (!claim.refundCaseId) {
        const sourceKey = `warranty:refund:${claim.id}`;
        const refundCase = await tx.refundCase.create({
          data: {
            sourceKey,
            orderId: claim.orderId,
            amount: BigInt(0),
            reason: input.resolution.note ?? `Đề xuất hoàn tiền từ hồ sơ bảo hành ${claim.claimNumber}`,
            status: 'OPEN',
          },
        });
        refundCaseId = refundCase.id;
      } else {
        refundCaseId = claim.refundCaseId;
      }
    }
  }

  // 5. Append new timeline entry
  const newTimelineEntry: WarrantyTimelineEntry = {
    status: input.targetStatus,
    actorId: input.actorId,
    actorRole: input.actorRole,
    timestamp: new Date().toISOString(),
    note: input.note,
    reason: input.reason,
  };
  const updatedTimeline = [...((claim.timeline as WarrantyTimelineEntry[]) ?? []), newTimelineEntry];

  // 6. Update claim via CAS
  let updatedClaim: any;
  try {
    updatedClaim = await tx.warrantyClaim.update({
      where: {
        id: claim.id,
        version: input.expectedVersion,
      },
      data: {
        status: input.targetStatus,
        version: { increment: 1 },
        lastOperationKey: input.operationKey,
        timeline: updatedTimeline,
        resolution: input.resolution
          ? {
              ...input.resolution,
              ...(refundCaseId ? { refundCaseId } : {}),
              resolvedAt: new Date().toISOString(),
            }
          : claim.resolution,
        resolutionOutcome: input.resolution?.outcome ?? claim.resolutionOutcome,
        replacementUnitId: replacementUnitId ?? claim.replacementUnitId,
        refundCaseId: refundCaseId ?? claim.refundCaseId,
        resolvedAt: input.targetStatus === 'RESOLVED' ? new Date() : claim.resolvedAt,
      },
    });
  } catch (err: any) {
    if (err?.code === 'P2025' || err?.message?.includes('Version mismatch')) {
      throw new Error(
        `Stale warranty claim version: expected version ${input.expectedVersion} conflict`
      );
    }
    throw err;
  }

  // 7. Audit log
  await appendAdminAudit(tx, {
    operationKey: input.operationKey,
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: 'WARRANTY_TRANSITION',
    entityType: 'WarrantyClaim',
    entityId: claim.id,
    beforeState: { status: claim.status, version: claim.version },
    afterState: { status: input.targetStatus, version: updatedClaim.version },
    reason: input.reason ?? input.note ?? null,
  });

  // 8. Create in-app notification
  if ('notification' in tx && typeof (tx as any).notification?.create === 'function') {
    await (tx as any).notification.create({
      data: {
        userId: claim.customerId,
        type: 'WARRANTY_UPDATED',
        title: `Cập nhật bảo hành #${claim.claimNumber}`,
        message: `Hồ sơ bảo hành của bạn đã chuyển sang trạng thái ${input.targetStatus}`,
        data: { claimId: claim.id, status: input.targetStatus },
      },
    });
  }

  return mapClaimToDto(updatedClaim);
}
