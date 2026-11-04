'use client';

import React, { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Bell, Menu } from 'lucide-react';
import { Dialog } from '@animate-ui/react/primitives/radix-ui/dialog';
import { canAccessAdminPage } from '@shared/admin-page-access';
import { getAdminSearchDestination } from '@client/lib/admin-search';

export interface AdminTopbarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string;
    permissions?: string[];
  };
}

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export function AdminTopbar({ user }: AdminTopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  // Monitor network status safely without hydration mismatch or cascading renders
  const isOnline = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const destination = getAdminSearchDestination(searchQuery, user ?? {});
    if (destination) router.push(destination);
  };

  const getBreadcrumbs = () => {
    if (pathname === '/admin') {
      return [
        { label: 'Admin', href: '/admin' },
        { label: 'Bảng điều khiển', current: true },
      ];
    }
    if (pathname.startsWith('/admin/orders')) {
      return [
        { label: 'Admin', href: '/admin' },
        { label: 'Bán hàng & Kho', href: '/admin/orders' },
        { label: 'Đơn hàng', current: true },
      ];
    }
    if (pathname.startsWith('/admin/shipments')) {
      return [
        { label: 'Admin', href: '/admin' },
        { label: 'Bán hàng & Kho', href: '/admin/shipments' },
        { label: 'Vận đơn GHN', current: true },
      ];
    }
    if (pathname.startsWith('/admin/products')) {
      return [
        { label: 'Admin', href: '/admin' },
        { label: 'Bán hàng & Kho', href: '/admin/products' },
        { label: 'Sản phẩm & Biến thể', current: true },
      ];
    }
    if (pathname.startsWith('/admin/transactions')) {
      return [
        { label: 'Admin', href: '/admin' },
        { label: 'Tài chính & Ưu đãi', href: '/admin/transactions' },
        { label: 'Đối soát VietQR', current: true },
      ];
    }
    if (pathname.startsWith('/admin/coupons')) {
      return [
        { label: 'Admin', href: '/admin' },
        { label: 'Tài chính & Ưu đãi', href: '/admin/coupons' },
        { label: 'Mã giảm giá (Coupon)', current: true },
      ];
    }
    if (pathname.startsWith('/admin/customers')) {
      return [
        { label: 'Admin', href: '/admin' },
        { label: 'Khách hàng & CSKH', href: '/admin/customers' },
        { label: 'Khách hàng & RBAC', current: true },
      ];
    }
    if (pathname.startsWith('/admin/reviews')) {
      return [
        { label: 'Admin', href: '/admin' },
        { label: 'Khách hàng & CSKH', href: '/admin/reviews' },
        { label: 'Đánh giá sản phẩm', current: true },
      ];
    }
    if (pathname.startsWith('/admin/chat')) {
      const isDetail = pathname !== '/admin/chat';
      return [
        { label: 'Admin', href: '/admin' },
        { label: 'Khách hàng & CSKH', href: '/admin/chat' },
        { label: isDetail ? 'Chi tiết hội thoại' : 'Tin nhắn trực tuyến', current: true },
      ];
    }
    return [
      { label: 'Admin', href: '/admin' },
      { label: 'Quản trị', current: true },
    ];
  };

  const breadcrumbs = getBreadcrumbs();
  const canSearchOrders = canAccessAdminPage(user, '/admin/orders');
  const canSearchProducts = canAccessAdminPage(user, '/admin/products');

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
      {/* Left section: Hamburger button + Breadcrumbs + Search */}
      <div className="flex min-w-0 items-center gap-3 sm:gap-5">
        {/* Mobile menu trigger button */}
        <Dialog.Trigger asChild>
          <button type="button" className="shrink-0 rounded-md p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-slate-700 lg:hidden" aria-label="Mở danh mục quản trị">
            <Menu className="size-5" />
          </button>
        </Dialog.Trigger>

        {/* Dynamic Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="hidden shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 sm:flex">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.label}>
              {idx > 0 && <span className="text-slate-300">/</span>}
              {crumb.current ? (
                <span className="text-slate-900 font-bold tracking-tight truncate">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href || '/admin'}
                  className="hover:text-slate-700 transition truncate"
                >
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Global Search Input */}
        {(canSearchOrders || canSearchProducts) && <form onSubmit={handleSearchSubmit} className="relative w-28 sm:w-48 md:w-64 lg:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={canSearchOrders && canSearchProducts ? 'Tìm đơn hàng hoặc sản phẩm...' : canSearchOrders ? 'Tìm đơn hàng...' : 'Tìm sản phẩm...'}
            aria-label="Tìm kiếm quản trị"
            className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-500 focus:border-slate-400 focus:outline-none"
          />
        </form>}
      </div>

      {/* Right section: Realtime Status + Notification + Quick Action */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {/* Pusher Realtime status pill */}
        <div
          className="hidden items-center gap-1.5 text-xs text-slate-600 md:flex"
          title={isOnline ? 'Thiết bị đang có kết nối mạng' : 'Thiết bị đang ngoại tuyến'}
        >
          <span className={`size-1.5 rounded-full ${isOnline ? 'bg-emerald-600' : 'bg-rose-600'}`} />
          <span>{isOnline ? 'Có mạng' : 'Ngoại tuyến'}</span>
        </div>

        {/* Notification Bell */}
        <Link
          href="/notifications"
          className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100"
          title="Thông báo mới"
        >
          <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
        </Link>

      </div>
    </header>
  );
}
