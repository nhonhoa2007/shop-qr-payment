'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { ChevronLeft, ChevronRight, ExternalLink, LogOut, X } from 'lucide-react';
import { Dialog } from '@animate-ui/react/primitives/radix-ui/dialog';
import * as SidebarPrimitive from '@animate-ui/react/primitives/sidebar';
import { getVisibleAdminNavGroups, isAdminNavItemActive } from './admin-navigation';

export interface AdminSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string;
    permissions?: string[];
  };
}

function initials(name?: string | null): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return 'AD';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function AdminSidebar({
  isCollapsed,
  onToggleCollapse,
  onCloseMobile,
  user,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const groups = getVisibleAdminNavGroups(user?.role, user?.permissions);

  const content = (collapsed: boolean, mobile: boolean) => (
    <div className="flex min-h-full flex-col justify-between gap-8 select-none">
      <div>
        <div className={`mb-7 flex items-center gap-2 px-2 pt-1 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <Link href="/admin" onClick={mobile ? onCloseMobile : undefined} className="flex min-w-0 items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-800 text-sm font-semibold text-white">S</span>
            {!collapsed && <span data-admin-expanded-only className="truncate text-lg font-semibold tracking-tight text-slate-900">shop.</span>}
          </Link>
          {mobile ? (
            <Dialog.Close aria-label="Đóng danh mục quản trị" className="rounded-md p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-slate-700">
              <X className="size-4" />
            </Dialog.Close>
          ) : (
            !collapsed && <button data-admin-expanded-only type="button" onClick={onToggleCollapse} aria-label="Thu gọn sidebar" className="rounded-md p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-slate-700"><ChevronLeft className="size-4" /></button>
          )}
        </div>

        <SidebarPrimitive.Highlight className="space-y-5" animateOnHover={!mobile}>
          <nav aria-label="Điều hướng quản trị" className="space-y-5">
            {groups.map((group) => (
              <div key={group.title} className="space-y-1">
                {collapsed ? <div className="mx-3 h-px bg-slate-200" /> : <h2 data-admin-expanded-only className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{group.title}</h2>}
                {group.items.map((item) => {
                  const active = isAdminNavItemActive(pathname, item.href, item.exact);
                  const Icon = item.icon;
                  return (
                    <div key={item.href} className="relative">
                      <Link
                        data-sidebar="menu-button"
                        href={item.href}
                        onClick={mobile ? onCloseMobile : undefined}
                        aria-current={active ? 'page' : undefined}
                        aria-label={collapsed ? item.name : undefined}
                        title={collapsed ? item.name : undefined}
                        className={`relative z-10 flex min-h-10 items-center gap-3 overflow-hidden rounded-md px-3 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-slate-700 ${collapsed ? 'justify-center' : ''} ${active ? 'bg-slate-200/80 text-slate-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                      >
                        <Icon className="size-4 shrink-0" />
                        {!collapsed && <span data-admin-expanded-only className="min-w-0 flex-1 truncate">{item.name}</span>}
                      </Link>
                    </div>
                  );
                })}
              </div>
            ))}
          </nav>
        </SidebarPrimitive.Highlight>
        {collapsed && !mobile && <button type="button" onClick={onToggleCollapse} aria-label="Mở rộng sidebar" title="Mở rộng sidebar" className="mx-auto mt-5 flex rounded-md p-2 text-slate-600 hover:bg-slate-100"><ChevronRight className="size-4" /></button>}
      </div>

      <div className="space-y-3 border-t border-slate-200 px-2 pt-4">
        <Link data-admin-sidebar-footer-link href="/" onClick={mobile ? onCloseMobile : undefined} title="Xem cửa hàng" className={`flex min-h-10 items-center gap-3 rounded-md px-2 text-[13px] text-slate-600 hover:bg-slate-100 ${collapsed ? 'justify-center' : ''}`}>
          <ExternalLink className="size-4 shrink-0" />{!collapsed && <span data-admin-expanded-only>Xem cửa hàng</span>}
        </Link>
        <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : ''}`}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-800">{initials(user?.name)}</span>
          {!collapsed && <div data-admin-expanded-only className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-900">{user?.name || 'Quản trị viên'}</p><p className="text-[11px] text-slate-500">{user?.role === 'STAFF' ? 'Nhân viên' : 'Quản trị'}</p></div>}
          <button type="button" onClick={() => signOut({ callbackUrl: '/login' })} title="Đăng xuất" aria-label="Đăng xuất" className="rounded-md p-2 text-slate-600 hover:bg-slate-100"><LogOut className="size-4" /></button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <SidebarPrimitive.Container id="admin-desktop-sidebar" role="complementary" className={`hidden h-screen shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3 lg:flex lg:flex-col ${isCollapsed ? 'lg:w-[72px]' : 'lg:w-[240px]'}`} aria-label="Sidebar quản trị">
        {content(isCollapsed, false)}
      </SidebarPrimitive.Container>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden" />
        <Dialog.Content data-side="left" className="fixed inset-y-0 left-0 z-50 w-[min(280px,calc(100vw-32px))] overflow-y-auto border-r border-slate-200 bg-white p-4 shadow-xl lg:hidden" aria-label="Danh mục quản trị">
          <Dialog.Title className="sr-only">Danh mục quản trị</Dialog.Title>
          <Dialog.Description className="sr-only">Chọn một trang quản trị</Dialog.Description>
          {content(false, true)}
        </Dialog.Content>
      </Dialog.Portal>
    </>
  );
}
