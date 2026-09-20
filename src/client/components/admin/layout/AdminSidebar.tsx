'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  Package,
  Truck,
  Boxes,
  CreditCard,
  Tag,
  Users,
  Star,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LogOut,
  X,
} from 'lucide-react';

export interface AdminSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string;
  };
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeType?: 'default' | 'alert' | 'count';
  exact?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Tổng quan',
    items: [
      {
        name: 'Bảng điều khiển',
        href: '/admin',
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    title: 'Bán hàng & Kho',
    items: [
      {
        name: 'Đơn hàng',
        href: '/admin/orders',
        icon: Package,
        badge: 'Mới',
        badgeType: 'count',
      },
      {
        name: 'Vận đơn GHN',
        href: '/admin/shipments',
        icon: Truck,
        badge: 'GHN',
        badgeType: 'default',
      },
      {
        name: 'Sản phẩm & Biến thể',
        href: '/admin/products',
        icon: Boxes,
      },
    ],
  },
  {
    title: 'Tài chính & Ưu đãi',
    items: [
      {
        name: 'Đối soát VietQR',
        href: '/admin/transactions',
        icon: CreditCard,
        badge: 'Khớp',
        badgeType: 'alert',
      },
      {
        name: 'Mã giảm giá (Coupon)',
        href: '/admin/coupons',
        icon: Tag,
      },
    ],
  },
  {
    title: 'Khách hàng & CSKH',
    items: [
      {
        name: 'Khách hàng & RBAC',
        href: '/admin/customers',
        icon: Users,
      },
      {
        name: 'Tin nhắn trực tuyến',
        href: '/admin/chat',
        icon: MessageSquare,
        badge: 'Live',
        badgeType: 'count',
      },
      {
        name: 'Đánh giá sản phẩm',
        href: '/admin/reviews',
        icon: Star,
      },
    ],
  },
];

export function AdminSidebar({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  user,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const isItemActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  const getInitials = (name?: string | null) => {
    if (!name) return 'AD';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between select-none">
      {/* Top section: Logo & Nav */}
      <div className="space-y-5">
        {/* Header / Brand */}
        <div className={`flex items-center pt-2 pb-1 ${isCollapsed ? 'justify-center px-1' : 'justify-between px-3'}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/admin"
              className="w-9 h-9 rounded-xl bg-[#5433eb] flex items-center justify-center text-white font-black text-lg shadow-sm shadow-[#5433eb]/30 shrink-0 hover:scale-105 transition-transform"
              title="Shop Admin"
            >
              S
            </Link>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-slate-900">shop.</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-[#5433eb]/10 text-[#5433eb] text-[10px] font-bold tracking-wider">
                    ADMIN
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium truncate">Trung tâm điều hành</p>
              </div>
            )}
          </div>

          {/* Desktop collapse toggle button */}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            className="hidden lg:flex p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
            title={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Đóng menu"
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="space-y-4 text-[13px] px-1">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              {!isCollapsed ? (
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
                  {group.title}
                </div>
              ) : (
                <div className="h-px bg-slate-100 my-2 mx-2" />
              )}

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isItemActive(item);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onCloseMobile}
                      title={isCollapsed ? item.name : undefined}
                      className={`flex items-center rounded-xl transition group relative ${
                        isCollapsed
                          ? 'justify-center p-2.5'
                          : 'justify-between px-3 py-2.5'
                      } ${
                        active
                          ? 'bg-[#5433eb] text-white font-semibold shadow-sm shadow-[#5433eb]/25'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <div className={`flex items-center gap-2.5 ${isCollapsed ? 'justify-center' : ''}`}>
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                            active ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'
                          }`}
                        />
                        {!isCollapsed && <span className="truncate">{item.name}</span>}
                      </div>

                      {/* Expanded state right badge/dot */}
                      {!isCollapsed && (
                        <div>
                          {active ? (
                            <span className="w-2 h-2 rounded-full bg-white/90 block" />
                          ) : item.badge ? (
                            item.badgeType === 'alert' ? (
                              <span
                                className="w-2 h-2 rounded-full bg-rose-500 block"
                                title="Cần lưu ý"
                              />
                            ) : item.badgeType === 'count' ? (
                              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                                {item.badge}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold">
                                {item.badge}
                              </span>
                            )
                          ) : null}
                        </div>
                      )}

                      {/* Collapsed state active indicator */}
                      {isCollapsed && active && (
                        <span className="absolute right-1 w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom section: Shop link & Admin Profile */}
      <div className="pt-3 border-t border-slate-200/80 space-y-2.5">
        {/* Link back to Customer Shop */}
        <Link
          href="/"
          title="Xem Cửa hàng Khách"
          className={`flex items-center rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/70 text-xs font-semibold text-slate-700 transition group ${
            isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
          }`}
        >
          <span className="flex items-center gap-2 truncate">
            <ExternalLink className="w-4 h-4 text-[#5433eb] shrink-0 group-hover:scale-110 transition-transform" />
            {!isCollapsed && <span className="truncate">Xem Cửa hàng Khách</span>}
          </span>
          {!isCollapsed && (
            <span className="text-[10px] text-slate-400 font-normal">shop/</span>
          )}
        </Link>

        {/* Profile info & Logout */}
        <div
          className={`flex items-center pt-1 ${
            isCollapsed ? 'justify-center flex-col gap-2' : 'justify-between px-1'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center font-bold text-xs text-[#5433eb] shrink-0"
              title={user?.name || user?.email || 'Admin'}
            >
              {getInitials(user?.name)}
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 leading-tight truncate">
                  {user?.name || 'Admin Shop'}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {user?.role === 'ADMIN' ? 'Super Admin' : user?.role || 'Admin'}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
            title="Đăng xuất"
            aria-label="Đăng xuất khỏi hệ thống"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden lg:flex flex-col justify-between bg-white border-r border-slate-200/80 p-3.5 shrink-0 shadow-sm transition-all duration-300 ease-in-out h-screen overflow-y-auto ${
          isCollapsed ? 'w-20' : 'w-[260px]'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Slide-over Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <aside className="fixed inset-y-0 left-0 w-[280px] bg-white border-r border-slate-200 p-4 shadow-xl z-10 flex flex-col justify-between overflow-y-auto">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
