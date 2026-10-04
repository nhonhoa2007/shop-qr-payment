import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canCustomerCancelOrder,
  validateOrderTransition,
  isOrderStatus,
  isPaymentStatus, } from '@server/modules/orders/orders.fsm';
import {
  releaseOrderStock,
  type OrderStockItem,
} from '../src/server/modules/inventory/inventory.service.ts';
import { refundOrderToWallet } from '@server/modules/wallet/wallet.service';

type TxClient = Parameters<typeof releaseOrderStock>[0];

describe('Order Cancellation - FSM State & Permission Guard (Pillar 1 & 4)', () => {
  const currentCustomerId = 'cust_user_777';
  const otherCustomerId = 'cust_stranger_888';

  it('should validate status type guards correctly', () => {
    assert.equal(isOrderStatus('PENDING'), true);
    assert.equal(isOrderStatus('CANCELLED'), true);
    assert.equal(isOrderStatus('UNKNOWN_STATUS'), false);

    assert.equal(isPaymentStatus('UNPAID'), true);
    assert.equal(isPaymentStatus('PAID'), true);
    assert.equal(isPaymentStatus('REFUNDED'), true);
    assert.equal(isPaymentStatus('EXPIRED'), true);
    assert.equal(isPaymentStatus('INVALID_PAYMENT'), false);
  });

  it('canCustomerCancelOrder should strictly permit cancellation ONLY for owner and PENDING orders', () => {
    // 1. Owner + PENDING -> Allowed
    const validCancel = canCustomerCancelOrder(
      { status: 'PENDING', userId: currentCustomerId },
      currentCustomerId
    );
    assert.equal(validCancel.allowed, true);
    assert.equal(validCancel.reason, undefined);

    // 2. Stranger -> Rejected (403 forbidden)
    const strangerCancel = canCustomerCancelOrder(
      { status: 'PENDING', userId: otherCustomerId },
      currentCustomerId
    );
    assert.equal(strangerCancel.allowed, false);
    assert.match(strangerCancel.reason || '', /không có quyền/i);

    // 3. Guest order (null userId) -> Rejected
    const guestCancel = canCustomerCancelOrder(
      { status: 'PENDING', userId: null },
      currentCustomerId
    );
    assert.equal(guestCancel.allowed, false);
    assert.match(guestCancel.reason || '', /không có quyền/i);
  });

  it('canCustomerCancelOrder should block customer cancellation for non-PENDING stages', () => {
    const nonPendingStatuses = ['CONFIRMED', 'PROCESSING', 'SHIPPING', 'COMPLETED', 'CANCELLED'] as const;

    for (const status of nonPendingStatuses) {
      const check = canCustomerCancelOrder(
        { status, userId: currentCustomerId },
        currentCustomerId
      );
      assert.equal(check.allowed, false);
      assert.match(check.reason || '', /chờ xử lý \(PENDING\)/i);
    }
  });

  it('validateOrderTransition: CANCELLED must be an immutable terminal state', () => {
    const attemptedTransitions = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPING', 'COMPLETED'] as const;

    for (const nextStatus of attemptedTransitions) {
      const error = validateOrderTransition({
        currentStatus: 'CANCELLED',
        currentPaymentStatus: 'UNPAID',
        nextStatus,
      });
      assert.ok(error);
      assert.match(error, /không thể chuyển trạng thái đơn hàng đã hủy/i);
    }
  });

  it('validateOrderTransition: should enforce payment status constraints on shipping and completion', () => {
    // Unpaid cannot ship
    const errShip = validateOrderTransition({
      currentStatus: 'CONFIRMED',
      currentPaymentStatus: 'UNPAID',
      nextStatus: 'SHIPPING',
    });
    assert.match(errShip!, /đã thanh toán/i);

    // Unpaid cannot complete
    const errComplete = validateOrderTransition({
      currentStatus: 'CONFIRMED',
      currentPaymentStatus: 'UNPAID',
      nextStatus: 'COMPLETED',
    });
    assert.match(errComplete!, /đã thanh toán/i);

    // Valid transitions
    assert.equal(
      validateOrderTransition({
        currentStatus: 'PENDING',
        currentPaymentStatus: 'UNPAID',
        nextStatus: 'CANCELLED',
      }),
      null
    );

    assert.equal(
      validateOrderTransition({
        currentStatus: 'PENDING',
        currentPaymentStatus: 'PAID',
        nextStatus: 'CANCELLED',
      }),
      null
    );
  });
});

describe('Order Cancellation - Atomic Inventory Restitution (Pillar 2 & 3)', () => {
  it('releaseOrderStock should atomically increment base product stock when item has NO variant', async () => {
    const productIncrements: Array<{ id: string; quantity: number }> = [];

    const mockTx = {
      product: {
        update: async ({ where, data }: { where: { id: string }; data: { stock: { increment: number } } }) => {
          productIncrements.push({ id: where.id, quantity: data.stock.increment });
          return {};
        },
      },
      productVariant: {
        update: async () => {
          assert.fail('Should not update variant for base product');
        },
      },
    } as unknown as TxClient;

    const items: OrderStockItem[] = [
      { productId: 'prod_hat_01', quantity: 2 },
      { productId: 'prod_belt_02', quantity: 1 },
    ];

    await releaseOrderStock(mockTx, items);

    assert.equal(productIncrements.length, 2);
    assert.deepEqual(productIncrements[0], { id: 'prod_hat_01', quantity: 2 });
    assert.deepEqual(productIncrements[1], { id: 'prod_belt_02', quantity: 1 });
  });

  it('releaseOrderStock should atomically increment variant stock when item HAS variantId', async () => {
    const variantIncrements: Array<{ id: string; quantity: number }> = [];
    const productIncrements: Array<{ id: string; quantity: number }> = [];

    const mockTx = {
      productVariant: {
        update: async ({ where, data }: { where: { id: string }; data: { stock: { increment: number } } }) => {
          variantIncrements.push({ id: where.id, quantity: data.stock.increment });
          return {};
        },
      },
      product: {
        update: async ({ where, data }: { where: { id: string }; data: { stock: { increment: number } } }) => {
          productIncrements.push({ id: where.id, quantity: data.stock.increment });
          return {};
        },
      },
    } as unknown as TxClient;

    const items: OrderStockItem[] = [
      { productId: 'prod_shirt', variantId: 'var_shirt_red_m', quantity: 3 },
      { productId: 'prod_shirt', variantId: 'var_shirt_blue_l', quantity: 5 },
    ];

    await releaseOrderStock(mockTx, items);

    assert.equal(variantIncrements.length, 2);
    assert.deepEqual(variantIncrements[0], { id: 'var_shirt_red_m', quantity: 3 });
    assert.deepEqual(variantIncrements[1], { id: 'var_shirt_blue_l', quantity: 5 });
    // Stock sản phẩm gốc được đồng bộ hoàn đúng tổng số lượng biến thể đã hoàn
    assert.deepEqual(productIncrements, [
      { id: 'prod_shirt', quantity: 3 },
      { id: 'prod_shirt', quantity: 5 },
    ]);
  });

  it('releaseOrderStock should handle mixed batch of base products and variants accurately', async () => {
    const logs: string[] = [];

    const mockTx = {
      product: {
        update: async ({ where, data }: { where: { id: string }; data: { stock: { increment: number } } }) => {
          logs.push(`PROD:${where.id}:+${data.stock.increment}`);
          return {};
        },
      },
      productVariant: {
        update: async ({ where, data }: { where: { id: string }; data: { stock: { increment: number } } }) => {
          logs.push(`VAR:${where.id}:+${data.stock.increment}`);
          return {};
        },
      },
    } as unknown as TxClient;

    const mixedItems: OrderStockItem[] = [
      { productId: 'p1', variantId: null, quantity: 1 },
      { productId: 'p2', variantId: 'v20', quantity: 4 },
      { productId: 'p3', variantId: undefined, quantity: 2 },
      { productId: 'p4', variantId: 'v40', quantity: 10 },
    ];

    await releaseOrderStock(mockTx, mixedItems);

    // Item có biến thể hoàn cả kho ProductVariant lẫn stock Product gốc (đồng bộ)
    assert.deepEqual(logs, [
      'PROD:p1:+1',
      'VAR:v20:+4',
      'PROD:p2:+4',
      'PROD:p3:+2',
      'VAR:v40:+10',
      'PROD:p4:+10',
    ]);
  });
});

describe('Order Cancellation - Wallet Refund & Double-Refund Protection (Pillar 2 & 3)', () => {
  it('refundOrderToWallet should reject when order is not found', async () => {
    const mockTx = {
      order: {
        findUnique: async () => null,
      },
    } as unknown as TxClient;

    const result = await refundOrderToWallet(mockTx, 'non_existent_order');
    assert.equal(result.success, false);
    assert.match(result.error || '', /không tìm thấy/i);
  });

  it('refundOrderToWallet should reject when order is UNPAID (cannot refund unpaid orders)', async () => {
    const mockTx = {
      order: {
        findUnique: async () => ({
          id: 'ord_unpaid_1',
          paymentStatus: 'UNPAID',
          totalAmount: 150000,
        }),
      },
    } as unknown as TxClient;

    const result = await refundOrderToWallet(mockTx, 'ord_unpaid_1');
    assert.equal(result.success, false);
    assert.match(result.error || '', /đã thanh toán \(PAID\)/i);
  });

  it('refundOrderToWallet should reject when order is ALREADY REFUNDED', async () => {
    const mockTx = {
      order: {
        findUnique: async () => ({
          id: 'ord_already_refunded',
          paymentStatus: 'REFUNDED',
          totalAmount: 150000,
        }),
      },
    } as unknown as TxClient;

    const result = await refundOrderToWallet(mockTx, 'ord_already_refunded');
    assert.equal(result.success, false);
    assert.match(result.error || '', /đã được hoàn tiền trước đó/i);
  });

  it('refundOrderToWallet should refund 100% to member wallet, release inventory, and record REFUND transaction', async () => {
    let variantReleased = 0;
    let productReleased = 0;
    let walletCredited = 0;
    let txRecorded: Record<string, unknown> | null = null;
    let orderStatusUpdated: Record<string, unknown> | null = null;
    let atomicWhereCaptured: Record<string, unknown> | null = null;

    const mockTx = {
      order: {
        findUnique: async () => ({
          id: 'ord_paid_member',
          orderCode: 'DH_PAID_001',
          paymentStatus: 'PAID',
          totalAmount: 350000,
          userId: 'user_member_123',
          items: [
            { productId: 'prod_1', variantId: 'var_1', quantity: 2 },
            { productId: 'prod_2', variantId: null, quantity: 1 },
          ],
        }),
        updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          orderStatusUpdated = data;
          atomicWhereCaptured = where;
          // Atomic CAS successfully updated 1 row
          return { count: 1 };
        },
      },
      productVariant: {
        update: async () => {
          variantReleased++;
          return {};
        },
      },
      product: {
        update: async () => {
          productReleased++;
          return {};
        },
      },
      userWallet: {
        findUnique: async () => ({ id: 'wallet_123', userId: 'user_member_123', balance: 100000 }),
        create: async () => ({ id: 'wallet_123', userId: 'user_member_123', balance: 0 }),
        update: async ({ data }: { data: { balance: { increment: number } } }) => {
          walletCredited = data.balance.increment;
          return { id: 'wallet_123', balance: 450000 };
        },
      },
      walletTransaction: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          txRecorded = data;
          return { id: 'w_tx_001', ...data };
        },
      },
    } as unknown as TxClient;

    const result = await refundOrderToWallet(mockTx, 'ord_paid_member', 'Khách hàng hủy đơn PENDING');

    assert.equal(result.success, true);
    assert.equal(result.refundedAmount, 350000);
    assert.equal(result.newBalance, 450000);
    assert.equal(walletCredited, 350000);
    // 1 item có biến thể (var_1) + đồng bộ stock gốc prod_1 + 1 item gốc prod_2
    assert.equal(variantReleased, 1);
    assert.equal(productReleased, 2);
    assert.ok(atomicWhereCaptured);
    assert.deepEqual(orderStatusUpdated, {
      paymentStatus: 'REFUNDED',
      status: 'CANCELLED',
    });
    assert.ok(txRecorded);
    assert.equal((txRecorded as Record<string, unknown>).type, 'REFUND');
    assert.equal((txRecorded as Record<string, unknown>).amount, 350000);
    assert.deepEqual(atomicWhereCaptured, {
      id: 'ord_paid_member',
      paymentStatus: 'PAID',
    });
  });

  it('refundOrderToWallet should prevent Double-Refund race conditions via Atomic CAS (updateMany count !== 1)', async () => {
    let walletIncrementCalled = false;

    const mockTx = {
      order: {
        findUnique: async () => ({
          id: 'ord_race_cond',
          paymentStatus: 'PAID',
          totalAmount: 500000,
          userId: 'user_1',
          items: [],
        }),
        updateMany: async () => {
          // Simulate race condition: another concurrent process already changed paymentStatus to REFUNDED
          return { count: 0 };
        },
      },
      userWallet: {
        update: async () => {
          walletIncrementCalled = true;
          return {};
        },
      },
    } as unknown as TxClient;

    const result = await refundOrderToWallet(mockTx, 'ord_race_cond');

    assert.equal(result.success, false);
    assert.match(result.error || '', /đã được xử lý hoàn tiền hoặc không ở trạng thái hợp lệ/i);
    assert.equal(walletIncrementCalled, false); // Balance was strictly NOT modified!
  });

  it('refundOrderToWallet should handle guest order gracefully without wallet increment (isGuest: true)', async () => {
    let walletTouched = false;

    const mockTx = {
      order: {
        findUnique: async () => ({
          id: 'ord_guest_paid',
          orderCode: 'DH_GUEST_99',
          paymentStatus: 'PAID',
          totalAmount: 200000,
          userId: null, // Guest checkout!
          items: [{ productId: 'p1', quantity: 1 }],
        }),
        updateMany: async () => ({ count: 1 }),
      },
      product: { update: async () => ({}) },
      userWallet: {
        findUnique: async () => {
          walletTouched = true;
          return null;
        },
      },
    } as unknown as TxClient;

    const result = await refundOrderToWallet(mockTx, 'ord_guest_paid');

    assert.equal(result.success, true);
    assert.equal(result.isGuest, true);
    assert.equal(result.refundedAmount, 200000);
    assert.equal(walletTouched, false);
  });
});
