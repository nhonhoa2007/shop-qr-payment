import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getOrCreateWallet,
  refundOrderToWallet,
  payOrderWithWallet,
} from '../src/lib/wallet.ts';

type TxClient = Parameters<typeof getOrCreateWallet>[0];

describe('Shop Wallet - getOrCreateWallet', () => {
  it('should return existing wallet if found in DB', async () => {
    const existingWallet = { id: 'w_1', userId: 'u_1', balance: 500_000, updatedAt: new Date() };
    const fakeTx = {
      userWallet: {
        findUnique: async () => existingWallet,
        create: async () => {
          throw new Error('Should not create new wallet');
        },
      },
    } as unknown as TxClient;

    const wallet = await getOrCreateWallet(fakeTx, 'u_1');
    assert.deepEqual(wallet, existingWallet);
  });

  it('should create new wallet with balance 0 if not found', async () => {
    let createdWith: unknown = null;
    const fakeTx = {
      userWallet: {
        findUnique: async () => null,
        create: async (args: unknown) => {
          createdWith = args;
          return { id: 'w_new', userId: 'u_new', balance: 0, updatedAt: new Date() };
        },
      },
    } as unknown as TxClient;

    const wallet = await getOrCreateWallet(fakeTx, 'u_new');
    assert.equal(wallet.id, 'w_new');
    assert.equal(wallet.balance, 0);
    assert.deepEqual(createdWith, {
      data: {
        userId: 'u_new',
        balance: 0,
      },
    });
  });
});

describe('Shop Wallet - refundOrderToWallet (Refund Engine)', () => {
  it('should reject when order does not exist', async () => {
    const fakeTx = {
      order: { findUnique: async () => null },
    } as unknown as TxClient;

    const res = await refundOrderToWallet(fakeTx, 'missing_id');
    assert.equal(res.success, false);
    assert.match(res.error!, /Không tìm thấy đơn hàng/);
  });

  it('should reject when order is not PAID', async () => {
    const fakeTx = {
      order: {
        findUnique: async () => ({ id: 'o_1', paymentStatus: 'UNPAID', totalAmount: 200_000 }),
      },
    } as unknown as TxClient;

    const res = await refundOrderToWallet(fakeTx, 'o_1');
    assert.equal(res.success, false);
    assert.match(res.error!, /đã thanh toán/);
  });

  it('should reject when order is already REFUNDED to prevent double-refund', async () => {
    const fakeTx = {
      order: {
        findUnique: async () => ({ id: 'o_1', paymentStatus: 'REFUNDED', totalAmount: 200_000 }),
      },
    } as unknown as TxClient;

    const res = await refundOrderToWallet(fakeTx, 'o_1');
    assert.equal(res.success, false);
    assert.match(res.error!, /đã được hoàn tiền trước đó/);
  });

  it('should refund 100% money into user wallet and record transaction for member orders', async () => {
    let orderUpdatedData: unknown = null;
    let orderUpdatedWhere: unknown = null;
    let walletIncrementArgs: unknown = null;
    let txCreatedArgs: unknown = null;
    let productStockIncrementArgs: unknown = null;

    const fakeOrder = {
      id: 'ord_paid_123',
      orderCode: 'DH8888',
      userId: 'user_456',
      totalAmount: 350_000,
      paymentStatus: 'PAID',
      status: 'PROCESSING',
      items: [
        { productId: 'prod_101', quantity: 2, variantId: null },
      ],
    };

    const fakeWallet = {
      id: 'wal_789',
      userId: 'user_456',
      balance: 100_000,
    };

    const fakeTx = {
      order: {
        findUnique: async () => fakeOrder,
        updateMany: async (args: { where: unknown; data: unknown }) => {
          orderUpdatedWhere = args.where;
          orderUpdatedData = args.data;
          return { count: 1 };
        },
      },
      product: {
        update: async (args: unknown) => {
          productStockIncrementArgs = args;
          return {};
        },
      },
      productVariant: {
        update: async () => ({}),
      },
      userWallet: {
        findUnique: async () => fakeWallet,
        update: async (args: unknown) => {
          walletIncrementArgs = args;
          return { ...fakeWallet, balance: fakeWallet.balance + fakeOrder.totalAmount };
        },
      },
      walletTransaction: {
        create: async (args: unknown) => {
          txCreatedArgs = args;
          return { id: 'wtx_ref_001' };
        },
      },
    } as unknown as TxClient;

    const res = await refundOrderToWallet(fakeTx, fakeOrder.id, 'Khách yêu cầu hủy đơn');

    assert.equal(res.success, true);
    assert.equal(res.refundedAmount, 350_000);
    assert.equal(res.newBalance, 450_000);
    assert.equal(res.transactionId, 'wtx_ref_001');

    assert.deepEqual(orderUpdatedWhere, {
      id: fakeOrder.id,
      paymentStatus: 'PAID',
    });

    assert.deepEqual(orderUpdatedData, {
      paymentStatus: 'REFUNDED',
      status: 'CANCELLED',
    });

    assert.deepEqual(productStockIncrementArgs, {
      where: { id: 'prod_101' },
      data: { stock: { increment: 2 } },
    });

    assert.deepEqual(walletIncrementArgs, {
      where: { id: fakeWallet.id },
      data: { balance: { increment: 350_000 } },
    });

    assert.deepEqual(txCreatedArgs, {
      data: {
        walletId: fakeWallet.id,
        amount: 350_000,
        type: 'REFUND',
        orderId: fakeOrder.id,
        description: 'Khách yêu cầu hủy đơn',
      },
    });
  });

  it('should reject refund if atomic CAS update fails (count !== 1) to prevent double-refund race condition', async () => {
    const fakeOrder = {
      id: 'ord_cas_fail',
      orderCode: 'DH7777',
      userId: 'user_456',
      totalAmount: 200_000,
      paymentStatus: 'PAID',
      status: 'PROCESSING',
      items: [],
    };

    const fakeTx = {
      order: {
        findUnique: async () => fakeOrder,
        updateMany: async () => ({ count: 0 }),
      },
    } as unknown as TxClient;

    const res = await refundOrderToWallet(fakeTx, fakeOrder.id);
    assert.equal(res.success, false);
    assert.match(res.error!, /Đơn hàng đã được xử lý hoàn tiền hoặc không ở trạng thái hợp lệ/);
  });

  it('should release variant stock and base product stock when refunding order with multiple items', async () => {
    const variantUpdated: unknown[] = [];
    const productUpdated: unknown[] = [];

    const fakeOrder = {
      id: 'ord_multi_items',
      orderCode: 'DH6666',
      userId: null,
      totalAmount: 500_000,
      paymentStatus: 'PAID',
      status: 'PROCESSING',
      items: [
        { productId: 'p1', variantId: 'v1', quantity: 3 },
        { productId: 'p2', variantId: null, quantity: 1 },
      ],
    };

    const fakeTx = {
      order: {
        findUnique: async () => fakeOrder,
        updateMany: async () => ({ count: 1 }),
      },
      productVariant: {
        update: async (args: unknown) => {
          variantUpdated.push(args);
          return {};
        },
      },
      product: {
        update: async (args: unknown) => {
          productUpdated.push(args);
          return {};
        },
      },
    } as unknown as TxClient;

    const res = await refundOrderToWallet(fakeTx, fakeOrder.id);
    assert.equal(res.success, true);
    assert.equal(res.isGuest, true);
    assert.equal(variantUpdated.length, 1);
    assert.deepEqual(variantUpdated[0], {
      where: { id: 'v1' },
      data: { stock: { increment: 3 } },
    });
    assert.equal(productUpdated.length, 1);
    assert.deepEqual(productUpdated[0], {
      where: { id: 'p2' },
      data: { stock: { increment: 1 } },
    });
  });
});

describe('Shop Wallet - payOrderWithWallet', () => {
  it('should reject payment if wallet balance is less than order amount', async () => {
    const fakeOrder = {
      id: 'o_check',
      orderCode: 'DH100',
      userId: 'user_1',
      totalAmount: 200_000,
      paymentStatus: 'UNPAID',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
    };

    const fakeWallet = {
      id: 'wal_1',
      userId: 'user_1',
      balance: 50_000, // Thiếu tiền
    };

    const fakeTx = {
      order: { findUnique: async () => fakeOrder },
      userWallet: { findUnique: async () => fakeWallet },
    } as unknown as TxClient;

    const res = await payOrderWithWallet(fakeTx, 'user_1', 'o_check');
    assert.equal(res.success, false);
    assert.match(res.error!, /Số dư ví không đủ/);
  });

  it('should atomically deduct balance and confirm order when wallet balance is sufficient', async () => {
    const fakeOrder = {
      id: 'o_pay_ok',
      orderCode: 'DH200',
      userId: 'user_1',
      totalAmount: 180_000,
      paymentStatus: 'UNPAID',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
    };

    const fakeWallet = {
      id: 'wal_1',
      userId: 'user_1',
      balance: 300_000,
    };

    let walletDeductedArgs: unknown = null;
    let orderUpdatedData: unknown = null;
    let txCreatedArgs: unknown = null;

    const fakeTx = {
      order: {
        findUnique: async () => fakeOrder,
        update: async (args: { data: unknown }) => {
          orderUpdatedData = args.data;
          return {};
        },
      },
      userWallet: {
        findUnique: async () => fakeWallet,
        updateMany: async (args: unknown) => {
          walletDeductedArgs = args;
          return { count: 1 };
        },
      },
      walletTransaction: {
        create: async (args: unknown) => {
          txCreatedArgs = args;
          return { id: 'wtx_pay_001' };
        },
      },
      transaction: {
        upsert: async () => ({}),
      },
    } as unknown as TxClient;

    const res = await payOrderWithWallet(fakeTx, 'user_1', 'o_pay_ok');

    assert.equal(res.success, true);
    assert.equal(res.paidAmount, 180_000);
    assert.equal(res.newBalance, 120_000);
    assert.equal(res.transactionId, 'wtx_pay_001');

    assert.deepEqual(walletDeductedArgs, {
      where: {
        id: fakeWallet.id,
        balance: { gte: 180_000 },
      },
      data: {
        balance: { decrement: 180_000 },
      },
    });

    assert.deepEqual(orderUpdatedData, {
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
    });

    assert.deepEqual(txCreatedArgs, {
      data: {
        walletId: fakeWallet.id,
        amount: -180_000,
        type: 'PURCHASE_PAYMENT',
        orderId: fakeOrder.id,
        description: 'Thanh toán thành công đơn hàng DH200',
      },
    });
  });
});
