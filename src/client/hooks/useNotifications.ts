'use client';

import { useEffect } from 'react';
import { pusherClient } from '@/lib/pusher-client';
import { toast } from 'sonner';
import { useNotificationStore } from '@/client/stores/notification-store';
import type { Notification } from '@/types';
import { formatVND } from '@/lib/utils';

export function useNotifications(userId: string | undefined) {
  const { setUnreadCount, addNotification } = useNotificationStore();

  useEffect(() => {
    if (!userId) return;

    const channel = pusherClient.subscribe(`private-user-${userId}`);

    channel.bind('new-notification', (data: Notification) => {
      setUnreadCount(data.unreadCount || 0);
      addNotification(data);

      toast(data.title, {
        description: data.message,
        duration: 5000,
      });
    });

    channel.bind('payment-success', (data: { orderId: string; amount: number }) => {
      toast.success('Thanh toán thành công', {
        description: `Đơn hàng ${data.orderId} — ${formatVND(data.amount)}`,
        duration: 8000,
      });
    });

    return () => {
      channel.unbind_all();
      pusherClient.unsubscribe(`private-user-${userId}`);
    };
  }, [userId, setUnreadCount, addNotification]);
}
