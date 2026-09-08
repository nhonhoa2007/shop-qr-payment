import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateReconcileInput, canReconcileOrder } from '../src/lib/reconciliation.ts';

describe('Manual Payment Reconciliation Logic', () => {
  it('should reject when both orderId and orderCode are missing', () => {
    const result = validateReconcileInput({ amount: 150000 });
    assert.strictEqual(result.valid, false);
    assert.match(result.error || '', /mã đơn hàng/i);
  });

  it('should reject when amount is zero or negative or not a number', () => {
    const zeroResult = validateReconcileInput({ orderCode: 'DH123456', amount: 0 });
    assert.strictEqual(zeroResult.valid, false);
    assert.match(zeroResult.error || '', /lớn hơn 0/i);

    const negativeResult = validateReconcileInput({ orderCode: 'DH123456', amount: -50000 });
    assert.strictEqual(negativeResult.valid, false);

    const nanResult = validateReconcileInput({ orderCode: 'DH123456', amount: 'abc' });
    assert.strictEqual(nanResult.valid, false);
  });

  it('should accept valid input and normalize orderCode uppercase and generate default bankTransId', () => {
    const result = validateReconcileInput({
      orderCode: 'dh999888',
      amount: '250000',
    });

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.data?.orderCode, 'DH999888');
    assert.strictEqual(result.data?.amount, 250000);
    assert.ok(result.data?.bankTransId.startsWith('RECON-'));
    assert.strictEqual(result.data?.bankName, 'Chuyển khoản đối soát thủ công');
  });

  it('should preserve provided bankTransId, bankName and note', () => {
    const result = validateReconcileInput({
      orderId: 'order_cuid_123',
      orderCode: 'DH112233',
      amount: 500000,
      bankTransId: 'FT260908123',
      bankName: 'Vietcombank',
      senderAccount: '0988776655',
      note: 'Khách chuyển nhầm cú pháp DH sang MH',
    });

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.data?.orderId, 'order_cuid_123');
    assert.strictEqual(result.data?.bankTransId, 'FT260908123');
    assert.strictEqual(result.data?.bankName, 'Vietcombank');
    assert.strictEqual(result.data?.senderAccount, '0988776655');
    assert.strictEqual(result.data?.note, 'Khách chuyển nhầm cú pháp DH sang MH');
  });

  it('should reject reconciliation if amount is less than order totalAmount', () => {
    const check = canReconcileOrder(
      { status: 'PENDING', paymentStatus: 'UNPAID', totalAmount: 200000 },
      150000
    );

    assert.strictEqual(check.allowed, false);
    assert.match(check.error || '', /nhỏ hơn giá trị đơn hàng/i);
  });

  it('should allow reconciliation with warning if order is already PAID', () => {
    const check = canReconcileOrder(
      { status: 'CONFIRMED', paymentStatus: 'PAID', totalAmount: 200000 },
      200000
    );

    assert.strictEqual(check.allowed, true);
    assert.ok(check.warning?.includes('PAID'));
  });

  it('should allow reconciliation with warning if order was CANCELLED', () => {
    const check = canReconcileOrder(
      { status: 'CANCELLED', paymentStatus: 'UNPAID', totalAmount: 200000 },
      200000
    );

    assert.strictEqual(check.allowed, true);
    assert.ok(check.warning?.includes('hủy'));
  });

  it('should allow valid reconciliation for normal pending order', () => {
    const check = canReconcileOrder(
      { status: 'PENDING', paymentStatus: 'UNPAID', totalAmount: 350000 },
      350000
    );

    assert.strictEqual(check.allowed, true);
    assert.strictEqual(check.error, undefined);
    assert.strictEqual(check.warning, undefined);
  });
});
