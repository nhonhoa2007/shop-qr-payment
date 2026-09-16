import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useCartStore } from '../src/client/stores/cart-store.ts';

describe('Cart Store Multi-Variant Logic', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
  });

  it('should add base product without variant', () => {
    const store = useCartStore.getState();
    store.addItem({
      productId: 'prod_1',
      name: 'Áo thun basic',
      price: 150_000,
    });

    const state = useCartStore.getState();
    assert.equal(state.items.length, 1);
    assert.equal(state.items[0].productId, 'prod_1');
    assert.equal(state.items[0].variantId, null);
    assert.equal(state.items[0].quantity, 1);
    assert.equal(state.getTotalAmount(), 150_000);
    assert.equal(state.getTotalItems(), 1);
  });

  it('should treat different variants of the same product as separate cart items', () => {
    const store = useCartStore.getState();
    store.addItem({
      productId: 'prod_1',
      name: 'Áo thun basic',
      price: 150_000,
      variantId: 'var_m',
      variantTitle: 'Size M',
    });

    store.addItem({
      productId: 'prod_1',
      name: 'Áo thun basic',
      price: 160_000,
      variantId: 'var_l',
      variantTitle: 'Size L',
    });

    const state = useCartStore.getState();
    assert.equal(state.items.length, 2);
    assert.equal(state.items[0].variantId, 'var_m');
    assert.equal(state.items[0].quantity, 1);
    assert.equal(state.items[1].variantId, 'var_l');
    assert.equal(state.items[1].quantity, 1);
    assert.equal(state.getTotalAmount(), 310_000);
    assert.equal(state.getTotalItems(), 2);
  });

  it('should accumulate quantity when adding the exact same variant', () => {
    const store = useCartStore.getState();
    store.addItem(
      {
        productId: 'prod_1',
        name: 'Áo thun basic',
        price: 150_000,
        variantId: 'var_m',
        variantTitle: 'Size M',
      },
      2
    );

    store.addItem(
      {
        productId: 'prod_1',
        name: 'Áo thun basic',
        price: 150_000,
        variantId: 'var_m',
        variantTitle: 'Size M',
      },
      3
    );

    const state = useCartStore.getState();
    assert.equal(state.items.length, 1);
    assert.equal(state.items[0].quantity, 5);
    assert.equal(state.getTotalAmount(), 750_000);
  });

  it('should update quantity for a specific variant without mutating other variants', () => {
    const store = useCartStore.getState();
    store.addItem({
      productId: 'prod_1',
      name: 'Áo thun basic',
      price: 150_000,
      variantId: 'var_m',
      variantTitle: 'Size M',
    });

    store.addItem({
      productId: 'prod_1',
      name: 'Áo thun basic',
      price: 160_000,
      variantId: 'var_l',
      variantTitle: 'Size L',
    });

    useCartStore.getState().updateQuantity('prod_1', 4, 'var_m');

    const state = useCartStore.getState();
    const itemM = state.items.find((i) => i.variantId === 'var_m');
    const itemL = state.items.find((i) => i.variantId === 'var_l');

    assert.equal(itemM?.quantity, 4);
    assert.equal(itemL?.quantity, 1);
    assert.equal(state.getTotalAmount(), 150_000 * 4 + 160_000 * 1);
  });

  it('should remove a specific variant without removing other variants of the same product', () => {
    const store = useCartStore.getState();
    store.addItem({
      productId: 'prod_1',
      name: 'Áo thun basic',
      price: 150_000,
      variantId: 'var_m',
    });

    store.addItem({
      productId: 'prod_1',
      name: 'Áo thun basic',
      price: 160_000,
      variantId: 'var_l',
    });

    useCartStore.getState().removeItem('prod_1', 'var_m');

    const state = useCartStore.getState();
    assert.equal(state.items.length, 1);
    assert.equal(state.items[0].variantId, 'var_l');
    assert.equal(state.getTotalAmount(), 160_000);
  });

  it('should remove item when updateQuantity is called with zero', () => {
    const store = useCartStore.getState();
    store.addItem({
      productId: 'prod_1',
      name: 'Áo thun basic',
      price: 150_000,
      variantId: 'var_m',
    });

    useCartStore.getState().updateQuantity('prod_1', 0, 'var_m');

    const state = useCartStore.getState();
    assert.equal(state.items.length, 0);
  });
});
