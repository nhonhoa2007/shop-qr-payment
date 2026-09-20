'use client';

import React, { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Bell, Plus, Menu } from 'lucide-react';

export interface AdminTopbarProps {
  onToggleMobileMenu: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string;
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

export function AdminTopbar({ onToggleMobileMenu }: AdminTopbarProps) {
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
    if (!searchQuery.trim()) return;
    const query = searchQuery.trim();
    // Intelligently route search based on query pattern
    if (/^DH|^\d{4,}/i.test(query)) {
      router.push(`/admin/orders?q=${encodeURIComponent(query)}`);
    } else {
      router.push(`/admin/products?search=${encodeURIComponent(query)}`);
    }
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
      return [
        { label: 'Admin', href: '/admin' },
        { label: 'Khách hàng & CSKH', href: '/admin/chat' },
        { label: 'Tin nhắn trực tuyến', current: true },
      ];
    }
    return [
      { label: 'Admin', href: '/admin' },
      { label: 'Quản trị', current: true },
    ];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 sticky top-0 z-20">
      {/* Left section: Hamburger button + Breadcrumbs + Search */}
      <div className="flex items-center gap-3 sm:gap-6 min-w-0">
        {/* Mobile menu trigger button */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition shrink-0"
          aria-label="Mở danh mục quản trị"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Dynamic Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-400 shrink-0">
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
        <form onSubmit={handleSearchSubmit} className="relative w-48 sm:w-64 md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm đơn hàng, mã QR, sản phẩm..."
            className="w-full pl-9 pr-3 py-1.5 rounded-full bg-slate-100 border-none text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5433eb]/30 transition"
          />
        </form>
      </div>

      {/* Right section: Realtime Status + Notification + Quick Action */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Pusher Realtime status pill */}
        <div
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors ${
            isOnline
              ? 'bg-emerald-50 border-emerald-200/60 text-emerald-700'
              : 'bg-rose-50 border-rose-200/60 text-rose-700'
          }`}
          title={isOnline ? 'Kết nối Pusher WebSocket đang hoạt động' : 'Đang ngắt kết nối mạng'}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="hidden lg:inline">Pusher Realtime:</span>
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        {/* Notification Bell */}
        <Link
          href="/notifications"
          className="relative p-2 rounded-full hover:bg-slate-100 text-slate-600 transition"
          title="Thông báo mới"
        >
          <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </Link>

        {/* Quick Action Button: + Tạo sản phẩm */}
        <Link
          href="/admin/products"
          className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full bg-[#5433eb] text-white text-xs font-bold shadow-sm shadow-[#5433eb]/30 hover:bg-[#4628cb] active:scale-95 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Tạo sản phẩm</span>
          <span className="sm:hidden">Tạo</span>
        </Link>
      </div>
    </header>
  );
}
