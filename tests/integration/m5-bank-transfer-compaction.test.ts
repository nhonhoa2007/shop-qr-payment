import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  migrateTransactionsToBankTransfers,
  getReconciledPaymentAnalytics,
} from '@server/modules/payment/transaction-compaction.service';

describe('M5 Compaction - Transaction to BankTransfer Migration', () => {
  function createMockDb() {
    const legacyTransactions: any[] = [];
    const bankTransfers: any[] = [];

    const tx: any = {
      transaction: {
        findMany: async () => [...legacyTransactions],
        count: async () => legacyTransactions.length,
      },
      bankTransfer: {
        findUnique: async ({ where }: any) => {
          if (where.fingerprint) {
            return bankTransfers.find((b) => b.fingerprint === where.fingerprint) ?? null;
          }
          if (where.bankTransId) {
            return bankTransfers.find((b) => b.bankTransId === where.bankTransId) ?? null;
          }
          return null;
        },
        create: async ({ data }: any) => {
          const record = { id: `bt_${bankTransfers.length + 1}`, createdAt: new Date(), ...data };
          bankTransfers.push(record);
          return record;
        },
        findMany: async ({ where }: any) => {
          return bankTransfers.filter((b) => {
            if (where.status && b.status !== where.status) return false;
            return true;
          });
        },
        count: async ({ where }: any) => {
          if (!where) return bankTransfers.length;
          return bankTransfers.filter((b) => {
            if (where.status && b.status !== where.status) return false;
            return true;
          }).length;
        },
      },
      _seedTransaction: (t: any) => legacyTransactions.push({ ...t }),
      _getBankTransfers: () => bankTransfers,
    };

    return tx;
  }

  it('backfills legacy Transaction records into BankTransfer(APPLIED_ORDER) with exact BigInt sums', async () => {
    const db = createMockDb();
    const now = new Date();

    db._seedTransaction({
      id: 'tx_1',
      orderId: 'ord_1',
      bankTransId: 'FT261018001',
      amount: 15_000_000n,
      description: 'DH001 chuyen khoan',
      bankName: 'MBBank',
      senderAccount: '0987654321',
      receivedAt: now,
      verified: true,
      rawWebhookData: { cassoId: 'casso_1' },
      createdAt: now,
    });

    db._seedTransaction({
      id: 'tx_2',
      orderId: 'ord_2',
      bankTransId: 'FT261018002',
      amount: 25_000_000n,
      description: 'DH002 chuyen khoan',
      bankName: 'Vietcombank',
      senderAccount: '0123456789',
      receivedAt: now,
      verified: true,
      rawWebhookData: { cassoId: 'casso_2' },
      createdAt: now,
    });

    // Run migration
    const report1 = await migrateTransactionsToBankTransfers(db);
    assert.equal(report1.migratedCount, 2);
    assert.equal(report1.skippedCount, 0);
    assert.equal(report1.totalAmountMigrated, 40_000_000n);

    const transfers = db._getBankTransfers();
    assert.equal(transfers.length, 2);
    assert.equal(transfers[0].status, 'APPLIED_ORDER');
    assert.equal(transfers[0].fingerprint, 'legacy_tx:FT261018001');
    assert.equal(transfers[0].amount, 15_000_000n);

    // Rerun: idempotent
    const report2 = await migrateTransactionsToBankTransfers(db);
    assert.equal(report2.migratedCount, 0);
    assert.equal(report2.skippedCount, 2);
  });

  it('reads payment analytics and counts accurately from BankTransfer table', async () => {
    const db = createMockDb();
    db._seedTransaction({
      id: 'tx_1',
      orderId: 'ord_1',
      bankTransId: 'FT001',
      amount: 10_000_000n,
      description: 'DH001',
      createdAt: new Date(),
    });

    await migrateTransactionsToBankTransfers(db);

    const stats = await getReconciledPaymentAnalytics(db);
    assert.equal(stats.totalPaidTransfers, 1);
    assert.equal(stats.totalRevenueBigInt, 10_000_000n);
  });
});
