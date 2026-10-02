import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatVND, formatCountdown } from '../src/shared/utils/index.ts';
import { createWalletTopupPaymentLink } from '../src/server/modules/wallet/wallet-topup.service.ts';
import type { WalletTransaction } from '../src/types/index.ts';

// Cấu hình các mốc nạp nhanh chuẩn UI WalletTopupModal
export const WALLET_PRESET_AMOUNTS = [
  { value: 100_000, label: '100.000đ', badge: '100k' },
  { value: 200_000, label: '200.000đ', badge: '200k', popular: true },
  { value: 500_000, label: '500.000đ', badge: '500k' },
  { value: 1_000_000, label: '1.000.000đ', badge: '1M' },
];

// Hàm kiểm định tính hợp lệ của số tiền nạp ví
export function validateWalletTopupAmount(amount: unknown): {
  valid: boolean;
  error?: string;
  normalizedAmount?: number;
} {
  const num = Number(amount);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    return { valid: false, error: 'Số tiền nạp phải là số nguyên hợp lệ' };
  }
  if (num < 10_000) {
    return { valid: false, error: 'Số tiền nạp tối thiểu là 10.000đ' };
  }
  if (num > 50_000_000) {
    return { valid: false, error: 'Số tiền nạp tối đa là 50.000.000đ cho mỗi lần nạp' };
  }
  return { valid: true, normalizedAmount: num };
}

// Hàm lọc và tìm kiếm lịch sử biến động số dư trong WalletView
export function filterWalletTransactions(
  transactions: WalletTransaction[],
  filterType: string,
  searchQuery: string
): WalletTransaction[] {
  const q = searchQuery.trim().toLowerCase();
  return transactions.filter((tx) => {
    const matchType = filterType === 'ALL' || tx.type === filterType;
    const matchSearch =
      !q ||
      tx.description.toLowerCase().includes(q) ||
      (tx.orderId && tx.orderId.toLowerCase().includes(q));
    return matchType && matchSearch;
  });
}

describe('Wallet Topup UI - Preset Amounts & Quick Selection (Pillar 1)', () => {
  it('should define exactly 4 standard quick topup preset amounts (100k, 200k, 500k, 1M)', () => {
    assert.equal(WALLET_PRESET_AMOUNTS.length, 4);
    assert.deepEqual(
      WALLET_PRESET_AMOUNTS.map((p) => p.value),
      [100_000, 200_000, 500_000, 1_000_000]
    );
    assert.deepEqual(
      WALLET_PRESET_AMOUNTS.map((p) => p.badge),
      ['100k', '200k', '500k', '1M']
    );
    assert.equal(WALLET_PRESET_AMOUNTS.find((p) => p.popular)?.value, 200_000);
  });

  it('should format preset amounts into clean Vietnamese Dong strings', () => {
    assert.equal(formatVND(100_000).replace(/\s/g, ' '), '100.000 ₫');
    assert.equal(formatVND(200_000).replace(/\s/g, ' '), '200.000 ₫');
    assert.equal(formatVND(500_000).replace(/\s/g, ' '), '500.000 ₫');
    assert.equal(formatVND(1_000_000).replace(/\s/g, ' '), '1.000.000 ₫');
  });
});

describe('Wallet Topup UI - Amount Input Validation (Pillar 2)', () => {
  it('should accept valid preset and custom amounts between 10k and 50M VND', () => {
    assert.deepEqual(validateWalletTopupAmount(10_000), { valid: true, normalizedAmount: 10_000 });
    assert.deepEqual(validateWalletTopupAmount(100_000), { valid: true, normalizedAmount: 100_000 });
    assert.deepEqual(validateWalletTopupAmount(250_000), { valid: true, normalizedAmount: 250_000 });
    assert.deepEqual(validateWalletTopupAmount(50_000_000), { valid: true, normalizedAmount: 50_000_000 });
  });

  it('should reject amounts less than 10.000 VND', () => {
    const res = validateWalletTopupAmount(9_999);
    assert.equal(res.valid, false);
    assert.match(res.error!, /tối thiểu là 10.000đ/);
  });

  it('should reject amounts exceeding 50.000.000 VND', () => {
    const res = validateWalletTopupAmount(50_000_001);
    assert.equal(res.valid, false);
    assert.match(res.error!, /tối đa là 50.000.000đ/);
  });

  it('should reject non-integers, floats, negative values, and non-numeric inputs', () => {
    assert.equal(validateWalletTopupAmount(50000.5).valid, false);
    assert.equal(validateWalletTopupAmount(-100000).valid, false);
    assert.equal(validateWalletTopupAmount('abc').valid, false);
    assert.equal(validateWalletTopupAmount(null).valid, false);
    assert.equal(validateWalletTopupAmount(undefined).valid, false);
  });
});

describe('Wallet Topup UI - PayOS VietQR Link & Response Contract (Pillar 3)', () => {
  it('should generate VietQR URL, BankInfo, and PayOS checkout parameters', async () => {
    const origEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'test';
      const result = await createWalletTopupPaymentLink({
        userId: 'user_test_ui',
        amount: 200_000,
      });

      assert.equal(result.success, true);
      assert.ok(result.data);
      assert.match(result.data.topupCode, /^NAP\d{9}$/);
      assert.equal(result.data.amount, 200_000);
      assert.ok(result.data.checkoutUrl);
      assert.ok(result.data.qrUrl);
      assert.match(result.data.qrUrl, /img\.vietqr\.io/);
      assert.ok(result.data.bankInfo);
      assert.ok(result.data.bankInfo.bankName);
      assert.ok(result.data.bankInfo.accountNo);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('should format countdown timer for 15-minute QR expiry properly', () => {
    assert.equal(formatCountdown(15 * 60 * 1000), '15:00');
    assert.equal(formatCountdown(9 * 60 * 1000 + 45 * 1000), '09:45');
    assert.equal(formatCountdown(5000), '00:05');
    assert.equal(formatCountdown(0), '00:00');
    assert.equal(formatCountdown(-1000), '00:00');
  });
});

describe('Wallet Topup UI - Transaction Filtering & Classification (Pillar 4)', () => {
  const mockTransactions: WalletTransaction[] = [
    {
      id: 'tx_1',
      walletId: 'w_1',
      type: 'TOPUP',
      amount: 200_000,
      orderId: 'NAP260924001',
      description: 'Nạp ví qua VietQR PayOS NAP260924001',
      createdAt: '2026-09-24T10:00:00.000Z',
    },
    {
      id: 'tx_2',
      walletId: 'w_1',
      type: 'REFUND',
      amount: 450_000,
      orderId: 'DH260924002',
      description: 'Hoàn tiền đơn hàng DH260924002',
      createdAt: '2026-09-24T11:00:00.000Z',
    },
    {
      id: 'tx_3',
      walletId: 'w_1',
      type: 'PURCHASE_PAYMENT',
      amount: -150_000,
      orderId: 'DH260924003',
      description: 'Thanh toán đơn hàng DH260924003',
      createdAt: '2026-09-24T12:00:00.000Z',
    },
  ];

  it('should filter transactions by TOPUP type', () => {
    const topups = filterWalletTransactions(mockTransactions, 'TOPUP', '');
    assert.equal(topups.length, 1);
    assert.equal(topups[0].id, 'tx_1');
    assert.equal(topups[0].type, 'TOPUP');
    assert.equal(topups[0].amount, 200_000);
  });

  it('should filter transactions by REFUND and PURCHASE_PAYMENT', () => {
    const refunds = filterWalletTransactions(mockTransactions, 'REFUND', '');
    assert.equal(refunds.length, 1);
    assert.equal(refunds[0].id, 'tx_2');

    const payments = filterWalletTransactions(mockTransactions, 'PURCHASE_PAYMENT', '');
    assert.equal(payments.length, 1);
    assert.equal(payments[0].id, 'tx_3');
  });

  it('should search transactions by NAP code or orderId', () => {
    const byNap = filterWalletTransactions(mockTransactions, 'ALL', 'NAP260924001');
    assert.equal(byNap.length, 1);
    assert.equal(byNap[0].id, 'tx_1');

    const byDesc = filterWalletTransactions(mockTransactions, 'ALL', 'Hoàn tiền');
    assert.equal(byDesc.length, 1);
    assert.equal(byDesc[0].id, 'tx_2');
  });

  it('should return all transactions when filter is ALL and search is empty', () => {
    const all = filterWalletTransactions(mockTransactions, 'ALL', '');
    assert.equal(all.length, 3);
  });
});
