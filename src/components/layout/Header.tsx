'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useCartStore } from '@/stores/cart-store';
import { NotificationBell } from './NotificationBell';
import { useNotifications } from '@/hooks/useNotifications';
import { useHydrated } from '@/lib/hydration';
import {
  ShoppingCart,
  Menu,
  X,
  Package,
  MessageSquare,
  ShieldAlert,
  LogOut,
  User,
  ShoppingBag,
} from 'lucide-react';

export function Header() {
  const { data: session } = useSession();
  const getTotalItems = useCartStore((s) => s.getTotalItems);
  const hydrated = useHydrated();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useNotifications(session?.user?.id);

  const cartCount = hydrated ? getTotalItems() : 0;

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <Link href="/" className="flex items-center gap-2">
              <ShoppingBag className="w-7 h-7 text-blue-600" />
              <span className="font-bold text-xl text-blue-600 tracking-tight">ShopQR</span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-gray-600 hover:text-blue-600 transition font-medium">
              Sản phẩm
            </Link>
            {session && (
              <>
                <Link href="/orders" className="text-gray-600 hover:text-blue-600 transition font-medium">
                  Đơn hàng
                </Link>
                <Link href="/wishlist" className="text-gray-600 hover:text-blue-600 transition font-medium">
                  Yêu thích
                </Link>
                <Link href="/chat" className="text-gray-600 hover:text-blue-600 transition font-medium">
                  Chat
                </Link>
              </>
            )}
            {session?.user?.role === 'ADMIN' && (
              <Link
                href="/admin"
                className="text-gray-600 hover:text-blue-600 transition font-medium flex items-center gap-1.5"
              >
                <ShieldAlert className="w-4 h-4 text-orange-500" />
                <span>Admin</span>
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/cart"
              className="relative p-2 rounded-full hover:bg-gray-100 transition text-gray-700"
              aria-label="Giỏ hàng"
            >
              <ShoppingCart className="w-6 h-6" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full px-1">
                  {cartCount}
                </span>
              )}
            </Link>

            {session && <NotificationBell />}

            {session ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                  <User className="w-4 h-4 text-gray-500" />
                  <span>{session.user?.name}</span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="text-sm text-red-600 hover:bg-red-50 p-2 rounded-lg transition flex items-center gap-1 font-medium"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Đăng xuất</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="text-sm text-gray-700 hover:text-blue-600 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/register"
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium shadow-sm"
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
        <div className="md:hidden border-t border-gray-100 bg-white px-4 pt-2 pb-4 space-y-1 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-700 hover:bg-blue-50 hover:text-blue-600 font-medium"
          >
            <ShoppingBag className="w-5 h-5 text-blue-600" />
            <span>Sản phẩm</span>
          </Link>
          {session && (
            <>
              <Link
                href="/orders"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-700 hover:bg-blue-50 hover:text-blue-600 font-medium"
              >
                <Package className="w-5 h-5 text-gray-500" />
                <span>Đơn hàng của tôi</span>
              </Link>
              <Link
                href="/wishlist"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-700 hover:bg-blue-50 hover:text-blue-600 font-medium"
              >
                <ShoppingBag className="w-5 h-5 text-gray-500" />
                <span>Danh sách yêu thích</span>
              </Link>
              <Link
                href="/chat"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-700 hover:bg-blue-50 hover:text-blue-600 font-medium"
              >
                <MessageSquare className="w-5 h-5 text-gray-500" />
                <span>Trò chuyện trực tiếp</span>
              </Link>
            </>
          )}
          {session?.user?.role === 'ADMIN' && (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-amber-700 hover:bg-amber-50 font-medium"
            >
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <span>Bảng điều khiển Admin</span>
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
