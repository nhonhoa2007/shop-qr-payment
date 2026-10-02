import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { toast } from 'sonner';

export interface WishlistProductInfo {
  id: string;
  name: string;
}

interface WishlistStore {
  wishlistIds: string[];
  isLoading: boolean;
  isInitialized: boolean;
  pendingId: string | null;
  fetchWishlist: (force?: boolean) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (product: WishlistProductInfo) => Promise<boolean>;
  addToWishlist: (productId: string) => void;
  removeFromWishlist: (productId: string) => void;
  setWishlistIds: (ids: string[]) => void;
  reset: () => void;
}

const dummyStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

let activeFetchPromise: Promise<void> | null = null;

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      wishlistIds: [],
      isLoading: false,
      isInitialized: false,
      pendingId: null,

      fetchWishlist: async (force = false) => {
        if (!force && get().isInitialized) return;
        if (activeFetchPromise) return activeFetchPromise;

        activeFetchPromise = (async () => {
          set({ isLoading: true });
          try {
            const res = await fetch('/api/wishlist');
            if (res.status === 401) {
              set({ wishlistIds: [], isInitialized: true, isLoading: false });
              return;
            }
            if (res.ok) {
              const data = await res.json();
              const rawItems = data.items || data.wishlist || [];
              const ids: string[] = rawItems
                .map((item: Record<string, unknown>) => {
                  const product = item.product as Record<string, unknown> | undefined;
                  return item.productId || product?.id || item.id;
                })
                .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
              const uniqueIds = Array.from(new Set(ids));
              set({ wishlistIds: uniqueIds, isInitialized: true, isLoading: false });
            } else {
              set({ isInitialized: true, isLoading: false });
            }
          } catch {
            set({ isInitialized: true, isLoading: false });
          } finally {
            activeFetchPromise = null;
          }
        })();

        return activeFetchPromise;
      },

      isWishlisted: (productId: string) => {
        return get().wishlistIds.includes(productId);
      },

      toggleWishlist: async (product: WishlistProductInfo) => {
        const { wishlistIds, pendingId } = get();
        if (pendingId === product.id) {
          return false;
        }

        const currentlyWishlisted = wishlistIds.includes(product.id);
        set({ pendingId: product.id });

        // Optimistic UI update
        if (currentlyWishlisted) {
          set({ wishlistIds: wishlistIds.filter((id) => id !== product.id) });
        } else {
          set({ wishlistIds: [...wishlistIds, product.id] });
        }

        try {
          if (currentlyWishlisted) {
            const res = await fetch(`/api/wishlist?productId=${encodeURIComponent(product.id)}`, {
              method: 'DELETE',
            });

            if (res.ok) {
              toast.info(`Đã xóa "${product.name}" khỏi danh sách yêu thích`);
              set({ pendingId: null });
              return true;
            }

            // Rollback on failure
            set((state) => ({
              wishlistIds: state.wishlistIds.includes(product.id)
                ? state.wishlistIds
                : [...state.wishlistIds, product.id],
              pendingId: null,
            }));

            if (res.status === 401) {
              toast.error('Vui lòng đăng nhập để lưu sản phẩm yêu thích');
            } else {
              toast.error('Không thể xóa khỏi danh sách yêu thích');
            }
            return false;
          } else {
            const res = await fetch('/api/wishlist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ productId: product.id }),
            });

            if (res.ok) {
              toast.success(`Đã thêm "${product.name}" vào danh sách yêu thích`);
              set({ pendingId: null });
              return true;
            }

            // Rollback on failure
            set((state) => ({
              wishlistIds: state.wishlistIds.filter((id) => id !== product.id),
              pendingId: null,
            }));

            if (res.status === 401) {
              toast.error('Vui lòng đăng nhập để lưu sản phẩm yêu thích');
            } else {
              toast.error('Không thể thêm vào danh sách yêu thích');
            }
            return false;
          }
        } catch {
          // Rollback on network/unexpected error
          set((state) => ({
            wishlistIds: currentlyWishlisted
              ? (state.wishlistIds.includes(product.id) ? state.wishlistIds : [...state.wishlistIds, product.id])
              : state.wishlistIds.filter((id) => id !== product.id),
            pendingId: null,
          }));
          toast.error('Có lỗi xảy ra, vui lòng thử lại');
          return false;
        }
      },

      addToWishlist: (productId: string) => {
        set((state) => ({
          wishlistIds: state.wishlistIds.includes(productId)
            ? state.wishlistIds
            : [...state.wishlistIds, productId],
        }));
      },

      removeFromWishlist: (productId: string) => {
        set((state) => ({
          wishlistIds: state.wishlistIds.filter((id) => id !== productId),
        }));
      },

      setWishlistIds: (ids: string[]) => {
        set({ wishlistIds: Array.from(new Set(ids)), isInitialized: true });
      },

      reset: () => {
        set({ wishlistIds: [], isInitialized: false, isLoading: false, pendingId: null });
      },
    }),
    {
      name: 'wishlist-storage',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
          ? window.localStorage
          : dummyStorage
      ),
      partialize: (state) => ({ wishlistIds: state.wishlistIds }),
    }
  )
);
