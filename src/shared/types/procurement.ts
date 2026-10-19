export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'ORDERED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

export interface SupplierDto {
  id: string;
  code: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  isActive: boolean;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseOrderItemDto {
  id: string;
  purchaseOrderId: string;
  productId: string;
  variantId?: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  unitCost: string;
  totalCost: string;
}

export interface PurchaseOrderDto {
  id: string;
  poNumber: string;
  supplierId: string;
  supplier?: SupplierDto | null;
  status: PurchaseOrderStatus;
  totalAmount: string;
  currency: string;
  orderedAt?: Date | null;
  expectedDeliveryAt?: Date | null;
  notes?: string | null;
  createdById?: string | null;
  items: PurchaseOrderItemDto[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePoItemInput {
  productId: string;
  variantId?: string | null;
  orderedQuantity: number;
  unitCost: bigint | number | string;
}

export interface CreatePoInput {
  supplierId: string;
  poNumber?: string;
  expectedDeliveryAt?: Date | string | null;
  notes?: string | null;
  createdById?: string;
  items: CreatePoItemInput[];
}

export interface PoTransitionInput {
  purchaseOrderId: string;
  nextStatus: PurchaseOrderStatus;
  actorId?: string;
  reason?: string;
}

export interface ReceiveItemInput {
  purchaseOrderItemId: string;
  quantity: number;
  unitCost?: bigint | number | string;
  batchNumber?: string;
}

export interface ReceivePoInput {
  operationKey: string;
  purchaseOrderId: string;
  actorId?: string;
  reason?: string;
  items: ReceiveItemInput[];
}

export interface ReceiptItemResultDto {
  purchaseOrderItemId: string;
  productId: string;
  variantId?: string | null;
  quantityReceived: number;
  cumulativeReceivedQuantity: number;
  orderedQuantity: number;
  remainingQuantity: number;
  movementId: string;
}

export interface ReceiptResultDto {
  operationKey: string;
  purchaseOrderId: string;
  status: PurchaseOrderStatus;
  isFullyReceived: boolean;
  receivedItems: ReceiptItemResultDto[];
}
