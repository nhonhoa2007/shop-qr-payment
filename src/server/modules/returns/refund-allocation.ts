export interface AllocationItem {
  orderItemId: string;
  grossAmount: bigint;
  quantity: number;
}

export interface ItemAllocation {
  orderItemId: string;
  quantity: number;
  allocatedDiscount: bigint;
  netPaidAmount: bigint;
  unitNetPaidAmount: bigint;
}

export interface AllocationResult {
  totalDiscount: bigint;
  allocations: ItemAllocation[];
}

export interface RefundQuoteInput {
  orderId: string;
  items: { orderItemId: string; quantity: number }[];
  includeShipping?: boolean;
  actorRole?: string;
  storeFaultReason?: string;
}

export interface RefundQuote {
  orderId: string;
  itemsRefundAmount: bigint;
  shippingRefund: bigint;
  totalRefundAmount: bigint;
  itemsAllocation: {
    orderItemId: string;
    quantity: number;
    allocatedNetRefund: bigint;
  }[];
}

export interface ExecuteRefundInput {
  sourceKey: string;
  orderId: string;
  returnRequestId?: string;
  warrantyClaimId?: string;
  items: { orderItemId: string; quantity: number }[];
  includeShipping?: boolean;
  storeFaultReason?: string;
  actorId: string;
  actorRole: string;
  reason: string;
}

export interface RefundCaseDto {
  id: string;
  sourceKey: string;
  orderId: string | null;
  amount: bigint;
  reason: string;
  status: 'OPEN' | 'COMPLETED';
  resolvedById: string | null;
  resolutionNote: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

/**
 * Phân bổ chiết khấu cấp đơn hàng theo phương pháp Largest Remainder (Hamilton-Hare)
 * Đảm bảo bảo toàn tuyệt đối từng đồng, không làm phát sinh hay thất thoát giá trị.
 */
export function allocateOrderDiscount(
  items: AllocationItem[],
  discount: bigint
): AllocationResult {
  if (items.length === 0) {
    return { totalDiscount: BigInt(0), allocations: [] };
  }

  const totalGross = items.reduce((sum, item) => sum + item.grossAmount, BigInt(0));

  if (totalGross === BigInt(0) || discount <= BigInt(0)) {
    const allocations = items.map((item) => ({
      orderItemId: item.orderItemId,
      quantity: item.quantity,
      allocatedDiscount: BigInt(0),
      netPaidAmount: item.grossAmount,
      unitNetPaidAmount: item.quantity > 0 ? item.grossAmount / BigInt(item.quantity) : item.grossAmount,
    }));
    return { totalDiscount: BigInt(0), allocations };
  }

  const effectiveDiscount = discount > totalGross ? totalGross : discount;

  // 1. Calculate floor and remainder for each item
  const mapped = items.map((item, index) => {
    const exactFloor = (item.grossAmount * effectiveDiscount) / totalGross;
    const remainder = (item.grossAmount * effectiveDiscount) % totalGross;
    return {
      index,
      orderItemId: item.orderItemId,
      grossAmount: item.grossAmount,
      quantity: item.quantity,
      floor: exactFloor,
      remainder,
    };
  });

  const sumFloor = mapped.reduce((sum, i) => sum + i.floor, BigInt(0));
  const remainderToDistribute = Number(effectiveDiscount - sumFloor);

  // 2. Sort by remainder descending for largest remainder distribution
  // Stable tie-breaking using orderItemId / original index
  const sorted = [...mapped].sort((a, b) => {
    if (b.remainder !== a.remainder) {
      return b.remainder > a.remainder ? 1 : -1;
    }
    return a.orderItemId.localeCompare(b.orderItemId);
  });

  const bonusSet = new Set<string>();
  for (let i = 0; i < remainderToDistribute && i < sorted.length; i++) {
    bonusSet.add(sorted[i].orderItemId);
  }

  // 3. Assemble allocations preserving original order
  const allocations: ItemAllocation[] = mapped.map((m) => {
    let allocated = m.floor + (bonusSet.has(m.orderItemId) ? BigInt(1) : BigInt(0));
    if (allocated > m.grossAmount) {
      allocated = m.grossAmount;
    }
    const netPaidAmount = m.grossAmount - allocated;
    const unitNetPaidAmount = m.quantity > 0 ? netPaidAmount / BigInt(m.quantity) : netPaidAmount;

    return {
      orderItemId: m.orderItemId,
      quantity: m.quantity,
      allocatedDiscount: allocated,
      netPaidAmount,
      unitNetPaidAmount,
    };
  });

  const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedDiscount, BigInt(0));

  return {
    totalDiscount: totalAllocated,
    allocations,
  };
}
