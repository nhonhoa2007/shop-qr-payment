export type SerializedUnitStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'SOLD'
  | 'QUARANTINED'
  | 'DEFECTIVE';

export interface SerialIdentifiersInput {
  serialNumber?: string | null;
  imei1?: string | null;
  imei2?: string | null;
}

export interface NormalizedSerialIdentifiers {
  serialNumber: string | null;
  imei1: string | null;
  imei2: string | null;
}

export interface SerializedUnitDto {
  id: string;
  productId: string;
  variantId?: string | null;
  serialNumber?: string | null;
  imei1?: string | null;
  imei2?: string | null;
  status: SerializedUnitStatus;
  orderId?: string | null;
  orderItemId?: string | null;
  purchaseOrderItemId?: string | null;
  assignedAt?: Date | null;
  soldAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignmentInput {
  orderId: string;
  orderItemId: string;
  productId: string;
  variantId?: string | null;
  unitIds: string[];
}

export interface RegisterUnitsInput {
  productId: string;
  variantId?: string | null;
  purchaseOrderItemId?: string;
  supplierId?: string;
  units: SerialIdentifiersInput[];
}

export interface SerializationReadiness {
  ready: boolean;
  orderId: string;
  missingCount: number;
  overridden?: boolean;
  overrideReason?: string;
  details: Array<{
    orderItemId: string;
    productId: string;
    variantId?: string | null;
    required: boolean;
    orderedQuantity: number;
    assignedCount: number;
  }>;
}
