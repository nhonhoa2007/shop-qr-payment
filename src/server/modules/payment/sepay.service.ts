import crypto from 'node:crypto';

export interface SePayTransactionPayload {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  subAccount: string | null;
  code: string | null;
  content: string;
  transferType: 'in' | 'out';
  description: string;
  transferAmount: number;
  accumulated: number;
  referenceCode: string;
}

interface SePayQrParams {
  bankId: string;
  accountNo: string;
  accountName: string;
  amount: number;
  paymentCode: string;
  memoPrefix?: string;
}

type HeaderReader = Pick<Headers, 'get'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function generateSePayQrUrl(params: SePayQrParams): string {
  const bankId = params.bankId.trim();
  const accountNo = params.accountNo.trim();
  const accountName = params.accountName.trim();
  const paymentCode = params.paymentCode.trim().toUpperCase();
  const memoPrefix = params.memoPrefix?.trim().replace(/\s+/g, ' ');

  if (!bankId || !accountNo || !accountName) {
    throw new Error('Thông tin tài khoản ngân hàng chưa đầy đủ');
  }
  if (!Number.isSafeInteger(params.amount) || params.amount <= 0) {
    throw new Error('Số tiền thanh toán phải là số nguyên dương an toàn');
  }
  if (!/^(?:DH|NAP)[A-Z0-9]{4,}$/.test(paymentCode)) {
    throw new Error('Mã thanh toán SePay không hợp lệ');
  }

  const description = [memoPrefix, paymentCode].filter(Boolean).join(' ');
  const query = new URLSearchParams({
    acc: accountNo,
    bank: bankId,
    amount: String(params.amount),
    des: description,
    template: 'compact',
    showinfo: 'true',
    holder: accountName,
  });

  return `https://vietqr.app/img?${query.toString()}`;
}

export function verifySePayWebhook(
  rawBody: string,
  headers: HeaderReader,
  secret: string,
  nowMs = Date.now()
): boolean {
  if (!secret) return false;

  const timestampHeader = headers.get('x-sepay-timestamp');
  const signatureHeader = headers.get('x-sepay-signature');
  if (!timestampHeader || !signatureHeader) return false;
  if (!/^\d+$/.test(timestampHeader)) return false;

  const timestamp = Number(timestampHeader);
  const nowSeconds = Math.floor(nowMs / 1000);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300) {
    return false;
  }

  const signatureMatch = signatureHeader.match(/^sha256=([a-f0-9]{64})$/i);
  if (!signatureMatch) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestampHeader}.${rawBody}`)
    .digest();
  const received = Buffer.from(signatureMatch[1], 'hex');
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export function parseSePayPayload(value: unknown): SePayTransactionPayload | null {
  if (!isRecord(value)) return null;

  const {
    id,
    gateway,
    transactionDate,
    accountNumber,
    subAccount,
    code,
    content,
    transferType,
    description,
    transferAmount,
    accumulated,
    referenceCode,
  } = value;

  if (!Number.isSafeInteger(id) || Number(id) <= 0) return null;
  if (!isString(gateway) || !gateway.trim()) return null;
  if (!isString(transactionDate) || !transactionDate.trim()) return null;
  if (!isString(accountNumber) || !accountNumber.trim()) return null;
  if (!(subAccount === null || isString(subAccount))) return null;
  if (!(code === null || isString(code))) return null;
  if (!isString(content)) return null;
  if (transferType !== 'in' && transferType !== 'out') return null;
  if (!isString(description)) return null;
  if (!Number.isSafeInteger(transferAmount) || Number(transferAmount) <= 0) return null;
  if (!Number.isSafeInteger(accumulated) || Number(accumulated) < 0) return null;
  if (!isString(referenceCode)) return null;

  return {
    id: Number(id),
    gateway: gateway.trim(),
    transactionDate: transactionDate.trim(),
    accountNumber: accountNumber.trim(),
    subAccount: subAccount === null ? null : subAccount.trim(),
    code: code === null || !code.trim() ? null : code.trim().toUpperCase(),
    content,
    transferType,
    description,
    transferAmount: Number(transferAmount),
    accumulated: Number(accumulated),
    referenceCode: referenceCode.trim(),
  };
}
