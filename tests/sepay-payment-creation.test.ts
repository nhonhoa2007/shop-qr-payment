import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWalletTopupPaymentLink,
  getWalletTopupSession,
  inMemoryTopupStore,
} from '@server/modules/wallet/wallet-topup.service';
import { createPaymentRequestTestStore, withTestBankEnv } from './helpers/payment-request-store.ts';

describe('SePay payment request creation', () => {
  it('persists a wallet top-up request and can reload it after the memory cache is cleared', async () => {
    const store = createPaymentRequestTestStore();
    await withTestBankEnv(async () => {
      const result = await createWalletTopupPaymentLink({
        userId: 'user_1',
        amount: 200_000,
        idempotencyToken: 'idem-restart-test',
      }, store);

      assert.equal(result.success, true);
      assert.ok(result.data);
      assert.match(result.data.qrUrl ?? '', /^https:\/\/vietqr\.app\/img\?/);
      assert.equal(store.rows.length, 1);
      assert.equal(store.rows[0].kind, 'WALLET_TOPUP');
      assert.equal(store.rows[0].amount, 200_000n);

      inMemoryTopupStore.clear();
      const reloaded = await getWalletTopupSession(result.data.topupCode, store);
      assert.equal(reloaded?.userId, 'user_1');
      assert.equal(reloaded?.amount, 200_000);
      assert.equal(reloaded?.status, 'PENDING');
    });
  });

  it('returns the original code and QR for an idempotent retry', async () => {
    const store = createPaymentRequestTestStore();
    await withTestBankEnv(async () => {
      const first = await createWalletTopupPaymentLink({
        userId: 'user_1',
        amount: 500_000,
        idempotencyToken: 'idem-retry-test',
      }, store);
      const second = await createWalletTopupPaymentLink({
        userId: 'user_1',
        amount: 500_000,
        idempotencyToken: 'idem-retry-test',
      }, store);

      assert.equal(store.rows.length, 1);
      assert.equal(second.data?.topupCode, first.data?.topupCode);
      assert.equal(second.data?.qrUrl, first.data?.qrUrl);
    });
  });
});
