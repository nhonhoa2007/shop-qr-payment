'use client';

import { useEffect, useState } from 'react';
import { useNotificationStore } from '@/client/stores/notification-store';
import { NotificationItem } from './NotificationItem';
import Link from 'next/link';
import type { Notification } from '@/types';

export function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const { notifications: realtimeNotifications } = useNotificationStore();
  const [dbNotifications, setDbNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    fetch('/api/notifications?limit=20')
      .then((r) => r.json())
      .then((data) => setDbNotifications(data.notifications || []))
      .catch(() => {});
  }, []);

  const handleMarkAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'markAllRead' }),
    });
  };

  const allNotifications = [...realtimeNotifications, ...dbNotifications]
    .filter((n, i, arr) => arr.findIndex((x) => x.id === n.id) === i)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-12 w-96 bg-white rounded-xl shadow-2xl border z-50 max-h-[480px] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-bold text-lg">Thông báo</h3>
          <button onClick={handleMarkAllRead} className="text-sm text-blue-600 hover:underline">
            Đánh dấu tất cả đã đọc
          </button>
        </div>
        <div className="overflow-y-auto max-h-[380px]">
          {allNotifications.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Chưa có thông báo nào</p>
          ) : (
            allNotifications.map((n) => <NotificationItem key={n.id} notification={n} />)
          )}
        </div>
        <div className="border-t px-4 py-2 text-center">
          <Link href="/notifications" onClick={onClose} className="text-sm text-blue-600 hover:underline">
            Xem tất cả
          </Link>
        </div>
      </div>
    </>
  );
}
