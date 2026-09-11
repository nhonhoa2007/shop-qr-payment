import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateWebhookDecision,
  type BankTransactionPayload,
} from '../src/lib/payment-parser.ts';

// ─── Helpers ────────────────────────────────────────────────
function makeTxn(overrides: Partial<BankTransactionPayload> = {}): BankTransactionPayload {
  return {
    id: 'TXN001',
    amount: 200000,
    description: 'Chuyen tien DH123456',
    bankSubAccId: 'VCB',
    when: '2026-09-08T10:00:00Z',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<{
  orderCode: string;
  totalAmount: number;
  paymentStatus: string;
  status: string;
}> = {}) {
  return {
    orderCode: 'DH123456',
    totalAmount: 200000,
    paymentStatus: 'UNPAID',
    status: 'PENDING',
    ...overrides,
  };
}

// ─── 1. Replay / Duplicate Transaction (Idempotency) ────────
describe('Webhook Idempotency - Replay Attack Prevention', () => {
  it('should SKIP when bankTransId already exists in DB (replay)', () => {
    const decision = evaluateWebhookDecision(makeTxn(), {
      isDuplicateTransaction: true,
      order: makeOrder(),
    });
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'DUPLICATE_TRANSACTION');
  });

  it('should SKIP duplicate even when order is still UNPAID (idempotent)', () => {
    const decision = evaluateWebhookDecision(
      makeTxn({ id: 'TXN_REPLAY_99' }),
      {
        isDuplicateTransaction: true,
        order: makeOrder({ paymentStatus: 'UNPAID' }),
      }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'DUPLICATE_TRANSACTION');
  });

  it('should PROCESS when same order code but different bankTransId (not a replay)', () => {
    const decision = evaluateWebhookDecision(
      makeTxn({ id: 'TXN_NEW_002' }),
      {
        isDuplicateTransaction: false,
        order: makeOrder(),
      }
    );
    assert.equal(decision.action, 'PROCESS');
  });

  it('should PROCESS when txn has no id (null) — no duplicate check possible', () => {
    const decision = evaluateWebhookDecision(
      makeTxn({ id: null }),
      {
        isDuplicateTransaction: false,
        order: makeOrder(),
      }
    );
    assert.equal(decision.action, 'PROCESS');
    assert.equal(decision.transactionId, null);
  });

  it('should PROCESS when txn id is undefined — no duplicate check', () => {
    const decision = evaluateWebhookDecision(
      makeTxn({ id: undefined }),
      {
        isDuplicateTransaction: false,
        order: makeOrder(),
      }
    );
    assert.equal(decision.action, 'PROCESS');
    assert.equal(decision.transactionId, null);
  });
});

// ─── 2. Order Status Guards ─────────────────────────────────
describe('Webhook Decision - Order Status Guards', () => {
  it('should SKIP when order is already PAID', () => {
    const decision = evaluateWebhookDecision(makeTxn(), {
      isDuplicateTransaction: false,
      order: makeOrder({ paymentStatus: 'PAID' }),
    });
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'ALREADY_PAID');
  });

  it('should SKIP when order payment has EXPIRED', () => {
    const decision = evaluateWebhookDecision(makeTxn(), {
      isDuplicateTransaction: false,
      order: makeOrder({ paymentStatus: 'EXPIRED' }),
    });
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'ORDER_EXPIRED');
  });

  it('should SKIP when order status is CANCELLED', () => {
    const decision = evaluateWebhookDecision(makeTxn(), {
      isDuplicateTransaction: false,
      order: makeOrder({ status: 'CANCELLED', paymentStatus: 'UNPAID' }),
    });
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'ORDER_CANCELLED');
  });

  it('should SKIP when order not found in DB', () => {
    const decision = evaluateWebhookDecision(makeTxn(), {
      isDuplicateTransaction: false,
      order: null,
    });
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'ORDER_NOT_FOUND');
  });
});

// ─── 3. Amount Validation Edge Cases ────────────────────────
describe('Webhook Decision - Amount Validation', () => {
  it('should SKIP when payment amount is less than order total (underpaid)', () => {
    const decision = evaluateWebhookDecision(
      makeTxn({ amount: 199999 }),
      {
        isDuplicateTransaction: false,
        order: makeOrder({ totalAmount: 200000 }),
      }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'UNDERPAID');
  });

  it('should PROCESS when amount exactly equals order total', () => {
    const decision = evaluateWebhookDecision(
      makeTxn({ amount: 200000 }),
      {
        isDuplicateTransaction: false,
        order: makeOrder({ totalAmount: 200000 }),
      }
    );
    assert.equal(decision.action, 'PROCESS');
    assert.equal(decision.amount, 200000);
  });

  it('should PROCESS when overpaid (amount > totalAmount)', () => {
    const decision = evaluateWebhookDecision(
      makeTxn({ amount: 500000 }),
      {
        isDuplicateTransaction: false,
        order: makeOrder({ totalAmount: 200000 }),
      }
    );
    assert.equal(decision.action, 'PROCESS');
    assert.equal(decision.amount, 500000);
  });

  it('should SKIP for zero amount', () => {
    const decision = evaluateWebhookDecision(
      makeTxn({ amount: 0 }),
      {
        isDuplicateTransaction: false,
        order: makeOrder(),
      }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'INVALID_AMOUNT');
  });

  it('should handle negative amount (Math.abs converts to positive)', () => {
    const decision = evaluateWebhookDecision(
      makeTxn({ amount: -200000 }),
      {
        isDuplicateTransaction: false,
        order: makeOrder({ totalAmount: 200000 }),
      }
    );
    // getTransactionAmount uses Math.abs, so -200000 becomes 200000
    assert.equal(decision.action, 'PROCESS');
    assert.equal(decision.amount, 200000);
  });

  it('should SKIP for NaN / non-numeric amount string', () => {
    const decision = evaluateWebhookDecision(
      makeTxn({ amount: 'not-a-number' as unknown as number }),
      {
        isDuplicateTransaction: false,
        order: makeOrder(),
      }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'INVALID_AMOUNT');
  });

  it('should SKIP for null amount', () => {
    const decision = evaluateWebhookDecision(
      makeTxn({ amount: null }),
      {
        isDuplicateTransaction: false,
        order: makeOrder(),
      }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'INVALID_AMOUNT');
  });

  it('should handle string amount correctly ("200000" -> 200000)', () => {
    const decision = evaluateWebhookDecision(
      makeTxn({ amount: '200000' }),
      {
        isDuplicateTransaction: false,
        order: makeOrder({ totalAmount: 200000 }),
      }
    );
    assert.equal(decision.action, 'PROCESS');
    assert.equal(decision.amount, 200000);
  });
});

// ─── 4. Description / Order Code Parsing Edge Cases ─────────
describe('Webhook Decision - Order Code Parsing', () => {
  it('should SKIP when description has no order code pattern', () => {
    const decision = evaluateWebhookDecision(
      makeTxn({ description: 'Chuyen tien mua sam' }),
      {
        isDuplicateTransaction: false,
        order: null,
      }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'NO_ORDER_CODE');
  });

  it('should SKIP when description is empty string', () => {
    const decision = evaluateWebhookDecision(
      makeTxn({ description: '' }),
      {
        isDuplicateTransaction: false,
        order: null,
      }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'NO_ORDER_CODE');
  });

  it('should SKIP when description is null', () => {
    const decision = evaluateWebhookDecision(
      makeTxn({ description: null }),
      {
        isDuplicateTransaction: false,
        order: null,
      }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'NO_ORDER_CODE');
  });

  it('should extract order code case-insensitively (dh / DH / Dh)', () => {
    for (const desc of ['dh123456', 'DH123456', 'Dh123456', 'dH123456']) {
      const decision = evaluateWebhookDecision(
        makeTxn({ description: `ck ${desc} mua hang` }),
        {
          isDuplicateTransaction: false,
          order: makeOrder(),
        }
      );
      assert.equal(decision.action, 'PROCESS', `Failed for description: ${desc}`);
    }
  });

  it('should handle description with special characters safely', () => {
    const decision = evaluateWebhookDecision(
      makeTxn({ description: '💰 CK DH123456 🎉 <script>alert(1)</script>' }),
      {
        isDuplicateTransaction: false,
        order: makeOrder(),
      }
    );
    assert.equal(decision.action, 'PROCESS');
    assert.equal(decision.orderCode, 'DH123456');
  });
});

// ─── 5. Combined / Priority Edge Cases ──────────────────────
describe('Webhook Decision - Priority & Combined Scenarios', () => {
  it('duplicate check takes priority over all other checks', () => {
    // Even though order is valid and amount is correct, duplicate wins
    const decision = evaluateWebhookDecision(
      makeTxn({ id: 'TXN_DUP' }),
      {
        isDuplicateTransaction: true,
        order: makeOrder({ paymentStatus: 'UNPAID', totalAmount: 200000 }),
      }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'DUPLICATE_TRANSACTION');
  });

  it('should PROCESS valid first-time webhook with full valid data', () => {
    const decision = evaluateWebhookDecision(
      makeTxn({
        id: 'TXN_FIRST_TIME',
        amount: 350000,
        description: 'Thanh toan DH999888',
      }),
      {
        isDuplicateTransaction: false,
        order: makeOrder({
          orderCode: 'DH999888',
          totalAmount: 350000,
          paymentStatus: 'UNPAID',
          status: 'PENDING',
        }),
      }
    );
    assert.equal(decision.action, 'PROCESS');
    assert.equal(decision.orderCode, 'DH999888');
    assert.equal(decision.amount, 350000);
    assert.equal(decision.transactionId, 'TXN_FIRST_TIME');
  });

  it('should SKIP underpaid by just 1 VND', () => {
    const decision = evaluateWebhookDecision(
      makeTxn({ amount: 349999 }),
      {
        isDuplicateTransaction: false,
        order: makeOrder({ totalAmount: 350000 }),
      }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'UNDERPAID');
  });
});
