import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateOrderDiscount,
  type AllocationItem,
} from '@server/modules/returns/refund-allocation';

describe('Refund Allocation - Largest Remainder Method', () => {
  it('allocates zero discount cleanly across all items', () => {
    const items: AllocationItem[] = [
      { orderItemId: 'item_1', grossAmount: BigInt(100_000), quantity: 1 },
      { orderItemId: 'item_2', grossAmount: BigInt(200_000), quantity: 2 },
    ];

    const result = allocateOrderDiscount(items, BigInt(0));

    assert.equal(result.totalDiscount, BigInt(0));
    assert.equal(result.allocations.length, 2);
    assert.equal(result.allocations[0].allocatedDiscount, BigInt(0));
    assert.equal(result.allocations[0].netPaidAmount, BigInt(100_000));
    assert.equal(result.allocations[1].allocatedDiscount, BigInt(0));
    assert.equal(result.allocations[1].netPaidAmount, BigInt(200_000));
  });

  it('allocates discount with exact dong conservation when indivisible (Largest Remainder)', () => {
    // 3 items with equal gross (100,000 each = 300,000 subtotal)
    // Discount is 100,000 (100,000 / 3 = 33,333.333...)
    const items: AllocationItem[] = [
      { orderItemId: 'item_a', grossAmount: BigInt(100_000), quantity: 1 },
      { orderItemId: 'item_b', grossAmount: BigInt(100_000), quantity: 1 },
      { orderItemId: 'item_c', grossAmount: BigInt(100_000), quantity: 1 },
    ];
    const discount = BigInt(100_000);

    const result = allocateOrderDiscount(items, discount);

    // Sum of allocated discount must EXACTLY equal 100,000
    const sumDiscount = result.allocations.reduce((acc, curr) => acc + curr.allocatedDiscount, BigInt(0));
    assert.equal(sumDiscount, discount);

    // Sum of net paid amounts must EXACTLY equal 200,000 (300,000 - 100,000)
    const sumNet = result.allocations.reduce((acc, curr) => acc + curr.netPaidAmount, BigInt(0));
    assert.equal(sumNet, BigInt(200_000));

    // One item gets 33,334 and two items get 33,333 (or two get 33,334 and one 33,332)
    // Floor is 33,333. Remainder is 1 / 3 for each. Ties broken stably.
    const discounts = result.allocations.map((a) => a.allocatedDiscount);
    assert.ok(discounts.includes(BigInt(33_334)));
    assert.ok(discounts.includes(BigInt(33_333)));
  });

  it('allocates proportionally according to gross amount weights', () => {
    // item 1: 10,000,000 (1/3 of 30,000,000)
    // item 2: 20,000,000 (2/3 of 30,000,000)
    // Discount: 3,000,000
    const items: AllocationItem[] = [
      { orderItemId: 'item_1', grossAmount: BigInt(10_000_000), quantity: 1 },
      { orderItemId: 'item_2', grossAmount: BigInt(20_000_000), quantity: 1 },
    ];
    const discount = BigInt(3_000_000);

    const result = allocateOrderDiscount(items, discount);

    assert.equal(result.allocations[0].allocatedDiscount, BigInt(1_000_000));
    assert.equal(result.allocations[0].netPaidAmount, BigInt(9_000_000));
    assert.equal(result.allocations[1].allocatedDiscount, BigInt(2_000_000));
    assert.equal(result.allocations[1].netPaidAmount, BigInt(18_000_000));
  });

  it('preserves stability with large high-precision BigInts without precision loss', () => {
    const items: AllocationItem[] = [
      { orderItemId: 'item_laptop', grossAmount: BigInt(45_990_000), quantity: 1 },
      { orderItemId: 'item_mouse', grossAmount: BigInt(2_490_000), quantity: 1 },
      { orderItemId: 'item_keyboard', grossAmount: BigInt(4_190_000), quantity: 1 },
    ];
    const discount = BigInt(5_000_000);

    const result = allocateOrderDiscount(items, discount);

    const totalAllocated = result.allocations.reduce((sum, i) => sum + i.allocatedDiscount, BigInt(0));
    assert.equal(totalAllocated, discount);

    const totalGross = items.reduce((sum, i) => sum + i.grossAmount, BigInt(0));
    const totalNet = result.allocations.reduce((sum, i) => sum + i.netPaidAmount, BigInt(0));
    assert.equal(totalNet, totalGross - discount);
  });

  it('caps allocated discount so it never exceeds item gross amount', () => {
    const items: AllocationItem[] = [
      { orderItemId: 'item_cable', grossAmount: BigInt(50_000), quantity: 1 },
      { orderItemId: 'item_phone', grossAmount: BigInt(20_000_000), quantity: 1 },
    ];
    // Extreme discount equal to subtotal
    const totalGross = BigInt(20_050_000);
    const discount = totalGross;

    const result = allocateOrderDiscount(items, discount);

    assert.equal(result.allocations[0].allocatedDiscount, BigInt(50_000));
    assert.equal(result.allocations[0].netPaidAmount, BigInt(0));
    assert.equal(result.allocations[1].allocatedDiscount, BigInt(20_000_000));
    assert.equal(result.allocations[1].netPaidAmount, BigInt(0));
  });
});
