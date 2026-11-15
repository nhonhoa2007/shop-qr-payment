'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { CustomerCoupon } from '@shared/types/coupon';

interface CouponData {
  owner: string;
  revision: number;
  publicCoupons: CustomerCoupon[];
  savedCoupons: CustomerCoupon[];
  error: string;
}

export function useCoupons(includeSaved = false) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const owner = status === 'loading' ? 'loading' : session?.user?.id ?? 'guest';
  const [data, setData] = useState<CouponData | null>(null);
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState<{ owner: string; id: string } | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    const controller = new AbortController();
    const read = async (url: string): Promise<CustomerCoupon[]> => {
      const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Không thể tải voucher');
      return result.coupons;
    };
    Promise.all([
      read('/api/coupons'),
      includeSaved && session?.user?.id ? read('/api/coupons/saved') : Promise.resolve([]),
    ]).then(([publicCoupons, savedCoupons]) => {
      if (!controller.signal.aborted) setData({ owner, revision, publicCoupons, savedCoupons, error: '' });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setData({ owner, revision, publicCoupons: [], savedCoupons: [], error: error instanceof Error ? error.message : 'Không thể tải voucher' });
    });
    return () => controller.abort();
  }, [owner, status, session?.user?.id, includeSaved, revision]);

  const refresh = useCallback(() => setRevision(n => n + 1), []);
  const toggleSave = async (coupon: CustomerCoupon) => {
    if (!session?.user?.id) {
      router.push('/login?callbackUrl=/coupons');
      return;
    }
    if (pending) return;
    setPending({ owner, id: coupon.id });
    try {
      const res = await fetch('/api/coupons/saved', {
        method: coupon.saved ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponId: coupon.id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Không thể lưu voucher');
      toast.success(coupon.saved ? 'Đã bỏ lưu voucher' : 'Đã lưu vào Voucher của tôi');
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu voucher');
    } finally { setPending(null); }
  };

  // A session change hides the preceding account's data before the next fetch.
  const visible = data?.owner === owner ? data : null;
  const publicCoupons = visible?.publicCoupons ?? [];
  const savedCoupons = visible?.savedCoupons ?? [];
  const coupons = [...new Map([...publicCoupons, ...savedCoupons].map(c => [c.id, c])).values()];
  return {
    publicCoupons, savedCoupons, coupons, toggleSave, refresh,
    loading: !visible || visible.revision !== revision,
    error: visible?.error ?? '',
    pendingId: pending?.owner === owner ? pending.id : null,
    signedIn: Boolean(session?.user?.id),
  };
}
