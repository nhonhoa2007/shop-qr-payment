import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  quotePartialRefund,
  executeRefundCase,
} from '@server/modules/wallet/refund-case.service';
import { refundOrderToWallet } from '@server/modules/wallet/wallet.service';
import type {
  RefundQuoteInput,
  ExecuteRefundInput,
} from '@server/modules/returns/refund-allocation';

describe('Partial Refund & Exact Allocation Integration', () => {
  function createRefundMockDb() {
    const orders = new Map<string, any>();
    const orderItems = new Map<string, any>();
    const refundCases = new Map<string, any>();
    const userWallets = new Map<string, any>();
    const walletTxs: any[] = [];
    const auditLogs: any[] = [];

    // Customer has wallet with balance 0
    userWallets.set('wal_cust1', {
      id: 'wal_cust1',
      userId: 'usr_cust1',
      balance: BigInt(0),
    });

    // Order: 2 items
    // Item 1: Laptop, qty 1, price 30,000,000
    // Item 2: Mouse, qty 2, price 1,000,000 each = 2,000,000
    // Subtotal: 32,000,000
    // Discount: 2,000,000 (voucher)
    // Shipping: 50,000
    // TotalAmount: 30,050,000
    orders.set('ord_paid', {
      id: 'ord_paid',
      orderCode: 'DH300001',
      userId: 'usr_cust1',
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      subtotal: BigInt(32_000_000),
      discountAmount: BigInt(2_000_000),
      shippingFee: BigInt(50_000),
      totalAmount: BigInt(30_050_000),
      completedAt: new Date('2026-03-01T10:00:00.000Z'),
    });

    orderItems.set('item_laptop', {
      id: 'item_laptop',
      orderId: 'ord_paid',
      productId: 'prod_laptop',
      productName: 'Dell XPS 15',
      quantity: 1,
      price: BigInt(30_000_000),
      returnedQuantity: 0,
    });

    orderItems.set('item_mouse', {
      id: 'item_mouse',
      orderId: 'ord_paid',
      productId: 'prod_mouse',
      productName: 'Logitech MX Master 3S',
      quantity: 2,
      price: BigInt(2_000_000), // 1,000,000 each
      returnedQuantity: 0,
    });

    const tx: any = {
      order: {
        findUnique: async ({ where }: any) => {
          if (where.id) return orders.get(where.id) ? { ...orders.get(where.id) } : null;
          return null;
        },
        update: async ({ where, data }: any) => {
          const ord = orders.get(where.id);
          if (!ord) throw new Error('Order not found');
          const updated = { ...ord, ...data };
          orders.set(where.id, updated);
          return updated;
        },
        updateMany: async ({ where, data }: any) => {
          const ord = orders.get(where.id);
          if (!ord) return { count: 0 };
          if (where.paymentStatus && ord.paymentStatus !== where.paymentStatus) return { count: 0 };
          const updated = { ...ord, ...data };
          orders.set(where.id, updated);
          return { count: 1 };
        },
      },
      orderItem: {
        findMany: async ({ where }: any) => {
          return Array.from(orderItems.values()).filter((i) => i.orderId === where.orderId);
        },
        findUnique: async ({ where }: any) => {
          return orderItems.get(where.id) ? { ...orderItems.get(where.id) } : null;
        },
      },
      refundCase: {
        create: async ({ data }: any) => {
          const id = data.id ?? `ref_${refundCases.size + 1}`;
          const rc = { id, createdAt: new Date(), ...data };
          refundCases.set(data.sourceKey ?? id, rc);
          return rc;
        },
        findUnique: async ({ where }: any) => {
          if (where.sourceKey) return refundCases.get(where.sourceKey) ? { ...refundCases.get(where.sourceKey) } : null;
          if (where.id) return refundCases.get(where.id) ? { ...refundCases.get(where.id) } : null;
          return null;
        },
        findMany: async ({ where }: any) => {
          return Array.from(refundCases.values()).filter((rc) => {
            if (where.orderId && rc.orderId !== where.orderId) return false;
            if (where.status && rc.status !== where.status) return false;
            return true;
          });
        },
        update: async ({ where, data }: any) => {
          const rc = Array.from(refundCases.values()).find((r) => r.id === where.id || r.sourceKey === where.sourceKey);
          if (!rc) throw new Error('RefundCase not found');
          const updated = { ...rc, ...data, updatedAt: new Date() };
          refundCases.set(rc.sourceKey, updated);
          return updated;
        },
      },
      userWallet: {
        findUnique: async ({ where }: any) => {
          if (where.userId) {
            return Array.from(userWallets.values()).find((w) => w.userId === where.userId) ?? null;
          }
          if (where.id) return userWallets.get(where.id) ?? null;
          return null;
        },
        update: async ({ where, data }: any) => {
          const wallet = userWallets.get(where.id);
          if (!wallet) throw new Error('Wallet not found');
          const nextBalance = data.balance?.increment
            ? wallet.balance + data.balance.increment
            : (data.balance ?? wallet.balance);
          const updated = { ...wallet, balance: nextBalance };
          userWallets.set(where.id, updated);
          return updated;
        },
      },
      walletTransaction: {
        create: async ({ data }: any) => {
          walletTxs.push(data);
          return data;
        },
      },
      adminAuditLog: {
        create: async ({ data }: any) => {
          auditLogs.push(data);
          return data;
        },
        findUnique: async () => null,
      },
    };

    return { tx, orders, orderItems, refundCases, userWallets, walletTxs, auditLogs };
  }

  describe('quotePartialRefund', () => {
    it('calculates allocated net refund accurately excluding shipping by default', async () => {
      const { tx } = createRefundMockDb();

      // Quote refunding 1 mouse (out of 2 purchased)
      // Gross subtotal = 32M, discount = 2M
      // Mouse gross = 2M (2/32 of 2M discount = 125,000 discount)
      // Mouse net for 2 = 1,875,000 VND -> 1 mouse net = 937,500 VND
      const quote = await quotePartialRefund(tx, {
        orderId: 'ord_paid',
        items: [{ orderItemId: 'item_mouse', quantity: 1 }],
      });

      assert.equal(quote.shippingRefund, BigInt(0));
      assert.equal(quote.itemsRefundAmount, BigInt(937_500));
      assert.equal(quote.totalRefundAmount, BigInt(937_500));
    });

    it('rejects shipping refund request if actor is not ADMIN', async () => {
      const { tx } = createRefundMockDb();

      await assert.rejects(
        () =>
          quotePartialRefund(tx, {
            orderId: 'ord_paid',
            items: [{ orderItemId: 'item_mouse', quantity: 1 }],
            includeShipping: true,
            actorRole: 'STAFF',
            storeFaultReason: 'Giao nhầm hàng',
          }),
        /only ADMIN can approve shipping fee refund/i
      );
    });

    it('rejects shipping refund request if storeFaultReason is missing', async () => {
      const { tx } = createRefundMockDb();

      await assert.rejects(
        () =>
          quotePartialRefund(tx, {
            orderId: 'ord_paid',
            items: [{ orderItemId: 'item_mouse', quantity: 1 }],
            includeShipping: true,
            actorRole: 'ADMIN',
            storeFaultReason: '', // missing
          }),
        /store fault reason is required to refund shipping fee/i
      );
    });

    it('allows shipping fee refund when approved by ADMIN with audit reason', async () => {
      const { tx } = createRefundMockDb();

      const quote = await quotePartialRefund(tx, {
        orderId: 'ord_paid',
        items: [{ orderItemId: 'item_mouse', quantity: 1 }],
        includeShipping: true,
        actorRole: 'ADMIN',
        storeFaultReason: 'Shop giao thiếu phụ kiện, lỗi do kho đóng gói',
      });

      assert.equal(quote.shippingRefund, BigInt(50_000));
      assert.equal(quote.totalRefundAmount, BigInt(937_500 + 50_000));
    });
  });

  describe('executeRefundCase & Idempotency', () => {
    it('executes partial refund to customer wallet and records transaction', async () => {
      const { tx, userWallets, walletTxs } = createRefundMockDb();

      const input: ExecuteRefundInput = {
        sourceKey: 'refund:test:001',
        orderId: 'ord_paid',
        items: [{ orderItemId: 'item_mouse', quantity: 1 }],
        reason: 'Khách trả 1 chuột',
        actorId: 'admin_1',
        actorRole: 'ADMIN',
      };

      const result = await executeRefundCase(tx, input);

      assert.equal(result.status, 'COMPLETED');
      assert.equal(result.amount, BigInt(937_500));

      // Customer wallet balance updated
      const wallet = userWallets.get('wal_cust1');
      assert.equal(wallet.balance, BigInt(937_500));

      // WalletTransaction recorded
      assert.equal(walletTxs.length, 1);
      assert.equal(walletTxs[0].type, 'REFUND');
      assert.equal(walletTxs[0].amount, BigInt(937_500));
    });

    it('replays identical sourceKey safely without double crediting wallet', async () => {
      const { tx, userWallets, walletTxs } = createRefundMockDb();

      const input: ExecuteRefundInput = {
        sourceKey: 'refund:idempotent:001',
        orderId: 'ord_paid',
        items: [{ orderItemId: 'item_mouse', quantity: 1 }],
        reason: 'Khách trả 1 chuột',
        actorId: 'admin_1',
        actorRole: 'ADMIN',
      };

      const first = await executeRefundCase(tx, input);
      const balanceAfterFirst = userWallets.get('wal_cust1').balance;
      const txCountAfterFirst = walletTxs.length;

      // Replay identical call
      const second = await executeRefundCase(tx, input);

      assert.equal(second.id, first.id);
      assert.equal(second.amount, first.amount);
      assert.equal(userWallets.get('wal_cust1').balance, balanceAfterFirst);
      assert.equal(walletTxs.length, txCountAfterFirst); // No duplicate credit
    });

    it('rejects duplicate sourceKey with conflicting payload', async () => {
      const { tx } = createRefundMockDb();

      await executeRefundCase(tx, {
        sourceKey: 'refund:conflict:001',
        orderId: 'ord_paid',
        items: [{ orderItemId: 'item_mouse', quantity: 1 }],
        reason: 'Khách trả 1 chuột',
        actorId: 'admin_1',
        actorRole: 'ADMIN',
      });

      // Different order or item with same sourceKey
      await assert.rejects(
        () =>
          executeRefundCase(tx, {
            sourceKey: 'refund:conflict:001',
            orderId: 'ord_paid',
            items: [{ orderItemId: 'item_laptop', quantity: 1 }], // conflicting item
            reason: 'Khách trả laptop',
            actorId: 'admin_1',
            actorRole: 'ADMIN',
          }),
        /operation key conflict/i
      );
    });

    it('enforces total order entitlement cap: cumulative refund cannot exceed totalAmount', async () => {
      const { tx } = createRefundMockDb();

      // First refund: Laptop net = 28,125,000
      await executeRefundCase(tx, {
        sourceKey: 'refund:cap:1',
        orderId: 'ord_paid',
        items: [{ orderItemId: 'item_laptop', quantity: 1 }],
        reason: 'Trả laptop',
        actorId: 'admin_1',
        actorRole: 'ADMIN',
      });

      // Second refund: 2 mice net = 1,875,000 + 50,000 shipping = 1,925,000
      // Total paid is 30,050,000. 28,125,000 + 1,925,000 = 30,050,000. Exactly hits cap!
      await executeRefundCase(tx, {
        sourceKey: 'refund:cap:2',
        orderId: 'ord_paid',
        items: [{ orderItemId: 'item_mouse', quantity: 2 }],
        includeShipping: true,
        storeFaultReason: 'Lỗi kho',
        reason: 'Trả chuột',
        actorId: 'admin_1',
        actorRole: 'ADMIN',
      });

      // Third refund: any additional amount must fail!
      await assert.rejects(
        () =>
          executeRefundCase(tx, {
            sourceKey: 'refund:cap:3',
            orderId: 'ord_paid',
            items: [{ orderItemId: 'item_mouse', quantity: 1 }],
            reason: 'Cố tình hoàn thêm',
            actorId: 'admin_1',
            actorRole: 'ADMIN',
          }),
        /exceeds cumulative paid amount|entitlement/i
      );
    });
  });

  describe('Whole-order refund after partial refund', () => {
    it('refunds only remaining unrefunded balance when whole order is cancelled/refunded', async () => {
      const { tx, userWallets, orders } = createRefundMockDb();

      // 1. Partial refund of 1 mouse: 937,500
      await executeRefundCase(tx, {
        sourceKey: 'refund:partial:first',
        orderId: 'ord_paid',
        items: [{ orderItemId: 'item_mouse', quantity: 1 }],
        reason: 'Hoàn 1 chuột',
        actorId: 'admin_1',
        actorRole: 'ADMIN',
      });

      assert.equal(userWallets.get('wal_cust1').balance, BigInt(937_500));

      // 2. Whole order cancellation & refund via refundOrderToWallet
      // Total paid was 30,050,000. Already refunded 937,500.
      // Expected remainder to refund is 30,050,000 - 937,500 = 29,112,500
      const res = await refundOrderToWallet(tx, 'ord_paid', 'Hủy toàn bộ đơn hàng sau đổi trả');

      assert.equal(res.success, true);
      assert.equal(userWallets.get('wal_cust1').balance, BigInt(30_050_000)); // Total refunded = 30,050,000 exactly!
      assert.equal(orders.get('ord_paid').paymentStatus, 'REFUNDED');
    });
  });
});
