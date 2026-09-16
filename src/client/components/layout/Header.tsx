'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useCartStore } from '@/client/stores/cart-store';
import { NotificationBell } from './NotificationBell';
import { useNotifications } from '@/client/hooks/useNotifications';
import { useHydrated } from '@/lib/hydration';
import { useRouter } from 'next/navigation';
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
  const { data: session } = useSession();
  const getTotalItems = useCartStore((s) => s.getTotalItems);
  const hydrated = useHydrated();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  useNotifications(session?.user?.id);

  const cartCount = hydrated ? getTotalItems() : 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  return (
    <header className="bg-white sticky top-0 z-50 border-b border-[#ebebeb]/60">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-full text-[#000000] hover:bg-[#f2f4f5] transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link href="/" className="flex items-center gap-1">
              <span className="font-semibold text-xl tracking-tight-display text-[#000000]">shop</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#5433eb] mt-2" />
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/"
                className="px-3 py-1.5 text-sm tracking-tight-body text-[#787574] hover:text-[#000000] transition rounded-full hover:bg-[#f2f4f5]"
              >
                Khám phá
              </Link>
              {session && (
                <>
                  <Link
                    href="/orders"
                    className="px-3 py-1.5 text-sm tracking-tight-body text-[#787574] hover:text-[#000000] transition rounded-full hover:bg-[#f2f4f5]"
                  >
                    Đơn hàng
                  </Link>
                  <Link
                    href="/wishlist"
                    className="px-3 py-1.5 text-sm tracking-tight-body text-[#787574] hover:text-[#000000] transition rounded-full hover:bg-[#f2f4f5]"
                  >
                    Yêu thích
                  </Link>
                  <Link
                    href="/wallet"
                    className="px-3 py-1.5 text-sm tracking-tight-body text-[#787574] hover:text-[#000000] transition rounded-full hover:bg-[#f2f4f5] flex items-center gap-1"
                  >
                    <Wallet className="w-3.5 h-3.5 text-[#5433eb]" />
                    <span>Ví Shop</span>
                  </Link>
                  <Link
                    href="/chat"
                    className="px-3 py-1.5 text-sm tracking-tight-body text-[#787574] hover:text-[#000000] transition rounded-full hover:bg-[#f2f4f5]"
                  >
                    Chat
                  </Link>
                </>
              )}
              {session?.user?.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className="px-3 py-1.5 text-sm tracking-tight-body text-[#787574] hover:text-[#000000] transition rounded-full hover:bg-[#f2f4f5] flex items-center gap-1"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-[#5433eb]" />
                  Admin
                </Link>
              )}
            </nav>
          </div>

          {/* Center: Search */}
          <form onSubmit={handleSearch} className="hidden sm:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#787574]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Bạn đang tìm gì hôm nay?"
                className="w-full pl-11 pr-12 py-2.5 rounded-full border border-[#000000]/10 bg-white text-sm tracking-tight-body text-[#000000] placeholder:text-[#787574] focus:outline-none focus:border-[#5433eb]/40 transition"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#5433eb] text-white flex items-center justify-center hover:bg-[#4428d4] transition shadow-violet-custom"
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
                className="p-2.5 rounded-full hover:bg-[#f2f4f5] transition text-[#000000]"
                aria-label="Yêu thích"
              >
                <Heart className="w-5 h-5" />
              </Link>
            )}

            <Link
              href="/cart"
              className="relative p-2.5 rounded-full hover:bg-[#f2f4f5] transition text-[#000000]"
              aria-label="Giỏ hàng"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-semibold text-white bg-[#5433eb] rounded-full px-1">
                  {cartCount}
                </span>
              )}
            </Link>

            {session && <NotificationBell />}

            {session ? (
              <div className="flex items-center gap-1 ml-1">
                <div className="hidden sm:flex items-center gap-1.5 text-sm tracking-tight-body text-[#000000] bg-[#f2f4f5] px-3 py-1.5 rounded-full">
                  <User className="w-3.5 h-3.5 text-[#787574]" />
                  <span>{session.user?.name}</span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="p-2.5 text-[#787574] hover:text-[#000000] hover:bg-[#f2f4f5] rounded-full transition"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 ml-1">
                <Link
                  href="/login"
                  className="text-sm tracking-tight-body text-[#787574] hover:text-[#000000] px-3 py-1.5 rounded-full hover:bg-[#f2f4f5] transition"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/register"
                  className="text-sm tracking-tight-body bg-[#000000] text-white px-4 py-2 rounded-full hover:bg-[#332f2d] transition"
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
        <div className="md:hidden border-t border-[#ebebeb] bg-white px-4 pt-3 pb-4 space-y-1">
          {/* Mobile search */}
          <form onSubmit={handleSearch} className="sm:hidden mb-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#787574]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm sản phẩm..."
                className="w-full pl-11 pr-12 py-2.5 rounded-full border border-[#000000]/10 bg-white text-sm tracking-tight-body placeholder:text-[#787574] focus:outline-none focus:border-[#5433eb]/40 transition"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#5433eb] text-white flex items-center justify-center shadow-violet-custom"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-[20px] text-[#000000] hover:bg-[#f2f4f5] text-sm tracking-tight-body"
          >
            <Search className="w-4 h-4 text-[#787574]" />
            <span>Khám phá</span>
          </Link>
          {session && (
            <>
              <Link
                href="/orders"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[20px] text-[#000000] hover:bg-[#f2f4f5] text-sm tracking-tight-body"
              >
                <Package className="w-4 h-4 text-[#787574]" />
                <span>Đơn hàng</span>
              </Link>
              <Link
                href="/wishlist"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[20px] text-[#000000] hover:bg-[#f2f4f5] text-sm tracking-tight-body"
              >
                <Heart className="w-4 h-4 text-[#787574]" />
                <span>Yêu thích</span>
              </Link>
              <Link
                href="/wallet"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[20px] text-[#000000] hover:bg-[#f2f4f5] text-sm tracking-tight-body"
              >
                <Wallet className="w-4 h-4 text-[#5433eb]" />
                <span>Ví Shop</span>
              </Link>
              <Link
                href="/chat"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[20px] text-[#000000] hover:bg-[#f2f4f5] text-sm tracking-tight-body"
              >
                <MessageSquare className="w-4 h-4 text-[#787574]" />
                <span>Chat</span>
              </Link>
            </>
          )}
          {session?.user?.role === 'ADMIN' && (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[20px] text-[#000000] hover:bg-[#f2f4f5] text-sm tracking-tight-body"
            >
              <ShieldAlert className="w-4 h-4 text-[#5433eb]" />
              <span>Admin</span>
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
