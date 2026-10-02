'use client';

import { useCallback, useEffect, useState } from 'react';
import { useNotificationStore } from '@client/stores/notification-store';
import { NotificationItem } from './NotificationItem';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import type { Notification } from '@shared/types';

export function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const { notifications: realtimeNotifications } = useNotificationStore();
  const [dbNotifications, setDbNotifications] = useState<Notification[]>([]);
  const [fetchError, setFetchError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const applyNotifications = useCallback((data: { notifications?: Notification[] }) => {
    setDbNotifications(data.notifications || []);
    setFetchError(false);
  }, []);

  // Fetch khi người dùng bấm "Thử lại" — được set state đồng bộ
  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch('/api/notifications?limit=20');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      applyNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [applyNotifications]);

  // Initial load — state khởi tạo đã ở loading=true, chỉ cập nhật bất đồng bộ
  useEffect(() => {
    let cancelled = false;

    fetch('/api/notifications?limit=20')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) applyNotifications(data);
      })
      .catch((err) => {
        console.error('Failed to load notifications:', err);
        if (!cancelled) setFetchError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applyNotifications]);

  // Đóng dropdown bằng phím ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markAllRead' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDbNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      toast.error('Không thể đánh dấu tất cả đã đọc. Vui lòng thử lại.');
    } finally {
      setMarkingAll(false);
    }
  };

  const allNotifications = [...realtimeNotifications, ...dbNotifications]
    .filter((n, i, arr) => arr.findIndex((x) => x.id === n.id) === i)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Danh sách thông báo"
        className="absolute right-0 top-12 w-96 bg-white rounded-xl shadow-2xl border z-50 max-h-[480px] overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-bold text-lg">Thông báo</h3>
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll || allNotifications.length === 0}
            className="text-sm text-shop-violet hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
          >
            {markingAll ? 'Đang xử lý...' : 'Đánh dấu tất cả đã đọc'}
          </button>
        </div>
        <div className="overflow-y-auto max-h-[380px]">
          {fetchError ? (
            <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              <p className="text-sm text-gray-500">
                Không tải được thông báo. Kiểm tra kết nối và thử lại.
              </p>
              <button
                onClick={loadNotifications}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-shop-violet hover:underline cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Thử lại
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Đang tải thông báo...
            </div>
          ) : allNotifications.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Chưa có thông báo nào</p>
          ) : (
            allNotifications.map((n) => <NotificationItem key={n.id} notification={n} />)
          )}
        </div>
        <div className="border-t px-4 py-2 text-center">
          <Link href="/notifications" onClick={onClose} className="text-sm text-shop-violet hover:underline">
            Xem tất cả
          </Link>
        </div>
      </div>
    </>
  );
}
