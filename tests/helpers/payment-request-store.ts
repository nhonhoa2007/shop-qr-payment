import type {
  PaymentRequestRecord,
  PaymentRequestStore,
} from '../../src/server/modules/payment/payment-request.service.ts';

export function createPaymentRequestTestStore(): PaymentRequestStore & {
  rows: PaymentRequestRecord[];
} {
  const rows: PaymentRequestRecord[] = [];
  return {
    rows,
    paymentRequest: {
      findUnique: async ({ where }: Record<string, unknown>) => {
        const selector = where as { code?: string; idempotencyKey?: string };
        return rows.find((row) =>
          selector.code ? row.code === selector.code : row.idempotencyKey === selector.idempotencyKey
        ) ?? null;
      },
      create: async ({ data }: Record<string, unknown>) => {
        const input = data as Omit<PaymentRequestRecord, 'id' | 'completedAt' | 'createdAt' | 'updatedAt'>;
        const now = new Date('2026-10-27T15:00:00.000Z');
        const row: PaymentRequestRecord = {
          ...input,
          id: `request_${rows.length + 1}`,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        rows.push(row);
        return row;
      },
      updateMany: async () => ({ count: 0 }),
    },
  };
}

export function withTestBankEnv<T>(run: () => Promise<T>): Promise<T> {
  const previous = {
    BANK_ID: process.env.BANK_ID,
    BANK_ACCOUNT: process.env.BANK_ACCOUNT,
    BANK_NAME: process.env.BANK_NAME,
    BANK_DISPLAY_NAME: process.env.BANK_DISPLAY_NAME,
    SEPAY_QR_MEMO_PREFIX: process.env.SEPAY_QR_MEMO_PREFIX,
  };
  process.env.BANK_ID = 'MBBank';
  process.env.BANK_ACCOUNT = '0123456789';
  process.env.BANK_NAME = 'SHOP QR PAYMENT';
  process.env.BANK_DISPLAY_NAME = 'MB Bank';
  process.env.SEPAY_QR_MEMO_PREFIX = '';
  return run().finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}
