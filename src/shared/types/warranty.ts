export type WarrantyClaimStatus =
  | 'SUBMITTED'
  | 'RECEIVED'
  | 'INSPECTING'
  | 'WAITING_PARTS'
  | 'RESOLVED'
  | 'REJECTED'
  | 'CANCELLED';

export type WarrantyResolutionOutcome =
  | 'REPAIRED'
  | 'REPLACED'
  | 'REFUND_RECOMMENDED'
  | 'REJECTED';

export type WarrantyPolicyType = 'MANUFACTURER' | 'SHOP' | 'EXTENDED' | 'UNKNOWN';

export interface WarrantyPolicyConfig {
  type?: WarrantyPolicyType;
  periodMonths: number;
  coverageTerms?: string;
  exclusions?: string[];
  requiresSerial?: boolean;
}

export interface WarrantySnapshot {
  productKind?: string;
  policy?: WarrantyPolicyConfig;
  termsNote?: string;
}

export interface WarrantyTerms {
  periodMonths: number;
  startDate: Date;
  endDate: Date;
  coverageType: WarrantyPolicyType;
  exclusions: string[];
  requiresManualReview: boolean;
  requiresSerial: boolean;
  isExpiredAt: (evaluationDate?: Date) => boolean;
}

export interface WarrantyTimelineEntry {
  status: WarrantyClaimStatus;
  actorId: string;
  actorRole: string;
  timestamp: string;
  note?: string;
  reason?: string;
}

export interface WarrantyEvidenceRef {
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  url: string;
  description?: string;
  uploadedAt: string;
}

export interface WarrantyResolution {
  outcome: WarrantyResolutionOutcome;
  note?: string;
  replacementUnitId?: string;
  refundCaseId?: string;
  resolvedAt?: string;
}

export interface CreateWarrantyInput {
  orderId: string;
  orderItemId: string;
  serializedUnitId?: string;
  issueDescription: string;
  evidenceRefs: WarrantyEvidenceRef[];
}

export interface WarrantyTransitionInput {
  claimId: string;
  targetStatus: WarrantyClaimStatus;
  expectedVersion: number;
  operationKey: string;
  actorId: string;
  actorRole: string;
  note?: string;
  reason?: string;
  resolution?: WarrantyResolution;
}

export interface WarrantyClaimDto {
  id: string;
  claimNumber: string;
  customerId: string;
  orderId: string;
  orderItemId: string;
  serializedUnitId: string | null;
  status: WarrantyClaimStatus;
  issueDescription: string;
  timeline: WarrantyTimelineEntry[];
  evidenceRefs: WarrantyEvidenceRef[];
  resolution: WarrantyResolution | null;
  resolutionOutcome: WarrantyResolutionOutcome | null;
  replacementUnitId: string | null;
  refundCaseId: string | null;
  version: number;
  lastOperationKey: string | null;
  warrantyTermsSnapshot: Record<string, unknown>;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
