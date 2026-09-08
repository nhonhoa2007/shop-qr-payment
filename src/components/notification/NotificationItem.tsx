import { formatDateTime } from '@/lib/utils';
import type { Notification } from '@/types';

const ICONS: Record<string, string> = {
  ORDER_CREATED: '🛒',
  PAYMENT_RECEIVED: '💰',
  ORDER_CONFIRMED: '✅',
  ORDER_SHIPPING: '🚚',
  ORDER_COMPLETED: '🎉',
  NEW_MESSAGE: '💬',
  OTP_SENT: '🔐',
};

export function NotificationItem({ notification, onClick }: { notification: Notification; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition border-b border-gray-50 ${
        !notification.isRead ? 'bg-blue-50/50' : ''
      }`}
    >
      <span className="text-xl flex-shrink-0 mt-0.5">{ICONS[notification.type] || '🔔'}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${!notification.isRead ? 'font-semibold' : 'font-medium'} text-gray-800`}>
          {notification.title}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notification.message}</p>
        <p className="text-xs text-gray-400 mt-1">{formatDateTime(notification.createdAt)}</p>
      </div>
      {!notification.isRead && (
        <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2" />
      )}
    </div>
  );
}
