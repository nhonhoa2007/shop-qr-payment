import {
  allocateOrderDiscount,
  type AllocationItem,
  type RefundQuoteInput,
  type RefundQuote,
  type ExecuteRefundInput,
  type RefundCaseDto,
} from '@server/modules/returns/refund-allocation';
import { appendAdminAudit } from '@server/modules/admin/audit-log.service';

function mapRefundCaseToDto(rc: any): RefundCaseDto {
  return {
    id: rc.id,
    sourceKey: rc.sourceKey,
    orderId: rc.orderId ?? null,
    amount: BigInt(rc.amount),
    reason: rc.reason,
    status: rc.status,
    resolvedById: rc.resolvedById ?? null,
    resolutionNote: rc.resolutionNote ?? null,
    resolvedAt: rc.resolvedAt ?? null,
    createdAt: rc.createdAt,
  };
}

export async function quotePartialRefund(
  tx: any,
  input: RefundQuoteInput
): Promise<RefundQuote> {
  const order = await tx.order.findUnique({
    where: { id: input.orderId },
  });

  if (!order) {
    throw new Error(`Order ${input.orderId} not found`);
  }

  const orderItems = await tx.orderItem.findMany({
    where: { orderId: input.orderId },
  });

  if (!orderItems || orderItems.length === 0) {
    throw new Error(`No items found for order ${input.orderId}`);
  }

  // 1. Allocate order discount across all items
  // In production, OrderItem.price and unitPrice represent the unit price.
  // Compute line gross = unitPrice * quantity, with fallback if price is already line-total.
  const totalAsLineTotal = orderItems.reduce((sum: bigint, oi: any) => sum + BigInt(oi.price), BigInt(0));
  const isAlreadyLineTotal = order.subtotal && totalAsLineTotal === BigInt(order.subtotal);

  const allocationItems: AllocationItem[] = orderItems.map((oi: any) => ({
    orderItemId: oi.id,
    grossAmount: isAlreadyLineTotal
      ? BigInt(oi.price)
      : BigInt(oi.unitPrice ?? oi.price) * BigInt(oi.quantity),
    quantity: oi.quantity,
  }));

  const allocationResult = allocateOrderDiscount(
    allocationItems,
    order.discountAmount ? BigInt(order.discountAmount) : BigInt(0)
  );

  const allocationMap = new Map(
    allocationResult.allocations.map((a) => [a.orderItemId, a])
  );

  // 2. Shipping fee refund handling
  let shippingRefund = BigInt(0);
  if (input.includeShipping) {
    if (input.actorRole !== 'ADMIN') {
      throw new Error('Only ADMIN can approve shipping fee refund');
    }
    if (!input.storeFaultReason || !input.storeFaultReason.trim()) {
      throw new Error('Store fault reason is required to refund shipping fee');
    }

    const orderShipping = order.shippingFee ? BigInt(order.shippingFee) : BigInt(0);
    if (orderShipping > BigInt(0)) {
      shippingRefund = orderShipping;
    }
  }

  // 3. Aggregate requested quantities per orderItemId to prevent duplicate item multiplication
  const aggregatedRequests = new Map<string, number>();
  for (const item of input.items) {
    const curr = aggregatedRequests.get(item.orderItemId) ?? 0;
    aggregatedRequests.set(item.orderItemId, curr + item.quantity);
  }

  for (const [orderItemId, totalRequested] of aggregatedRequests.entries()) {
    const alloc = allocationMap.get(orderItemId);
    if (!alloc) {
      throw new Error(`OrderItem ${orderItemId} not part of order ${input.orderId}`);
    }
    if (totalRequested <= 0 || totalRequested > alloc.quantity) {
      throw new Error(
        `Invalid total return quantity (${totalRequested}) for order item ${orderItemId} (purchased ${alloc.quantity})`
      );
    }
  }

  // 4. Calculate refund for requested items
  let itemsRefundAmount = BigInt(0);
  const itemsAllocation: {
    orderItemId: string;
    quantity: number;
    allocatedNetRefund: bigint;
  }[] = [];

  for (const item of input.items) {
    const alloc = allocationMap.get(item.orderItemId)!;

    // Exact proportional net refund
    const allocatedNetRefund =
      (alloc.netPaidAmount * BigInt(item.quantity)) / BigInt(alloc.quantity);

    itemsRefundAmount += allocatedNetRefund;
    itemsAllocation.push({
      orderItemId: item.orderItemId,
      quantity: item.quantity,
      allocatedNetRefund,
    });
  }

  const totalRefundAmount = itemsRefundAmount + shippingRefund;

  return {
    orderId: input.orderId,
    itemsRefundAmount,
    shippingRefund,
    totalRefundAmount,
    itemsAllocation,
  };
}

export async function executeRefundCase(
  tx: any,
  input: ExecuteRefundInput
): Promise<RefundCaseDto> {
  // 1. Calculate quote
  const quote = await quotePartialRefund(tx, {
    orderId: input.orderId,
    items: input.items,
    includeShipping: input.includeShipping,
    actorRole: input.actorRole,
    storeFaultReason: input.storeFaultReason,
  });

  // 2. Replay idempotency check
  const existing = await tx.refundCase.findUnique({
    where: { sourceKey: input.sourceKey },
  });

  if (existing) {
    if (
      existing.orderId === input.orderId &&
      BigInt(existing.amount) === quote.totalRefundAmount
    ) {
      return mapRefundCaseToDto(existing);
    }
    throw new Error(
      `Operation key conflict: sourceKey '${input.sourceKey}' already exists with different payload`
    );
  }

  const order = await tx.order.findUnique({
    where: { id: input.orderId },
  });

  // 3. Enforce cumulative entitlement cap
  const existingCompleted = await tx.refundCase.findMany({
    where: { orderId: input.orderId, status: 'COMPLETED' },
  });

  const alreadyRefunded = existingCompleted.reduce(
    (sum: bigint, r: any) => sum + BigInt(r.amount),
    BigInt(0)
  );

  const orderTotalAmount = BigInt(order.totalAmount);
  if (alreadyRefunded + quote.totalRefundAmount > orderTotalAmount) {
    throw new Error(
      `Refund amount (${quote.totalRefundAmount}) exceeds cumulative paid amount / entitlement for this order (total ${orderTotalAmount}, already refunded ${alreadyRefunded})`
    );
  }

  // 4. Credit internal customer wallet
  if (order.userId && quote.totalRefundAmount > BigInt(0)) {
    let wallet = await tx.userWallet.findUnique({
      where: { userId: order.userId },
    });

    if (!wallet) {
      wallet = await tx.userWallet.create({
        data: {
          userId: order.userId,
          balance: BigInt(0),
        },
      });
    }

    await tx.userWallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: quote.totalRefundAmount },
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: quote.totalRefundAmount,
        type: 'REFUND',
        orderId: order.id,
        description: input.reason || `Hoàn tiền một phần cho đơn hàng ${order.orderCode}`,
      },
    });
  }

  // 5. Create completed RefundCase record
  const refundCase = await tx.refundCase.create({
    data: {
      sourceKey: input.sourceKey,
      orderId: input.orderId,
      amount: quote.totalRefundAmount,
      reason: input.reason,
      status: 'COMPLETED',
      resolvedById: input.actorId,
      resolvedAt: new Date(),
      resolutionNote: input.storeFaultReason ?? input.reason,
      entitlementSnapshot: {
        itemsRefundAmount: quote.itemsRefundAmount.toString(),
        shippingRefund: quote.shippingRefund.toString(),
        totalRefundAmount: quote.totalRefundAmount.toString(),
        orderTotalAmount: orderTotalAmount.toString(),
      },
      allocationSnapshot: quote.itemsAllocation.map((ia) => ({
        orderItemId: ia.orderItemId,
        quantity: ia.quantity,
        allocatedNetRefund: ia.allocatedNetRefund.toString(),
      })),
    },
  });

  // 6. Link ReturnRequest and WarrantyClaim if applicable
  if (input.returnRequestId && 'returnRequest' in tx && typeof (tx as any).returnRequest?.update === 'function') {
    await tx.returnRequest.update({
      where: { id: input.returnRequestId },
      data: { refundCaseId: refundCase.id },
    });
  }

  if (input.warrantyClaimId && 'warrantyClaim' in tx && typeof (tx as any).warrantyClaim?.update === 'function') {
    await tx.warrantyClaim.update({
      where: { id: input.warrantyClaimId },
      data: { refundCaseId: refundCase.id },
    });
  }

  // 7. Update order paymentStatus to REFUNDED if fully refunded
  if (alreadyRefunded + quote.totalRefundAmount >= orderTotalAmount) {
    await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'REFUNDED' },
    });
  }

  // 8. Create notification for customer
  if (order.userId && 'notification' in tx && typeof (tx as any).notification?.create === 'function') {
    await tx.notification.create({
      data: {
        userId: order.userId,
        type: 'REFUND_COMPLETED',
        title: `Hoàn tiền đơn hàng #${order.orderCode}`,
        message: `Đã hoàn ${quote.totalRefundAmount.toString()} đ vào ví tài khoản của bạn`,
        data: { orderId: order.id, amount: quote.totalRefundAmount.toString(), refundCaseId: refundCase.id },
      },
    });
  }

  // 9. Admin audit log
  await appendAdminAudit(tx, {
    operationKey: input.sourceKey,
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: 'EXECUTE_REFUND',
    entityType: 'RefundCase',
    entityId: refundCase.id,
    reason: input.reason,
    metadata: {
      itemsRefundAmount: quote.itemsRefundAmount.toString(),
      shippingRefund: quote.shippingRefund.toString(),
      totalRefundAmount: quote.totalRefundAmount.toString(),
    },
  });

  return mapRefundCaseToDto(refundCase);
}
