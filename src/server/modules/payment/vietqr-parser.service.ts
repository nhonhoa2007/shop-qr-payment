export interface BankTransactionPayload {
  id?: string | number | null;
  amount?: number | string | null;
  description?: string | null;
  bankSubAccId?: string | null;
  when?: string | null;
}

export function parseOrderCodeFromDescription(description: string | null | undefined): string | null {
  if (!description) return null;

  const match = description.toUpperCase().match(/DH\s*([0-9]{6,}[A-Z0-9]*)/i);
  return match ? `DH${match[1]}` : null;
}

export function getTransactionAmount(transaction: BankTransactionPayload): number | null {
  const amount = Number(transaction.amount);
  return Number.isFinite(amount) ? Math.abs(Math.round(amount)) : null;
}

export function getTransactionId(transaction: BankTransactionPayload): string | null {
  if (transaction.id === null || transaction.id === undefined) return null;
  const id = String(transaction.id).trim();
  return id.length > 0 ? id : null;
}

export type WebhookProcessDecision =
  | {
      action: 'SKIP';
      reason:
        | 'DUPLICATE_TRANSACTION'
        | 'NO_ORDER_CODE'
        | 'INVALID_AMOUNT'
        | 'ORDER_NOT_FOUND'
        | 'ALREADY_PAID'
        | 'ORDER_EXPIRED'
        | 'ORDER_CANCELLED'
        | 'UNDERPAID';
    }
  | {
      action: 'PROCESS';
      orderCode: string;
      amount: number;
      transactionId: string | null;
    };

export function evaluateWebhookDecision(
  txn: BankTransactionPayload,
  context: {
    isDuplicateTransaction: boolean;
    order: {
      orderCode: string;
      totalAmount: number;
      paymentStatus: string;
      status: string;
    } | null;
  }
): WebhookProcessDecision {
  const transactionId = getTransactionId(txn);
  if (transactionId && context.isDuplicateTransaction) {
    return { action: 'SKIP', reason: 'DUPLICATE_TRANSACTION' };
  }

  const matchedCode = parseOrderCodeFromDescription(txn.description);
  if (!matchedCode) {
    return { action: 'SKIP', reason: 'NO_ORDER_CODE' };
  }

  const amount = getTransactionAmount(txn);
  if (!amount || amount <= 0) {
    return { action: 'SKIP', reason: 'INVALID_AMOUNT' };
  }

  if (!context.order) {
    return { action: 'SKIP', reason: 'ORDER_NOT_FOUND' };
  }

  if (context.order.paymentStatus === 'PAID') {
    return { action: 'SKIP', reason: 'ALREADY_PAID' };
  }

  if (context.order.paymentStatus === 'EXPIRED') {
    return { action: 'SKIP', reason: 'ORDER_EXPIRED' };
  }

  if (context.order.status === 'CANCELLED') {
    return { action: 'SKIP', reason: 'ORDER_CANCELLED' };
  }

  if (amount < context.order.totalAmount) {
    return { action: 'SKIP', reason: 'UNDERPAID' };
  }

  return {
    action: 'PROCESS',
    orderCode: matchedCode,
    amount,
    transactionId,
  };
}
