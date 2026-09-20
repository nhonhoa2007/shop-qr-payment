'use client';

import { NotificationItem } from '@client/components/notification/NotificationItem';
import { Bell, Inbox } from 'lucide-react';
import type { Notification } from '@shared/types';

export interface NotificationsViewProps {
  notifications: Notification[];
}

export function NotificationsView({ notifications }: NotificationsViewProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
          <Bell className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Thông báo</h1>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Inbox className="w-8 h-8 stroke-[1.5]" />
          </div>
          <p className="font-semibold text-slate-700 mb-1">Chưa có thông báo nào</p>
          <p className="text-xs text-slate-400">Khi có cập nhật đơn hàng hoặc tin nhắn, hệ thống sẽ báo tại đây.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100 overflow-hidden">
          {notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </div>
  );
}

export default NotificationsView;
