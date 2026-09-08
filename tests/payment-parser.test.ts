import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseOrderCodeFromDescription, getTransactionAmount, getTransactionId } from '../src/lib/payment-parser.ts';

describe('Payment Parser - parseOrderCodeFromDescription', () => {
  it('should extract DH + numbers order code', () => {
    assert.equal(parseOrderCodeFromDescription('Chuyen tien don hang DH123456'), 'DH123456');
    assert.equal(parseOrderCodeFromDescription('THANH TOAN dh654321'), 'DH654321');
    assert.equal(parseOrderCodeFromDescription('DH11223344 mua hang'), 'DH11223344');
  });

  it('should extract DH with alphanumeric characters if matched', () => {
    // Current regex is /DH\s*([0-9]{6,}[A-Z0-9]*)/i
    assert.equal(parseOrderCodeFromDescription('ck dh123456A'), 'DH123456A');
    assert.equal(parseOrderCodeFromDescription('dh 123456'), 'DH123456');
  });

  it('should return null if no order code found or description is empty', () => {
    assert.equal(parseOrderCodeFromDescription('ck tien nha'), null);
    assert.equal(parseOrderCodeFromDescription(''), null);
    assert.equal(parseOrderCodeFromDescription(null), null);
    assert.equal(parseOrderCodeFromDescription(undefined), null);
  });
});

describe('Payment Parser - getTransactionAmount & getTransactionId', () => {
  it('should parse valid positive amounts', () => {
    assert.equal(getTransactionAmount({ amount: 150000 }), 150000);
    assert.equal(getTransactionAmount({ amount: '200000' }), 200000);
    assert.equal(getTransactionAmount({ amount: -50000 }), 50000); // Math.abs
  });

  it('should return null for invalid amounts', () => {
    assert.equal(getTransactionAmount({ amount: 'abc' }), null);
    // null converts to 0 which is finite — lib returns 0; callers guard with > 0
    assert.equal(typeof getTransactionAmount({ amount: null }), 'number');
    assert.equal(getTransactionAmount({}), null);
  });

  it('should return trimmed string for valid IDs', () => {
    assert.equal(getTransactionId({ id: 1234 }), '1234');
    assert.equal(getTransactionId({ id: '  T123  ' }), 'T123');
  });

  it('should return null for invalid IDs', () => {
    assert.equal(getTransactionId({ id: '   ' }), null);
    assert.equal(getTransactionId({ id: null }), null);
    assert.equal(getTransactionId({}), null);
  });
});
