'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useCartStore } from '@client/stores/cart-store';
import { useWishlistStore } from '@client/stores/wishlist-store';
import { NotificationBell } from './NotificationBell';
import { useNotifications } from '@client/hooks/useNotifications';
import { useHydrated } from '@client/hooks/useHydrated';
import { useRouter, usePathname } from 'next/navigation';
import {
  ShoppingCart,
  Menu,
  X,
  Package,
  MessageSquare,
  ShieldAlert,
  LogOut,
  User,
  Search,
  Heart,
  ArrowRight,
  Wallet,
} from 'lucide-react';

export function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const getTotalItems = useCartStore((s) => s.getTotalItems);
  const rawWishlistCount = useWishlistStore((s) => s.wishlistIds.length);
  const hydrated = useHydrated();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  useNotifications(session?.user?.id);

  const cartCount = hydrated ? getTotalItems() : 0;
  const wishlistCount = hydrated ? rawWishlistCount : 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <header className="bg-white sticky top-0 z-50 border-b border-faint-border/60">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-full text-ink-black hover:bg-canvas-mist transition"
              aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link href="/" className="flex items-center gap-1">
              <span className="font-semibold text-xl tracking-tight-display text-ink-black">shop</span>
              <span className="w-1.5 h-1.5 rounded-full bg-shop-violet mt-2" />
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/"
                className="px-3 py-1.5 text-sm tracking-tight-body text-muted-gray hover:text-ink-black transition rounded-full hover:bg-canvas-mist"
              >
                Khám phá
              </Link>
              {session && (
                <>
                  <Link
                    href="/orders"
                    className="px-3 py-1.5 text-sm tracking-tight-body text-muted-gray hover:text-ink-black transition rounded-full hover:bg-canvas-mist"
                  >
                    Đơn hàng
                  </Link>
                  <Link
                    href="/wishlist"
                    className="px-3 py-1.5 text-sm tracking-tight-body text-muted-gray hover:text-ink-black transition rounded-full hover:bg-canvas-mist"
                  >
                    Yêu thích
                  </Link>
                  <Link
                    href="/wallet"
                    className="px-3 py-1.5 text-sm tracking-tight-body text-muted-gray hover:text-ink-black transition rounded-full hover:bg-canvas-mist flex items-center gap-1"
                  >
                    <Wallet className="w-3.5 h-3.5 text-shop-violet" />
                    <span>Ví Shop</span>
                  </Link>
                  <Link
                    href="/chat"
                    className="px-3 py-1.5 text-sm tracking-tight-body text-muted-gray hover:text-ink-black transition rounded-full hover:bg-canvas-mist"
                  >
                    Chat
                  </Link>
                </>
              )}
              {session?.user?.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className="px-3 py-1.5 text-sm tracking-tight-body text-muted-gray hover:text-ink-black transition rounded-full hover:bg-canvas-mist flex items-center gap-1"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-shop-violet" />
                  Admin
                </Link>
              )}
            </nav>
          </div>

          {/* Center: Search — ẩn trên trang chủ vì hero đã có ô tìm kiếm lớn */}
          <form
            onSubmit={handleSearch}
            className={`flex-1 max-w-md mx-4 ${pathname === '/' ? 'hidden' : 'hidden sm:block'}`}
          >
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Bạn đang tìm gì hôm nay?"
                className="w-full pl-11 pr-12 py-2.5 rounded-full border border-ink-black/10 bg-white text-sm tracking-tight-body text-ink-black placeholder:text-muted-gray focus:outline-none focus:border-shop-violet/40 transition"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-shop-violet text-white flex items-center justify-center hover:bg-shop-violet-deep transition shadow-violet"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">
            {session && (
              <Link
                href="/wishlist"
                className="relative p-2.5 rounded-full hover:bg-canvas-mist transition text-ink-black"
                aria-label="Yêu thích"
              >
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-semibold text-white bg-rose-500 rounded-full px-1">
                    {wishlistCount}
                  </span>
                )}
              </Link>
            )}

            <Link
              href="/cart"
              className="relative p-2.5 rounded-full hover:bg-canvas-mist transition text-ink-black"
              aria-label="Giỏ hàng"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-semibold text-white bg-shop-violet rounded-full px-1">
                  {cartCount}
                </span>
              )}
            </Link>

            {session && <NotificationBell />}

            {session ? (
              <div className="flex items-center gap-1 ml-1">
                <div className="hidden sm:flex items-center gap-1.5 text-sm tracking-tight-body text-ink-black bg-canvas-mist px-3 py-1.5 rounded-full">
                  <User className="w-3.5 h-3.5 text-muted-gray" />
                  <span>{session.user?.name}</span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="p-2.5 text-muted-gray hover:text-ink-black hover:bg-canvas-mist rounded-full transition"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2 ml-1">
                <Link
                  href="/login"
                  className="text-sm tracking-tight-body text-muted-gray hover:text-ink-black px-3 py-1.5 rounded-full hover:bg-canvas-mist transition"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/register"
                  className="text-sm tracking-tight-body bg-ink-black text-white px-4 py-2 rounded-full hover:bg-slate-ink transition"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile navigation menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-menu"
          className="md:hidden border-t border-faint-border bg-white px-4 pt-3 pb-4 space-y-1"
        >
          {/* Mobile search — ẩn trên trang chủ vì hero đã có ô tìm kiếm */}
          {pathname !== '/' && (
            <form onSubmit={handleSearch} className="sm:hidden mb-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm sản phẩm..."
                  className="w-full pl-11 pr-12 py-2.5 rounded-full border border-ink-black/10 bg-white text-sm tracking-tight-body placeholder:text-muted-gray focus:outline-none focus:border-shop-violet/40 transition"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-shop-violet text-white flex items-center justify-center shadow-violet"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* Auth actions cho khách chưa đăng nhập */}
          {!session && (
            <div className="flex flex-col gap-2 pb-3 mb-1 border-b border-faint-border">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center px-3 py-3 rounded-full border border-faint-border text-ink-black text-sm font-medium tracking-tight-body hover:bg-canvas-mist transition"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center px-3 py-3 rounded-full bg-ink-black text-white text-sm font-medium tracking-tight-body hover:bg-slate-ink transition"
              >
                Đăng ký
              </Link>
            </div>
          )}

          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-[20px] text-ink-black hover:bg-canvas-mist text-sm tracking-tight-body"
          >
            <Search className="w-4 h-4 text-muted-gray" />
            <span>Khám phá</span>
          </Link>
          {session && (
            <>
              <Link
                href="/orders"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[20px] text-ink-black hover:bg-canvas-mist text-sm tracking-tight-body"
              >
                <Package className="w-4 h-4 text-muted-gray" />
                <span>Đơn hàng</span>
              </Link>
              <Link
                href="/wishlist"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-2.5 rounded-[20px] text-ink-black hover:bg-canvas-mist text-sm tracking-tight-body"
              >
                <div className="flex items-center gap-3">
                  <Heart className="w-4 h-4 text-muted-gray" />
                  <span>Yêu thích</span>
                </div>
                {wishlistCount > 0 && (
                  <span className="text-xs font-semibold text-white bg-rose-500 rounded-full px-2 py-0.5">
                    {wishlistCount}
                  </span>
                )}
              </Link>
              <Link
                href="/wallet"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[20px] text-ink-black hover:bg-canvas-mist text-sm tracking-tight-body"
              >
                <Wallet className="w-4 h-4 text-shop-violet" />
                <span>Ví Shop</span>
              </Link>
              <Link
                href="/chat"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[20px] text-ink-black hover:bg-canvas-mist text-sm tracking-tight-body"
              >
                <MessageSquare className="w-4 h-4 text-muted-gray" />
                <span>Chat</span>
              </Link>
            </>
          )}
          {session?.user?.role === 'ADMIN' && (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[20px] text-ink-black hover:bg-canvas-mist text-sm tracking-tight-body"
            >
              <ShieldAlert className="w-4 h-4 text-shop-violet" />
              <span>Admin</span>
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
