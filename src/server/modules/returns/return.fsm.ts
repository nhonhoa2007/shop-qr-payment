import type {
  ReturnRequestStatus,
  ReturnDisposition,
  ReturnTimelineEntry,
  ReturnItemPayload,
} from '@shared/types/return';

export const RETURN_TRANSITIONS: Record<ReturnRequestStatus, ReturnRequestStatus[]> = {
  REQUESTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['ITEM_RECEIVED', 'REJECTED', 'CANCELLED'],
  ITEM_RECEIVED: ['INSPECTED', 'REJECTED'],
  INSPECTED: ['RESOLVED', 'REJECTED'],
  RESOLVED: [],
  REJECTED: [],
  CANCELLED: [],
};

export const VALID_DISPOSITIONS: ReturnDisposition[] = [
  'RESTOCKABLE',
  'REFURBISH',
  'DEFECTIVE',
  'RETURN_TO_SUPPLIER',
  'DISPOSED',
];

export function canTransitionReturn(
  currentStatus: ReturnRequestStatus,
  targetStatus: ReturnRequestStatus
): boolean {
  const allowed = RETURN_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
}

export function assertValidReturnTransition(
  currentStatus: ReturnRequestStatus,
  targetStatus: ReturnRequestStatus
): void {
  if (!canTransitionReturn(currentStatus, targetStatus)) {
    throw new Error(
      `Invalid return state transition: cannot transition from ${currentStatus} to ${targetStatus}`
    );
  }
}

export function validateReturnItemsPayload(
  items: unknown
): { valid: boolean; error?: string } {
  if (!Array.isArray(items) || items.length === 0) {
    return { valid: false, error: 'Return items array cannot be empty' };
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `items[${i}] must be an object` };
    }

    const payload = item as ReturnItemPayload;

    if (!payload.orderItemId || typeof payload.orderItemId !== 'string') {
      return { valid: false, error: `items[${i}] requires valid orderItemId` };
    }

    if (!payload.productId || typeof payload.productId !== 'string') {
      return { valid: false, error: `items[${i}] requires valid productId` };
    }

    if (
      typeof payload.quantity !== 'number' ||
      !Number.isInteger(payload.quantity) ||
      payload.quantity <= 0
    ) {
      return { valid: false, error: `items[${i}] quantity must be a positive integer` };
    }

    if (!payload.returnReason || typeof payload.returnReason !== 'string') {
      return { valid: false, error: `items[${i}] requires a returnReason` };
    }

    if (payload.serializedUnitIds) {
      if (!Array.isArray(payload.serializedUnitIds)) {
        return { valid: false, error: `items[${i}] serializedUnitIds must be an array` };
      }
      if (payload.serializedUnitIds.length !== payload.quantity) {
        return {
          valid: false,
          error: `items[${i}] serialized unit count (${payload.serializedUnitIds.length}) does not match quantity (${payload.quantity})`,
        };
      }
    }
  }

  return { valid: true };
}

export function validateReturnTimelineEntry(
  entry: unknown
): { valid: boolean; error?: string } {
  if (!entry || typeof entry !== 'object') {
    return { valid: false, error: 'Timeline entry must be an object' };
  }

  const e = entry as Record<string, unknown>;
  const validStatuses = Object.keys(RETURN_TRANSITIONS);

  if (typeof e.status !== 'string' || !validStatuses.includes(e.status)) {
    return { valid: false, error: `Invalid return status: ${e.status}` };
  }

  if (typeof e.actorId !== 'string' || !e.actorId.trim()) {
    return { valid: false, error: 'Timeline entry requires actorId' };
  }

  if (typeof e.actorRole !== 'string' || !e.actorRole.trim()) {
    return { valid: false, error: 'Timeline entry requires actorRole' };
  }

  if (typeof e.timestamp !== 'string' || isNaN(Date.parse(e.timestamp))) {
    return { valid: false, error: 'Timeline entry requires valid timestamp' };
  }

  return { valid: true };
}

export function validateReturnDisposition(
  disposition: unknown
): { valid: boolean; error?: string } {
  if (typeof disposition !== 'string' || !VALID_DISPOSITIONS.includes(disposition as ReturnDisposition)) {
    return { valid: false, error: `Invalid disposition: ${disposition}` };
  }
  return { valid: true };
}
