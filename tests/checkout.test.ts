import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCheckoutTotals, FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING_FEE } from '@shared/utils/checkout';

describe('Checkout Calculation Logic', () => {
  it('should add standard shipping fee when subtotal is below threshold', () => {
    const totals = calculateCheckoutTotals(200_000);
    assert.equal(totals.subtotal, 200_000);
    assert.equal(totals.shippingFee, STANDARD_SHIPPING_FEE);
    assert.equal(totals.totalAmount, 200_000 + STANDARD_SHIPPING_FEE);
  });

  it('should apply free shipping when subtotal equals or exceeds threshold', () => {
    const totalsEqual = calculateCheckoutTotals(FREE_SHIPPING_THRESHOLD);
    assert.equal(totalsEqual.subtotal, FREE_SHIPPING_THRESHOLD);
    assert.equal(totalsEqual.shippingFee, 0);
    assert.equal(totalsEqual.totalAmount, FREE_SHIPPING_THRESHOLD);

    const totalsExceed = calculateCheckoutTotals(FREE_SHIPPING_THRESHOLD + 100_000);
    assert.equal(totalsExceed.shippingFee, 0);
    assert.equal(totalsExceed.totalAmount, FREE_SHIPPING_THRESHOLD + 100_000);
  });

  it('should handle zero and negative subtotal safely', () => {
    const totalsZero = calculateCheckoutTotals(0);
    assert.equal(totalsZero.subtotal, 0);
    assert.equal(totalsZero.shippingFee, STANDARD_SHIPPING_FEE);
    assert.equal(totalsZero.totalAmount, STANDARD_SHIPPING_FEE);

    const totalsNegative = calculateCheckoutTotals(-50_000);
    assert.equal(totalsNegative.subtotal, 0);
    assert.equal(totalsNegative.shippingFee, STANDARD_SHIPPING_FEE);
  });
});
describe('Checkout Add-on Accessory & Compatibility Revalidation', () => {
  const mockDb = {
    product: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (where.id === 'prod_laptop') {
          return { id: 'prod_laptop', name: 'Laptop', price: 20000000n, isActive: true };
        }
        if (where.id === 'prod_charger') {
          return { id: 'prod_charger', name: 'Charger', price: 500000n, isActive: true };
        }
        return null;
      },
    },
    productVariant: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (where.id === 'var_laptop') {
          return {
            id: 'var_laptop',
            productId: 'prod_laptop',
            price: 20000000n,
            isActive: true,
            product: { id: 'prod_laptop', name: 'Laptop', price: 20000000n, isActive: true, category: 'laptop', specs: null },
          };
        }
        if (where.id === 'var_charger') {
          return {
            id: 'var_charger',
            productId: 'prod_charger',
            price: 500000n,
            isActive: true,
            product: { id: 'prod_charger', name: 'Charger', price: 500000n, isActive: true, category: 'charger', specs: null },
          };
        }
        return null;
      },
    },
    compatibilityRule: {
      findMany: async () => [],
    },
  };

  it('rejects checkout with 409 Conflict when item price is stale', async () => {
    const { revalidateCartCompatibility } = await import(
      '../src/server/modules/compatibility/compatibility-cart.service.ts'
    );

    const items = [
      {
        productId: 'prod_laptop',
        variantId: 'var_laptop',
        quantity: 1,
        price: 18000000, // Stale! DB is 20000000
      },
    ];

    const result = await revalidateCartCompatibility(items, mockDb as any);
    assert.equal(result.valid, false);
    assert.equal(result.status, 409);
  });

  it('requires caveat acknowledgment when add-on accessory compatibility is UNKNOWN', async () => {
    const { revalidateCartCompatibility } = await import(
      '../src/server/modules/compatibility/compatibility-cart.service.ts'
    );

    const itemsWithoutCaveat = [
      {
        productId: 'prod_laptop',
        variantId: 'var_laptop',
        quantity: 1,
        price: 20000000,
      },
      {
        productId: 'prod_charger',
        variantId: 'var_charger',
        quantity: 1,
        price: 500000,
        isAddon: true,
        attachedToVariantId: 'var_laptop',
        caveatAcknowledged: false,
      },
    ];

    const res = await revalidateCartCompatibility(itemsWithoutCaveat, mockDb as any);
    assert.equal(res.valid, false);
    assert.equal(res.status, 422);

    const itemsWithCaveat = [
      { ...itemsWithoutCaveat[0] },
      { ...itemsWithoutCaveat[1], caveatAcknowledged: true },
    ];

    const resValid = await revalidateCartCompatibility(itemsWithCaveat, mockDb as any);
    assert.equal(resValid.valid, true);
    assert.equal(resValid.status, 200);
  });
});
describe('Checkout Payment Methods Invariant', () => {
  it('consistently declares the two supported payment channels', async () => {
    const fs = await import('node:fs');
    const checkoutSource = fs.readFileSync('src/client/components/checkout/CheckoutForm.tsx', 'utf-8');

    // UI header reflects exactly 2 channels
    assert.match(checkoutSource, /Chọn 1 trong 2 kênh/);
    assert.doesNotMatch(checkoutSource, /Chọn 1 trong 3 kênh/);

    // Channels are VietQR and Wallet
    assert.match(checkoutSource, /type PaymentMethodType = 'VIETQR' \| 'WALLET'/);
  });
});
