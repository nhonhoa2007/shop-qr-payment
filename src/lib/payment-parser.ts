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
