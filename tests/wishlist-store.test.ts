import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { useWishlistStore } from '../src/client/stores/wishlist-store.ts';

describe('Wishlist Store & Quick Wishlist Logic', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    useWishlistStore.getState().reset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should initialize with empty wishlistIds and not loading', () => {
    const state = useWishlistStore.getState();
    assert.deepEqual(state.wishlistIds, []);
    assert.equal(state.isLoading, false);
    assert.equal(state.isInitialized, false);
    assert.equal(state.pendingId, null);
  });

  it('should check isWishlisted accurately', () => {
    useWishlistStore.getState().setWishlistIds(['prod_1', 'prod_2']);
    const store = useWishlistStore.getState();
    assert.equal(store.isWishlisted('prod_1'), true);
    assert.equal(store.isWishlisted('prod_2'), true);
    assert.equal(store.isWishlisted('prod_3'), false);
  });

  it('should fetch wishlist and populate wishlistIds from data.items or data.wishlist', async () => {
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/wishlist')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              { productId: 'prod_10' },
              { productId: 'prod_20' },
              { product: { id: 'prod_30' } },
            ],
          }),
        } as unknown as Response;
      }
      return { ok: false, status: 404 } as Response;
    };

    await useWishlistStore.getState().fetchWishlist(true);

    const state = useWishlistStore.getState();
    assert.equal(state.isInitialized, true);
    assert.equal(state.isLoading, false);
    assert.equal(state.wishlistIds.length, 3);
    assert.equal(state.isWishlisted('prod_10'), true);
    assert.equal(state.isWishlisted('prod_20'), true);
    assert.equal(state.isWishlisted('prod_30'), true);
  });

  it('should gracefully handle 401 Unauthorized during fetchWishlist without crashing', async () => {
    useWishlistStore.getState().setWishlistIds(['stale_prod']);

    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      } as unknown as Response;
    };

    await useWishlistStore.getState().fetchWishlist(true);

    const state = useWishlistStore.getState();
    assert.equal(state.isInitialized, true);
    assert.equal(state.isLoading, false);
    assert.deepEqual(state.wishlistIds, []);
  });

  it('should optimistically add to wishlist on toggle and commit on 200 OK', async () => {
    let postCalled = false;
    let postedBody = '';

    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/wishlist') && init?.method === 'POST') {
        postCalled = true;
        postedBody = init.body as string;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, wishlisted: true }),
        } as unknown as Response;
      }
      return { ok: false, status: 500 } as Response;
    };

    const promise = useWishlistStore.getState().toggleWishlist({
      id: 'prod_new',
      name: 'Sản phẩm mới',
    });

    // Verify optimistic update happened immediately
    assert.equal(useWishlistStore.getState().isWishlisted('prod_new'), true);
    assert.equal(useWishlistStore.getState().pendingId, 'prod_new');

    const result = await promise;
    assert.equal(result, true);
    assert.equal(postCalled, true);
    assert.deepEqual(JSON.parse(postedBody), { productId: 'prod_new' });
    assert.equal(useWishlistStore.getState().isWishlisted('prod_new'), true);
    assert.equal(useWishlistStore.getState().pendingId, null);
  });

  it('should optimistically remove from wishlist on toggle and commit on DELETE 200 OK', async () => {
    useWishlistStore.getState().setWishlistIds(['prod_fav']);
    assert.equal(useWishlistStore.getState().isWishlisted('prod_fav'), true);

    let deleteCalled = false;
    let deleteUrl = '';

    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/wishlist') && init?.method === 'DELETE') {
        deleteCalled = true;
        deleteUrl = urlStr;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, wishlisted: false }),
        } as unknown as Response;
      }
      return { ok: false, status: 500 } as Response;
    };

    const promise = useWishlistStore.getState().toggleWishlist({
      id: 'prod_fav',
      name: 'Sản phẩm yêu thích',
    });

    // Verify optimistic removal happened immediately
    assert.equal(useWishlistStore.getState().isWishlisted('prod_fav'), false);

    const result = await promise;
    assert.equal(result, true);
    assert.equal(deleteCalled, true);
    assert.equal(deleteUrl.includes('productId=prod_fav'), true);
    assert.equal(useWishlistStore.getState().isWishlisted('prod_fav'), false);
    assert.equal(useWishlistStore.getState().pendingId, null);
  });

  it('should rollback optimistic addition when API fails with 401 Unauthorized', async () => {
    assert.equal(useWishlistStore.getState().isWishlisted('prod_auth'), false);

    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      } as unknown as Response;
    };

    const result = await useWishlistStore.getState().toggleWishlist({
      id: 'prod_auth',
      name: 'Cần đăng nhập',
    });

    assert.equal(result, false);
    // Rolled back to not wishlisted
    assert.equal(useWishlistStore.getState().isWishlisted('prod_auth'), false);
    assert.equal(useWishlistStore.getState().pendingId, null);
  });

  it('should rollback optimistic removal when API fails with 500 Server Error', async () => {
    useWishlistStore.getState().setWishlistIds(['prod_fail']);
    assert.equal(useWishlistStore.getState().isWishlisted('prod_fail'), true);

    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: 'Lỗi server' }),
      } as unknown as Response;
    };

    const result = await useWishlistStore.getState().toggleWishlist({
      id: 'prod_fail',
      name: 'Sản phẩm lỗi',
    });

    assert.equal(result, false);
    // Rolled back to wishlisted
    assert.equal(useWishlistStore.getState().isWishlisted('prod_fail'), true);
    assert.equal(useWishlistStore.getState().pendingId, null);
  });

  it('should rollback optimistic addition when network throws an exception', async () => {
    globalThis.fetch = async () => {
      throw new Error('Network offline');
    };

    const result = await useWishlistStore.getState().toggleWishlist({
      id: 'prod_net',
      name: 'Mất mạng',
    });

    assert.equal(result, false);
    assert.equal(useWishlistStore.getState().isWishlisted('prod_net'), false);
    assert.equal(useWishlistStore.getState().pendingId, null);
  });

  it('should prevent double click / concurrent toggle requests on the same product', async () => {
    let resolveFirstFetch: ((value: Response) => void) | null = null;
    let callCount = 0;

    globalThis.fetch = async () => {
      callCount++;
      return new Promise<Response>((resolve) => {
        resolveFirstFetch = resolve;
      });
    };

    const firstPromise = useWishlistStore.getState().toggleWishlist({
      id: 'prod_double',
      name: 'Double Click',
    });

    assert.equal(useWishlistStore.getState().pendingId, 'prod_double');

    // Second click while first is in-flight
    const secondResult = await useWishlistStore.getState().toggleWishlist({
      id: 'prod_double',
      name: 'Double Click',
    });

    assert.equal(secondResult, false);
    assert.equal(callCount, 1);

    // Resolve first
    if (resolveFirstFetch) {
      (resolveFirstFetch as (res: unknown) => void)({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
    }

    await firstPromise;
    assert.equal(useWishlistStore.getState().pendingId, null);
    assert.equal(useWishlistStore.getState().isWishlisted('prod_double'), true);
  });

  it('should support manual helper methods addToWishlist and removeFromWishlist', () => {
    const store = useWishlistStore.getState();
    store.addToWishlist('prod_manual');
    assert.equal(useWishlistStore.getState().isWishlisted('prod_manual'), true);

    // Adding duplicate does not add duplicate ID
    store.addToWishlist('prod_manual');
    assert.equal(useWishlistStore.getState().wishlistIds.filter((id) => id === 'prod_manual').length, 1);

    store.removeFromWishlist('prod_manual');
    assert.equal(useWishlistStore.getState().isWishlisted('prod_manual'), false);
  });
});
