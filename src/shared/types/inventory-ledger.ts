export type MovementKind =
  | 'OPENING_LEGACY'
  | 'RESERVE'
  | 'RELEASE'
  | 'SHIP'
  | 'RECEIVE'
  | 'QUARANTINE'
  | 'RESTOCK'
  | 'ADJUST';

export interface StockTarget {
  productId: string;
  variantId?: string | null;
}

export interface InventoryProjectionDto {
  target: StockTarget;
  onHandStock: number;
  reservedStock: number;
  quarantinedStock: number;
  availableStock: number;
  stockVersion: number;
}

export interface ApplyMovementInput {
  operationKey: string;
  target: StockTarget;
  kind: MovementKind;
  deltaOnHand: number;
  deltaReserved: number;
  deltaQuarantined: number;
  reason: string;
  actorId?: string;
  referenceType: string;
  referenceId: string;
  payloadFingerprint?: string;
  purchaseOrderItemId?: string;
}

export interface InventoryMovementRecord {
  id: string;
  operationKey: string;
  payloadFingerprint?: string | null;
  productId: string;
  variantId?: string | null;
  kind: MovementKind;
  deltaOnHand: number;
  deltaReserved: number;
  deltaQuarantined: number;
  beforeOnHand: number;
  afterOnHand: number;
  beforeReserved: number;
  afterReserved: number;
  beforeQuarantined: number;
  afterQuarantined: number;
  beforeAvailable: number;
  afterAvailable: number;
  beforeVersion: number;
  afterVersion: number;
  reason: string;
  actorId?: string | null;
  referenceType: string;
  referenceId: string;
  purchaseOrderItemId?: string | null;
  createdAt: Date;
}

export interface LedgerReconciliationReport {
  target: StockTarget;
  isReconciled: boolean;
  sumOnHand: number;
  sumReserved: number;
  sumQuarantined: number;
  projectionOnHand: number;
  projectionReserved: number;
  projectionQuarantined: number;
  movementCount: number;
}
