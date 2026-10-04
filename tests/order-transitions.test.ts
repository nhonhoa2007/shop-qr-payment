import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateOrderTransition,
  isOrderStatus,
  isPaymentStatus,
  canCustomerCancelOrder, } from '@server/modules/orders/orders.fsm';

describe('Order Transitions Validation', () => {
  it('should validate status type guards correctly', () => {
    assert.equal(isOrderStatus('PENDING'), true);
    assert.equal(isOrderStatus('COMPLETED'), true);
    assert.equal(isOrderStatus('INVALID_STATUS'), false);

    assert.equal(isPaymentStatus('UNPAID'), true);
    assert.equal(isPaymentStatus('PAID'), true);
    assert.equal(isPaymentStatus('EXPIRED'), true);
    assert.equal(isPaymentStatus('WRONG'), false);
  });

  it('should block modifying cancelled orders', () => {
    const error = validateOrderTransition({
      currentStatus: 'CANCELLED',
      currentPaymentStatus: 'UNPAID',
      nextStatus: 'PROCESSING',
    });
    assert.match(error!, /Không thể chuyển trạng thái đơn hàng đã hủy/);
  });

  it('should block marking expired payment as paid without override', () => {
    const error = validateOrderTransition({
      currentStatus: 'CANCELLED',
      currentPaymentStatus: 'EXPIRED',
      nextPaymentStatus: 'PAID',
    });
    assert.ok(error);
  });

  it('should block completing or shipping unpaid orders', () => {
    const errComplete = validateOrderTransition({
      currentStatus: 'CONFIRMED',
      currentPaymentStatus: 'UNPAID',
      nextStatus: 'COMPLETED',
    });
    assert.match(errComplete!, /đã thanh toán/);

    const errShip = validateOrderTransition({
      currentStatus: 'CONFIRMED',
      currentPaymentStatus: 'UNPAID',
      nextStatus: 'SHIPPING',
    });
    assert.match(errShip!, /đã thanh toán/);
  });

  it('should allow valid transitions', () => {
    const valid1 = validateOrderTransition({
      currentStatus: 'CONFIRMED',
      currentPaymentStatus: 'PAID',
      nextStatus: 'SHIPPING',
    });
    assert.equal(valid1, null);

    const valid2 = validateOrderTransition({
      currentStatus: 'SHIPPING',
      currentPaymentStatus: 'PAID',
      nextStatus: 'COMPLETED',
    });
    assert.equal(valid2, null);

    const cancelUnpaid = validateOrderTransition({
      currentStatus: 'PENDING',
      currentPaymentStatus: 'UNPAID',
      nextStatus: 'CANCELLED',
    });
    assert.equal(cancelUnpaid, null);

    const cancelPaid = validateOrderTransition({
      currentStatus: 'PENDING',
      currentPaymentStatus: 'PAID',
      nextStatus: 'CANCELLED',
    });
    assert.equal(cancelPaid, null);
  });
});

describe('Customer Order Cancellation Policy (canCustomerCancelOrder)', () => {
  const customerId = 'user_customer_123';
  const otherCustomerId = 'user_customer_456';

  it('should allow customer to cancel their own PENDING order', () => {
    const result = canCustomerCancelOrder(
      { status: 'PENDING', userId: customerId },
      customerId
    );
    assert.equal(result.allowed, true);
    assert.equal(result.reason, undefined);
  });

  it('should reject cancellation if order belongs to another customer', () => {
    const result = canCustomerCancelOrder(
      { status: 'PENDING', userId: otherCustomerId },
      customerId
    );
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /Không có quyền truy cập/);
  });

  it('should reject cancellation if order has no userId', () => {
    const result = canCustomerCancelOrder(
      { status: 'PENDING', userId: null },
      customerId
    );
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /Không có quyền truy cập/);
  });

  it('should reject cancellation when order is CONFIRMED', () => {
    const result = canCustomerCancelOrder(
      { status: 'CONFIRMED', userId: customerId },
      customerId
    );
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /PENDING/);
  });

  it('should reject cancellation when order is PROCESSING', () => {
    const result = canCustomerCancelOrder(
      { status: 'PROCESSING', userId: customerId },
      customerId
    );
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /PENDING/);
  });

  it('should reject cancellation when order is SHIPPING', () => {
    const result = canCustomerCancelOrder(
      { status: 'SHIPPING', userId: customerId },
      customerId
    );
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /PENDING/);
  });

  it('should reject cancellation when order is COMPLETED', () => {
    const result = canCustomerCancelOrder(
      { status: 'COMPLETED', userId: customerId },
      customerId
    );
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /PENDING/);
  });

  it('should reject cancellation when order is already CANCELLED', () => {
    const result = canCustomerCancelOrder(
      { status: 'CANCELLED', userId: customerId },
      customerId
    );
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /PENDING/);
  });
});

