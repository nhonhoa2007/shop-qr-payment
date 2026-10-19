export type ReturnRequestStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'ITEM_RECEIVED'
  | 'INSPECTED'
  | 'RESOLVED'
  | 'REJECTED'
  | 'CANCELLED';

export type ReturnDisposition =
  | 'RESTOCKABLE'
  | 'REFURBISH'
  | 'DEFECTIVE'
  | 'RETURN_TO_SUPPLIER'
  | 'DISPOSED';

export interface ReturnItemPayload {
  orderItemId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPriceSnapshot: string;
  unitCostSnapshot?: string | null;
  serializedUnitIds?: string[];
  returnReason: string;
  disposition?: ReturnDisposition;
  dispositionNote?: string;
}

export interface ReturnTimelineEntry {
  status: ReturnRequestStatus;
  actorId: string;
  actorRole: string;
  timestamp: string;
  note?: string;
  reason?: string;
}

export interface ReturnEvidenceRef {
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  url: string;
  description?: string;
  uploadedAt: string;
}

export interface RequestReturnInput {
  orderId: string;
  reason: string;
  items: ReturnItemPayload[];
  evidenceRefs?: ReturnEvidenceRef[];
}

export interface ReturnTransitionInput {
  requestId: string;
  targetStatus: ReturnRequestStatus;
  expectedVersion: number;
  operationKey: string;
  actorId: string;
  actorRole: string;
  note?: string;
  reason?: string;
  disposition?: ReturnDisposition;
  dispositionNotes?: string;
}

export interface ReturnDispositionInput {
  requestId: string;
  disposition: ReturnDisposition;
  operationKey: string;
  actorId: string;
  actorRole: string;
  notes?: string;
}

export interface ReturnRequestDto {
  id: string;
  returnNumber: string;
  customerId: string;
  orderId: string;
  status: ReturnRequestStatus;
  reason: string;
  items: ReturnItemPayload[];
  timeline: ReturnTimelineEntry[];
  evidenceRefs: ReturnEvidenceRef[];
  disposition: ReturnDisposition | null;
  dispositionNotes: string | null;
  refundCaseId: string | null;
  version: number;
  lastOperationKey: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
