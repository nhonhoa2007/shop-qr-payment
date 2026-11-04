'use client';

import React, { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { AnimateUIProvider } from '@animate-ui/react/provider';
import { Dialog } from '@animate-ui/react/primitives/radix-ui/dialog';
import * as SidebarPrimitive from '@animate-ui/react/primitives/sidebar';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';

export interface AdminAppShellProps {
  children: React.ReactNode;
  initialCollapsed?: boolean;
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string;
    permissions?: string[];
  };
}

let sidebarListeners: Array<() => void> = [];

function emitSidebarChange() {
  for (const listener of sidebarListeners) {
    listener();
  }
}

function subscribeSidebar(callback: () => void) {
  sidebarListeners.push(callback);
  window.addEventListener('storage', callback);
  return () => {
    sidebarListeners = sidebarListeners.filter((l) => l !== callback);
    window.removeEventListener('storage', callback);
  };
}

function getSidebarSnapshot(fallback: boolean) {
  try {
    const stored = localStorage.getItem('admin_sidebar_collapsed');
    return stored === null ? fallback : stored === 'true';
  } catch {
    return fallback;
  }
}

export function AdminAppShell({ children, user, initialCollapsed = false }: AdminAppShellProps) {
  const isCollapsed = useSyncExternalStore(
    subscribeSidebar,
    () => getSidebarSnapshot(initialCollapsed),
    () => initialCollapsed
  );

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useLayoutEffect(() => {
    if (isCollapsed === getSidebarSnapshot(initialCollapsed)) {
      document.documentElement.dataset.adminSidebarCollapsed = String(isCollapsed);
    }
  }, [initialCollapsed, isCollapsed]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setIsMobileOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  const setSidebarOpen = (open: boolean) => {
    if (window.matchMedia('(max-width: 1023px)').matches) return;
    try {
      localStorage.setItem('admin_sidebar_collapsed', String(!open));
      document.cookie = `admin_sidebar_collapsed=${!open}; path=/admin; max-age=604800; SameSite=Lax`;
      document.documentElement.dataset.adminSidebarCollapsed = String(!open);
      emitSidebarChange();
    } catch {
      // Ignore
    }
  };

  const handleToggleCollapse = () => setSidebarOpen(isCollapsed);

  return (
    <AnimateUIProvider tempo={0.85} reducedMotion="user">
      <SidebarPrimitive.Provider
        open={!isCollapsed}
        onOpenChange={setSidebarOpen}
        className="flex h-screen w-full overflow-hidden bg-[#f5f6f7] font-sans text-slate-900 antialiased"
      >
        <Dialog.Root open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <AdminSidebar
            isCollapsed={isCollapsed}
            onToggleCollapse={handleToggleCollapse}
            onCloseMobile={() => setIsMobileOpen(false)}
            user={user}
          />
          <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
            <AdminTopbar user={user} />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </Dialog.Root>
      </SidebarPrimitive.Provider>
    </AnimateUIProvider>
  );
}
