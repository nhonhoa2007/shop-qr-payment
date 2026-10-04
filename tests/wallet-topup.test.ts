import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateTopupCode } from '../src/shared/utils/index.ts';
import { parseTopupCodeFromDescription,
  safeCompare,
  evaluateTopupWebhookDecision, } from '@server/modules/payment/vietqr-parser.service';
import { createWalletTopupSession, getWalletTopupSession, getWalletTopupSessionByIdempotencyToken, processWalletTopup, createWalletTopupPaymentLink, inFlightTopupLocks } from '@server/modules/wallet/wallet-topup.service';

type TxClient = Parameters<typeof processWalletTopup>[0];

describe('Wallet Topup - Code Generation & Parser', () => {
  it('should generate valid NAP transaction codes with NAP prefix and 9 digits', () => {
    const code = generateTopupCode();
    assert.equal(typeof code, 'string');
    assert.match(code, /^NAP\d{9}$/);
  });

  it('should extract NAP transaction codes from various bank transfer descriptions', () => {
    assert.equal(parseTopupCodeFromDescription('NAP260924001'), 'NAP260924001');
    assert.equal(parseTopupCodeFromDescription('nap260924001'), 'NAP260924001');
    assert.equal(parseTopupCodeFromDescription('NAP 260924001'), 'NAP260924001');
    assert.equal(parseTopupCodeFromDescription('nap  260924001'), 'NAP260924001');
    assert.equal(
      parseTopupCodeFromDescription('MBVCB.123456.NAP260924001.CT tien nap vi'),
      'NAP260924001'
    );
    assert.equal(parseTopupCodeFromDescription('NAP12345'), 'NAP12345');
    assert.equal(parseTopupCodeFromDescription('NAP998877A'), 'NAP998877A');
  });

  it('should return null when description has no valid NAP code', () => {
    assert.equal(parseTopupCodeFromDescription('DH260924001'), null);
    assert.equal(parseTopupCodeFromDescription('Chuyen tien mua hang'), null);
    assert.equal(parseTopupCodeFromDescription('NAP12'), null); // < 4 ký tự sau NAP
    assert.equal(parseTopupCodeFromDescription(''), null);
    assert.equal(parseTopupCodeFromDescription(null), null);
    assert.equal(parseTopupCodeFromDescription(undefined), null);
  });
});

describe('Wallet Topup - Constant-time safeCompare (Timing Attack Prevention)', () => {
  it('should return true for identical strings', () => {
    assert.equal(safeCompare('secure_token_123', 'secure_token_123'), true);
  });

  it('should return false for different strings of same length', () => {
    assert.equal(safeCompare('secure_token_123', 'secure_token_456'), false);
  });

  it('should return false for strings of different lengths', () => {
    assert.equal(safeCompare('short', 'much_longer_string'), false);
  });

  it('should return false for empty or non-string inputs', () => {
    assert.equal(safeCompare('', 'secret'), false);
    assert.equal(safeCompare('secret', ''), false);
    assert.equal(safeCompare(null as unknown as string, 'secret'), false);
  });
});

describe('Wallet Topup - Session Management', () => {
  it('should reject creating session with amount < 10.000đ', async () => {
    await assert.rejects(
      async () => {
        await createWalletTopupSession({ userId: 'u_test_1', amount: 5000 });
      },
      { message: /Số tiền nạp tối thiểu là 10.000đ/ }
    );
  });

  it('should create valid topup session with idempotencyToken and PENDING status', async () => {
    const session = await createWalletTopupSession({
      userId: 'u_test_1',
      amount: 100_000,
    });

    assert.equal(session.userId, 'u_test_1');
    assert.equal(session.amount, 100_000);
    assert.equal(session.status, 'PENDING');
    assert.match(session.topupCode, /^NAP/);
    assert.equal(typeof session.idempotencyToken, 'string');
    assert.ok(session.idempotencyToken.length > 20);

    // Truy vấn lại theo topupCode
    const retrievedByCode = await getWalletTopupSession(session.topupCode);
    assert.deepEqual(retrievedByCode, session);

    // Truy vấn lại theo idempotencyToken
    const retrievedByIdempotency = await getWalletTopupSessionByIdempotencyToken(session.idempotencyToken!);
    assert.deepEqual(retrievedByIdempotency, session);

    // Tái sử dụng phiên khi gửi cùng idempotencyToken (Idempotent creation)
    const duplicateSession = await createWalletTopupSession({
      userId: 'u_test_1',
      amount: 100_000,
      idempotencyToken: session.idempotencyToken,
    });
    assert.equal(duplicateSession.topupCode, session.topupCode);
    assert.equal(duplicateSession.idempotencyToken, session.idempotencyToken);
  });
});

describe('Wallet Topup - evaluateTopupWebhookDecision (Decision Matrix)', () => {
  it('should SKIP when bankTransId is a duplicate (Replay Attack)', () => {
    const decision = evaluateTopupWebhookDecision(
      { id: 'FT_DUP_123', amount: 200_000, description: 'NAP260924001' },
      {
        isDuplicateTransaction: true,
        session: { topupCode: 'NAP260924001', amount: 200_000, status: 'PENDING' },
      }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'DUPLICATE_TRANSACTION');
  });

  it('should SKIP when description has no valid NAP code', () => {
    const decision = evaluateTopupWebhookDecision(
      { id: 'FT_001', amount: 200_000, description: 'Chuyen tien khong ma' },
      {
        isDuplicateTransaction: false,
        session: null,
      }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'NO_TOPUP_CODE');
  });

  it('should SKIP when amount is invalid or zero', () => {
    const decision = evaluateTopupWebhookDecision(
      { id: 'FT_002', amount: 0, description: 'NAP260924001' },
      {
        isDuplicateTransaction: false,
        session: { topupCode: 'NAP260924001', amount: 200_000, status: 'PENDING' },
      }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'INVALID_AMOUNT');
  });

  it('should SKIP when session is not found in system', () => {
    const decision = evaluateTopupWebhookDecision(
      { id: 'FT_003', amount: 200_000, description: 'NAP999999999' },
      {
        isDuplicateTransaction: false,
        session: null,
      }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'SESSION_NOT_FOUND');
  });

  it('should SKIP when session is already COMPLETED (Idempotency)', () => {
    const decision = evaluateTopupWebhookDecision(
      { id: 'FT_004', amount: 200_000, description: 'NAP260924001' },
      {
        isDuplicateTransaction: false,
        session: { topupCode: 'NAP260924001', amount: 200_000, status: 'COMPLETED' },
      }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'ALREADY_COMPLETED');
  });

  it('should SKIP when amount is less than session requirement (Underpaid)', () => {
    const decision = evaluateTopupWebhookDecision(
      { id: 'FT_005', amount: 150_000, description: 'NAP260924001' },
      {
        isDuplicateTransaction: false,
        session: { topupCode: 'NAP260924001', amount: 200_000, status: 'PENDING' },
      }
    );
    assert.equal(decision.action, 'SKIP');
    assert.equal(decision.reason, 'UNDERPAID');
  });

  it('should PROCESS when valid amount matches or exceeds session requirement', () => {
    const decision = evaluateTopupWebhookDecision(
      { id: 'FT_VALID_888', amount: 200_000, description: 'NAP260924001' },
      {
        isDuplicateTransaction: false,
        session: { topupCode: 'NAP260924001', amount: 200_000, status: 'PENDING' },
      }
    );
    assert.equal(decision.action, 'PROCESS');
    assert.equal(decision.topupCode, 'NAP260924001');
    assert.equal(decision.amount, 200_000);
    assert.equal(decision.transactionId, 'FT_VALID_888');
  });
});

describe('Wallet Topup - processWalletTopup Core Engine', () => {
  it('should atomically credit balance and create WalletTransaction with type TOPUP', async () => {
    let walletUpdatedData: unknown = null;
    let txCreatedData: unknown = null;

    const fakeWallet = { id: 'w_101', userId: 'u_user_99', balance: 50_000 };
    const fakeTx = {
      userWallet: {
        findUnique: async () => fakeWallet,
        update: async (args: { data: { balance: { increment: number } } }) => {
          walletUpdatedData = args.data;
          return { ...fakeWallet, balance: fakeWallet.balance + args.data.balance.increment };
        },
      },
      walletTransaction: {
        findFirst: async () => null, // Chưa từng xử lý
        create: async (args: { data: unknown }) => {
          txCreatedData = args.data;
          return { id: 'wtx_999', ...(args.data as object) };
        },
      },
    } as unknown as TxClient;

    const res = await processWalletTopup(fakeTx, {
      topupCode: 'NAP260924777',
      amount: 100_000,
      userId: 'u_user_99',
      bankTransId: 'FT_BANK_777',
    });

    assert.equal(res.success, true);
    assert.equal(res.newBalance, 150_000);
    assert.equal(res.transactionId, 'wtx_999');
    assert.equal(res.topupCode, 'NAP260924777');

    assert.deepEqual(walletUpdatedData, {
      balance: { increment: 100_000 },
    });

    assert.deepEqual(txCreatedData, {
      walletId: 'w_101',
      amount: 100_000,
      type: 'TOPUP',
      orderId: 'NAP260924777',
      description: 'Nạp tiền vào ví (NAP260924777) [FT_BANK_777]',
    });
  });

  it('should prevent double-crediting if transaction was already processed (Persistent Idempotency Guard)', async () => {
    let walletUpdateCalled = false;

    const existingTxRecord = {
      id: 'wtx_existing_888',
      walletId: 'w_101',
      amount: 200_000,
      type: 'TOPUP',
      orderId: 'NAP260924888',
      description: 'Nạp tiền vào ví (NAP260924888) [FT_BANK_888]',
    };

    const fakeWallet = { id: 'w_101', userId: 'u_user_99', balance: 250_000 };
    const fakeTx = {
      userWallet: {
        findUnique: async () => fakeWallet,
        update: async () => {
          walletUpdateCalled = true;
          return fakeWallet;
        },
      },
      walletTransaction: {
        findFirst: async () => existingTxRecord, // Đã tồn tại giao dịch trong DB
        create: async () => {
          throw new Error('Should not create duplicate transaction');
        },
      },
    } as unknown as TxClient;

    const res = await processWalletTopup(fakeTx, {
      topupCode: 'NAP260924888',
      amount: 200_000,
      userId: 'u_user_99',
      bankTransId: 'FT_BANK_888',
    });

    assert.equal(res.success, true);
    assert.equal(res.alreadyProcessed, true);
    assert.equal(res.newBalance, 250_000);
    assert.equal(res.transactionId, 'wtx_existing_888');
    assert.equal(walletUpdateCalled, false, 'Số dư ví tuyệt đối không được cộng lần thứ 2');
  });

  it('should prevent concurrent race conditions when inFlight lock is held', async () => {
    let walletUpdateCalled = false;
    const fakeWallet = { id: 'w_101', userId: 'u_user_99', balance: 250_000 };
    const fakeTx = {
      userWallet: {
        findUnique: async () => fakeWallet,
        update: async () => {
          walletUpdateCalled = true;
          return fakeWallet;
        },
      },
      walletTransaction: {
        findFirst: async () => null,
        create: async () => {
          throw new Error('Should not create transaction while locked');
        },
      },
    } as unknown as TxClient;

    const lockKey = 'NAP_LOCK_TEST_01';
    inFlightTopupLocks.add(lockKey);

    try {
      const res = await processWalletTopup(fakeTx, {
        topupCode: lockKey,
        amount: 200_000,
        userId: 'u_user_99',
      });

      assert.equal(res.success, true);
      assert.equal(res.alreadyProcessed, true);
      assert.equal(walletUpdateCalled, false, 'Số dư ví không được cộng khi lock đang bị giữ');
    } finally {
      inFlightTopupLocks.delete(lockKey);
    }
  });
});

describe('Wallet Topup - Payment Link Creation', () => {
  it('should generate VietQR topup QR parameters with valid topupCode', async () => {
    const origEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'test';
      const res = await createWalletTopupPaymentLink({
        userId: 'u_pay_user',
        amount: 500_000,
      });

      assert.equal(res.success, true);
      assert.ok(res.data);
      assert.match(res.data!.topupCode, /^NAP/);
      assert.equal(res.data!.amount, 500_000);
      assert.ok(res.data!.qrUrl);
      assert.match(res.data!.qrUrl!, /img\.vietqr\.io/);
      assert.ok(res.data!.idempotencyToken);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });
});
