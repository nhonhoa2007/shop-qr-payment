'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';

export interface AdminAppShellProps {
  children: React.ReactNode;
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string;
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

function getSidebarSnapshot() {
  try {
    return localStorage.getItem('admin_sidebar_collapsed') === 'true';
  } catch {
    return false;
  }
}

export function AdminAppShell({ children, user }: AdminAppShellProps) {
  const isCollapsed = useSyncExternalStore(
    subscribeSidebar,
    getSidebarSnapshot,
    () => false
  );

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleToggleCollapse = () => {
    try {
      localStorage.setItem('admin_sidebar_collapsed', String(!isCollapsed));
      emitSidebarChange();
    } catch {
      // Ignore
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f3f4f6] text-slate-900 antialiased font-sans">
      {/* Sidebar Navigation */}
      <AdminSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        user={user}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Topbar Header */}
        <AdminTopbar
          onToggleMobileMenu={() => setIsMobileOpen(true)}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
          user={user}
        />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
