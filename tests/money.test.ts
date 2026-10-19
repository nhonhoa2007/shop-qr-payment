import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMoneyVnd,
  serializeMoneyVnd,
  addMoney,
  allocateProportionally,
} from '@shared/utils/money';
import type { MoneyVnd, MoneySnapshot } from '@shared/types/money';

test('parseMoneyVnd parses valid external decimal strings and safe integers', () => {
  assert.equal(parseMoneyVnd('2147483648', 'amount'), 2147483648n);
  assert.equal(parseMoneyVnd('0', 'amount'), 0n);
  assert.equal(parseMoneyVnd('+50000', 'amount'), 50000n);
  assert.equal(parseMoneyVnd(100_000, 'amount'), 100000n);
  assert.equal(parseMoneyVnd(3_000_000_000n, 'amount'), 3000000000n);
  assert.equal(parseMoneyVnd('9000000000000000', 'amount'), 9000000000000000n);
});

test('parseMoneyVnd rejects invalid, negative, decimal, exponent, or out-of-bounds input', () => {
  assert.throws(() => parseMoneyVnd('-1', 'amount'), /amount/);
  assert.throws(() => parseMoneyVnd('1.5', 'amount'), /amount/);
  assert.throws(() => parseMoneyVnd('1e6', 'amount'), /amount/);
  assert.throws(() => parseMoneyVnd('-0', 'amount'), /amount/);
  assert.throws(() => parseMoneyVnd('abc', 'amount'), /amount/);
  assert.throws(() => parseMoneyVnd('', 'amount'), /amount/);
  assert.throws(() => parseMoneyVnd('   ', 'amount'), /amount/);
  assert.throws(() => parseMoneyVnd(null, 'amount'), /amount/);
  assert.throws(() => parseMoneyVnd(undefined, 'amount'), /amount/);
  assert.throws(() => parseMoneyVnd({}, 'amount'), /amount/);
  assert.throws(() => parseMoneyVnd(-500, 'amount'), /amount/);
  assert.throws(() => parseMoneyVnd(12.34, 'amount'), /amount/);
  assert.throws(() => parseMoneyVnd('9000000000000001', 'amount'), /amount/);
  assert.throws(() => parseMoneyVnd(9000000000000001n, 'amount'), /amount/);
});

test('serializeMoneyVnd serializes trusted nonnegative bigint to MoneyVnd string', () => {
  assert.equal(serializeMoneyVnd(0n), '0');
  assert.equal(serializeMoneyVnd(2147483648n), '2147483648');
  assert.equal(serializeMoneyVnd(9007199254740992n), '9007199254740992');
  assert.equal(serializeMoneyVnd(10000000000000000n), '10000000000000000');
  assert.throws(() => serializeMoneyVnd(-1n));
});

test('addMoney adds bigints safely and enforces nonnegativity', () => {
  assert.equal(addMoney(), 0n);
  assert.equal(addMoney(10n, 20n, 30n), 60n);
  assert.equal(addMoney(0n, 5000000000n), 5000000000n);
  assert.throws(() => addMoney(-1n, 5n));
});

test('allocateProportionally divides total with stable input-index tie break and exact conservation', () => {
  assert.deepEqual(allocateProportionally(10n, [1n, 1n, 1n]), [4n, 3n, 3n]);
  assert.equal(
    allocateProportionally(10n, [1n, 1n, 1n]).reduce((a, b) => a + b, 0n),
    10n
  );

  assert.deepEqual(allocateProportionally(11n, [5n, 5n]), [6n, 5n]);
  assert.deepEqual(allocateProportionally(100n, [1n, 2n, 3n]), [17n, 33n, 50n]);
  assert.equal(
    allocateProportionally(100n, [1n, 2n, 3n]).reduce((a, b) => a + b, 0n),
    100n
  );

  assert.deepEqual(allocateProportionally(0n, [10n, 20n]), [0n, 0n]);
  assert.throws(() => allocateProportionally(10n, [0n, 0n]));
  assert.throws(() => allocateProportionally(-10n, [1n, 1n]));
  assert.throws(() => allocateProportionally(10n, [-1n, 1n]));
});

test('MoneySnapshot and MoneyVnd type contract', () => {
  const amount: MoneyVnd = serializeMoneyVnd(150000n);
  const snapshot: MoneySnapshot = {
    amount,
    currency: 'VND',
    revision: 'rev-2026-10-17',
  };
  assert.equal(snapshot.amount, '150000');
  assert.equal(snapshot.currency, 'VND');
  assert.equal(snapshot.revision, 'rev-2026-10-17');
});
