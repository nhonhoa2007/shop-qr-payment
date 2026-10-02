import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CartItem } from '@shared/types';

interface CartStore {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string | null) => void;
  clearCart: () => void;
  getTotalAmount: () => number;
  getTotalItems: () => number;
}

const dummyStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item, addQty = 1) =>
        set((state) => {
          const qty = Math.max(1, addQty);
          const targetVariantId = item.variantId || null;
          const existingIndex = state.items.findIndex(
            (i) => i.productId === item.productId && (i.variantId || null) === targetVariantId
          );
          if (existingIndex > -1) {
            const updated = [...state.items];
            updated[existingIndex] = {
              ...updated[existingIndex],
              ...item,
              variantId: targetVariantId,
              variantTitle: item.variantTitle || updated[existingIndex].variantTitle || null,
              quantity: updated[existingIndex].quantity + qty,
            };
            return { items: updated };
          }
          return {
            items: [
              ...state.items,
              {
                ...item,
                variantId: targetVariantId,
                variantTitle: item.variantTitle || null,
                quantity: qty,
              },
            ],
          };
        }),
      removeItem: (productId, variantId) =>
        set((state) => ({
          items: state.items.filter((i) => {
            if (i.productId !== productId) return true;
            if (variantId !== undefined) {
              return (i.variantId || null) !== (variantId || null);
            }
            return false;
          }),
        })),
      updateQuantity: (productId, quantity, variantId) =>
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter((i) => {
                if (i.productId !== productId) return true;
                if (variantId !== undefined) {
                  return (i.variantId || null) !== (variantId || null);
                }
                return false;
              }),
            };
          }
          return {
            items: state.items.map((i) => {
              const matches =
                i.productId === productId &&
                (variantId === undefined || (i.variantId || null) === (variantId || null));
              return matches ? { ...i, quantity } : i;
            }),
          };
        }),
      clearCart: () => set({ items: [] }),
      getTotalAmount: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      getTotalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
          ? window.localStorage
          : dummyStorage
      ),
    }
  )
);
