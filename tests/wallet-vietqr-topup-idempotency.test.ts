import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateTopupCode } from '../src/shared/utils/index.ts';
import {
  parseTopupCodeFromDescription,
  safeCompare,
  evaluateTopupWebhookDecision,
} from '../src/lib/payment-parser.ts';
import {
  createWalletTopupSession,
  getWalletTopupSession,
  processWalletTopup,
} from '../src/lib/wallet.ts';

type TxClient = Parameters<typeof processWalletTopup>[0];

describe('VietQR Topup - Session Lifecycle & Payload Boundaries (Pillar 1 & 2)', () => {
  it('should generate standardized NAP transaction codes matching NAP\\d{9}', () => {
    for (let i = 0; i < 10; i++) {
      const code = generateTopupCode();
      assert.match(code, /^NAP\d{9}$/);
    }
  });

  it('should strictly reject topup amounts under 10.000 VND (Boundary testing)', async () => {
    const invalidAmounts = [0, -1000, -50000, 5000, 9999];
    for (const amt of invalidAmounts) {
      await assert.rejects(
        async () => {
          await createWalletTopupSession({ userId: 'user_test_boundary', amount: amt });
        },
        { message: /Số tiền nạp tối thiểu là 10.000đ/ }
      );
    }
  });

  it('should create valid session with unique idempotencyToken and PENDING state', async () => {
    const session = await createWalletTopupSession({
      userId: 'user_alpha_01',
      amount: 250000,
    });

    assert.equal(session.userId, 'user_alpha_01');
    assert.equal(session.amount, 250000);
    assert.equal(session.status, 'PENDING');
    assert.ok(session.topupCode.startsWith('NAP'));
    assert.equal(typeof session.idempotencyToken, 'string');
    assert.ok(session.idempotencyToken.length >= 32);

    // Retrieve via topupCode
    const byCode = await getWalletTopupSession(session.topupCode);
    assert.deepEqual(byCode, session);
  });
});

describe('VietQR Topup - Timing Attack Prevention & Safe Compare (Pillar 2 & SEC-01)', () => {
  it('safeCompare should return true for exact matching tokens', () => {
    const secret = 'webhook_secret_signature_987654321_abc';
    assert.equal(safeCompare(secret, secret), true);
  });

  it('safeCompare should return false for altered tokens of same length in constant-time', () => {
    const tokenA = 'webhook_secret_signature_987654321_abc';
    const tokenB = 'webhook_secret_signature_987654321_abd'; // 1 char difference
    assert.equal(safeCompare(tokenA, tokenB), false);
  });

  it('safeCompare should safely return false without crashing for mismatched lengths, empty strings, null, undefined', () => {
    assert.equal(safeCompare('short', 'a_much_longer_string_value'), false);
    assert.equal(safeCompare('', 'secret'), false);
    assert.equal(safeCompare('secret', ''), false);
    assert.equal(safeCompare('', ''), false);
    assert.equal(safeCompare(null as unknown as string, 'secret'), false);
    assert.equal(safeCompare('secret', undefined as unknown as string), false);
  });
});

describe('VietQR Topup - Parser Robustness across Banking Networks (Pillar 2 & 4)', () => {
  it('should parse NAP codes from diverse bank transfer descriptions', () => {
    // Standard direct
    assert.equal(parseTopupCodeFromDescription('NAP260924001'), 'NAP260924001');
    assert.equal(parseTopupCodeFromDescription('nap260924001'), 'NAP260924001');

    // With spaces
    assert.equal(parseTopupCodeFromDescription('NAP 260924001'), 'NAP260924001');
    assert.equal(parseTopupCodeFromDescription('nap   260924001'), 'NAP260924001');

    // Vietcombank / Techcombank / MB Bank memo styles
    assert.equal(
      parseTopupCodeFromDescription('MBVCB.789123.NAP260924001.Nguyen Van A chuyen tien'),
      'NAP260924001'
    );
    assert.equal(
      parseTopupCodeFromDescription('FT2426899990111 NAP 260924001 Nap tien vi'),
      'NAP260924001'
    );
    assert.equal(
      parseTopupCodeFromDescription('NAP998877A123 chuyen khoan'),
      'NAP998877A123'
    );
  });

  it('should return null for descriptions lacking valid NAP format', () => {
    assert.equal(parseTopupCodeFromDescription('DH260924001'), null);
    assert.equal(parseTopupCodeFromDescription('Chuyen tien an trua'), null);
    assert.equal(parseTopupCodeFromDescription('NAP12'), null); // too short (< 4 chars after NAP)
    assert.equal(parseTopupCodeFromDescription(''), null);
    assert.equal(parseTopupCodeFromDescription(null), null);
    assert.equal(parseTopupCodeFromDescription(undefined), null);
  });
});

describe('VietQR Topup - Webhook Decision Matrix Verification (Pillar 1 & 4)', () => {
  const sampleSession = {
    topupCode: 'NAP123456789',
    userId: 'user_test',
    amount: 100000,
    status: 'PENDING' as const,
    idempotencyToken: 'token-uuid',
    createdAt: new Date().toISOString(),
  };

  it('should SKIP when bank transaction ID is an existing duplicate (Replay Attack Protection)', () => {
    const decision = evaluateTopupWebhookDecision(
      { id: 'FT_EXISTING_DUP', description: 'NAP123456789', amount: 100000 },
      { isDuplicateTransaction: true, session: sampleSession }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'DUPLICATE_TRANSACTION');
  });

  it('should SKIP when description has no valid NAP topup code pattern', () => {
    const decision = evaluateTopupWebhookDecision(
      { id: 'FT_NEW_1', description: 'Thanh toan don hang DH999', amount: 100000 },
      { isDuplicateTransaction: false, session: null }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'NO_TOPUP_CODE');
  });

  it('should SKIP when topup amount is invalid, zero or negative', () => {
    const decision = evaluateTopupWebhookDecision(
      { id: 'FT_NEW_2', description: 'NAP123456789', amount: 0 },
      { isDuplicateTransaction: false, session: sampleSession }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'INVALID_AMOUNT');
  });

  it('should SKIP when session is not found in database or memory cache', () => {
    const decision = evaluateTopupWebhookDecision(
      { id: 'FT_NEW_3', description: 'NAP123456789', amount: 100000 },
      { isDuplicateTransaction: false, session: null }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'SESSION_NOT_FOUND');
  });

  it('should SKIP when session is already in COMPLETED state (Idempotency Guard)', () => {
    const decision = evaluateTopupWebhookDecision(
      { id: 'FT_NEW_4', description: 'NAP123456789', amount: 100000 },
      { isDuplicateTransaction: false, session: { ...sampleSession, status: 'COMPLETED' } }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'ALREADY_COMPLETED');
  });

  it('should SKIP when customer underpaid compared to requested topup amount', () => {
    const decision = evaluateTopupWebhookDecision(
      { id: 'FT_NEW_5', description: 'NAP123456789', amount: 50000 }, // only 50k instead of 100k
      { isDuplicateTransaction: false, session: sampleSession }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'UNDERPAID');
  });

  it('should PROCESS when valid amount matches or exceeds session requirement', () => {
    const decision = evaluateTopupWebhookDecision(
      { id: 'FT_NEW_6', description: 'NAP123456789', amount: 100000 },
      { isDuplicateTransaction: false, session: sampleSession }
    );
    assert.equal(decision.action, 'PROCESS');
    if (decision.action === 'PROCESS') {
      assert.equal(decision.topupCode, 'NAP123456789');
      assert.equal(decision.amount, 100000);
      assert.equal(decision.transactionId, 'FT_NEW_6');
    }
  });
});

describe('VietQR Topup - Concurrency & Persistent Idempotency Guard (Pillar 3)', () => {
  it('should atomically credit balance and record TOPUP transaction on first webhook call', async () => {
    let balanceUpdated = 0;
    let createdTx: Record<string, unknown> | null = null;

    const mockTx = {
      userWallet: {
        findUnique: async () => ({ id: 'w_user_1', userId: 'u_1', balance: 50000 }),
        create: async () => ({ id: 'w_user_1', userId: 'u_1', balance: 0 }),
        update: async ({ data }: { data: { balance: { increment: number } } }) => {
          balanceUpdated = 50000 + data.balance.increment;
          return { id: 'w_user_1', balance: balanceUpdated };
        },
      },
      walletTransaction: {
        findFirst: async () => null, // First time: no existing transaction!
        create: async ({ data }: { data: Record<string, unknown> }) => {
          createdTx = data;
          return { id: 'tx_topup_001', ...data };
        },
      },
    } as unknown as TxClient;

    const result = await processWalletTopup(mockTx, {
      topupCode: 'NAP888999111',
      amount: 200000,
      userId: 'u_1',
      bankTransId: 'BANK_TXN_001',
      description: 'Nap tien qua VietQR',
    });

    assert.equal(result.success, true);
    assert.equal(result.newBalance, 250000);
    assert.equal(balanceUpdated, 250000);
    assert.ok(createdTx);
    assert.equal((createdTx as Record<string, unknown>).amount, 200000);
    assert.equal((createdTx as Record<string, unknown>).type, 'TOPUP');
    assert.equal((createdTx as Record<string, unknown>).orderId, 'NAP888999111');
  });

  it('should PREVENT double crediting on replayed webhook (Persistent Idempotency Guard)', async () => {
    let updateCalled = false;

    const mockTx = {
      userWallet: {
        findUnique: async () => ({ id: 'w_user_1', userId: 'u_1', balance: 250000 }),
        update: async () => {
          updateCalled = true;
          return { id: 'w_user_1', balance: 450000 };
        },
      },
      walletTransaction: {
        // Simulates existing transaction already committed in DB
        findFirst: async () => ({
          id: 'tx_topup_001',
          walletId: 'w_user_1',
          type: 'TOPUP',
          amount: 200000,
          orderId: 'NAP888999111',
        }),
        create: async () => {
          assert.fail('Should NOT create new transaction on replay');
        },
      },
    } as unknown as TxClient;

    const result = await processWalletTopup(mockTx, {
      topupCode: 'NAP888999111',
      amount: 200000,
      userId: 'u_1',
      bankTransId: 'BANK_TXN_001',
    });

    assert.equal(result.success, true);
    assert.equal(result.alreadyProcessed, true);
    assert.equal(result.newBalance, 250000); // Balance unchanged!
    assert.equal(updateCalled, false); // Balance was NOT incremented again!
  });
});
