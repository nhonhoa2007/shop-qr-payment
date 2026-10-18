import type {
  WarrantyClaimStatus,
  WarrantyResolutionOutcome,
  WarrantyTimelineEntry,
  WarrantyEvidenceRef,
  WarrantyResolution,
} from '@shared/types/warranty';

export const WARRANTY_TRANSITIONS: Record<WarrantyClaimStatus, WarrantyClaimStatus[]> = {
  SUBMITTED: ['RECEIVED', 'REJECTED', 'CANCELLED'],
  RECEIVED: ['INSPECTING', 'REJECTED', 'CANCELLED'],
  INSPECTING: ['WAITING_PARTS', 'RESOLVED', 'REJECTED'],
  WAITING_PARTS: ['INSPECTING', 'RESOLVED', 'REJECTED'],
  RESOLVED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function canTransitionWarranty(
  currentStatus: WarrantyClaimStatus,
  targetStatus: WarrantyClaimStatus
): boolean {
  const allowed = WARRANTY_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
}

export function assertValidWarrantyTransition(
  currentStatus: WarrantyClaimStatus,
  targetStatus: WarrantyClaimStatus
): void {
  if (!canTransitionWarranty(currentStatus, targetStatus)) {
    throw new Error(
      `Invalid warranty state transition: cannot transition from ${currentStatus} to ${targetStatus}`
    );
  }
}

export function validateTimelineEntry(
  entry: unknown
): { valid: boolean; error?: string } {
  if (!entry || typeof entry !== 'object') {
    return { valid: false, error: 'Timeline entry must be an object' };
  }

  const e = entry as Record<string, unknown>;
  const validStatuses = Object.keys(WARRANTY_TRANSITIONS);

  if (typeof e.status !== 'string' || !validStatuses.includes(e.status)) {
    return { valid: false, error: `Invalid timeline entry status: ${e.status}` };
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

export function validateEvidenceRefs(
  refs: unknown
): { valid: boolean; error?: string } {
  if (!Array.isArray(refs)) {
    return { valid: false, error: 'evidenceRefs must be an array' };
  }

  const validTypes = ['IMAGE', 'VIDEO', 'DOCUMENT'];

  for (let i = 0; i < refs.length; i++) {
    const item = refs[i];
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `evidence[${i}] must be an object` };
    }

    if (typeof item.type !== 'string' || !validTypes.includes(item.type)) {
      return { valid: false, error: `evidence[${i}] type must be one of: ${validTypes.join(', ')}` };
    }

    if (typeof item.url !== 'string' || !item.url.startsWith('http')) {
      return { valid: false, error: `evidence[${i}] url must be a valid http/https URL` };
    }

    if (item.uploadedAt !== undefined && isNaN(Date.parse(item.uploadedAt))) {
      return { valid: false, error: `evidence[${i}] uploadedAt must be a valid date string` };
    }
  }

  return { valid: true };
}

export function validateWarrantyResolution(
  resolution: unknown
): { valid: boolean; error?: string } {
  if (!resolution || typeof resolution !== 'object') {
    return { valid: false, error: 'Resolution must be an object' };
  }

  const r = resolution as Record<string, unknown>;
  const validOutcomes: WarrantyResolutionOutcome[] = [
    'REPAIRED',
    'REPLACED',
    'REFUND_RECOMMENDED',
    'REJECTED',
  ];

  if (typeof r.outcome !== 'string' || !validOutcomes.includes(r.outcome as WarrantyResolutionOutcome)) {
    return { valid: false, error: `Invalid resolution outcome: ${r.outcome}` };
  }

  return { valid: true };
}
