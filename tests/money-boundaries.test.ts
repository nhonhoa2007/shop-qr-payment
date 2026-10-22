import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  serializeProductDto,
  serializeProductMutationResult,
  serializeCouponDto,
  serializeOrderDto,
  serializeWalletDto,
} from '@server/modules/money/money-serialization';
import { parseMoneyVnd } from '@shared/utils/money';

test('serializeProductDto converts BigInt prices to MoneyVnd decimal strings', () => {
  const rawProduct = {
    id: 'prod-1',
    name: 'High End Laptop',
    description: 'Specs',
    price: 35_000_000n,
    image: null,
    category: 'LAPTOP',
    stock: 10,
    isActive: true,
    createdAt: new Date('2026-10-17T00:00:00Z'),
    updatedAt: new Date('2026-10-17T00:00:00Z'),
    variants: [
      {
        id: 'var-1',
        productId: 'prod-1',
        sku: 'LAP-001',
        title: '32GB / 1TB',
        color: 'Silver',
        size: '16"',
        price: 42_000_000n,
        stock: 5,
        image: null,
        isActive: true,
        createdAt: new Date('2026-10-17T00:00:00Z'),
        updatedAt: new Date('2026-10-17T00:00:00Z'),
      },
    ],
  };

  const dto = serializeProductDto(rawProduct);
  assert.equal(typeof dto.price, 'string');
  assert.equal(dto.price, '35000000');
  assert.equal(typeof dto.variants?.[0].price, 'string');
  assert.equal(dto.variants?.[0].price, '42000000');
});

test('serializeProductMutationResult makes product deletion responses JSON-safe', () => {
  const result = {
    type: 'PRODUCT' as const,
    productId: 'prod-1',
    product: {
      id: 'prod-1',
      price: 35_000_000n,
      variants: [{ id: 'var-1', price: 42_000_000n }],
    },
  };

  assert.throws(() => JSON.stringify({ success: true, ...result }), /BigInt/);

  const serialized = serializeProductMutationResult(result);
  assert.doesNotThrow(() => JSON.stringify({ success: true, ...serialized }));
  assert.equal(serialized.product.price, '35000000');
  assert.equal(serialized.product.variants?.[0].price, '42000000');
});

test('serializeCouponDto converts BigInt money fields without changing percentage values', () => {
  const coupon = {
    id: 'coupon-1',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    fixedDiscountAmount: null,
    maxDiscount: 500_000n,
    minOrderAmount: 2_000_000n,
  };

  assert.throws(() => JSON.stringify(coupon), /BigInt/);

  const serialized = serializeCouponDto(coupon);
  assert.doesNotThrow(() => JSON.stringify(serialized));
  assert.equal(serialized.discountValue, 10);
  assert.equal(serialized.fixedDiscountAmount, null);
  assert.equal(serialized.maxDiscount, '500000');
  assert.equal(serialized.minOrderAmount, '2000000');
});

test('serializeOrderDto converts monetary fields to MoneyVnd decimal strings', () => {
  const rawOrder = {
    id: 'ord-1',
    orderCode: 'DH123456',
    customerName: 'Buyer',
    customerPhone: '0900000000',
    customerAddress: 'Address',
    subtotal: 50_000_000n,
    shippingFee: 50_000n,
    discountAmount: 2_000_000n,
    totalAmount: 48_050_000n,
    status: 'PENDING',
    paymentStatus: 'UNPAID',
    expiresAt: new Date('2026-10-17T01:00:00Z'),
    createdAt: new Date('2026-10-17T00:00:00Z'),
    updatedAt: new Date('2026-10-17T00:00:00Z'),
    items: [
      {
        id: 'item-1',
        productId: 'prod-1',
        quantity: 1,
        price: 50_000_000n,
        product: {
          id: 'prod-1',
          name: 'High End Laptop',
          price: 50_000_000n,
          description: null,
          image: null,
          category: 'LAPTOP',
          stock: 10,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ],
  };

  const dto = serializeOrderDto(rawOrder);
  assert.equal(typeof dto.subtotal, 'string');
  assert.equal(dto.subtotal, '50000000');
  assert.equal(typeof dto.shippingFee, 'string');
  assert.equal(dto.shippingFee, '50000');
  assert.equal(typeof dto.discountAmount, 'string');
  assert.equal(dto.discountAmount, '2000000');
  assert.equal(typeof dto.totalAmount, 'string');
  assert.equal(dto.totalAmount, '48050000');
  assert.equal(typeof dto.items[0].price, 'string');
  assert.equal(dto.items[0].price, '50000000');
});

test('serializeWalletDto converts balance and transactions to MoneyVnd decimal strings', () => {
  const rawWallet = {
    id: 'wal-1',
    userId: 'user-1',
    balance: 100_000_000n,
    createdAt: new Date('2026-10-17T00:00:00Z'),
    updatedAt: new Date('2026-10-17T00:00:00Z'),
    transactions: [
      {
        id: 'tx-1',
        walletId: 'wal-1',
        amount: 100_000_000n,
        type: 'TOPUP',
        orderId: null,
        description: 'Nạp ví',
        createdAt: new Date('2026-10-17T00:00:00Z'),
      },
    ],
  };

  const dto = serializeWalletDto(rawWallet);
  assert.equal(typeof dto.balance, 'string');
  assert.equal(dto.balance, '100000000');
  assert.equal(typeof dto.transactions?.[0].amount, 'string');
  assert.equal(dto.transactions?.[0].amount, '100000000');
});

test('quote comparison parses client decimal strings and compares with calculated bigint', () => {
  const quotedSubtotalStr = '10000000';
  const quotedShippingStr = '30000';
  const calculatedSubtotal = 10_000_000n;
  const calculatedShipping = 30_000n;

  const parsedSubtotal = parseMoneyVnd(quotedSubtotalStr, 'quotedSubtotal');
  const parsedShipping = parseMoneyVnd(quotedShippingStr, 'quotedShippingFee');

  assert.equal(parsedSubtotal === calculatedSubtotal, true);
  assert.equal(parsedShipping === calculatedShipping, true);
});

test('parseMoneyVnd rejects number input above safe integer boundary', () => {
  const unsafeNumber = 9007199254740993; // Number.MAX_SAFE_INTEGER + 2
  assert.throws(() => parseMoneyVnd(unsafeNumber, 'unsafeField'), /safe integer|unsafe/i);
});
