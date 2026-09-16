import { formatDateTime } from '@/lib/utils';
import {
  ShoppingBag,
  Coins,
  CheckCircle2,
  Truck,
  PartyPopper,
  MessageSquare,
  KeyRound,
  Bell,
} from 'lucide-react';
import type { Notification } from '@/types';

function renderNotificationIcon(type: string) {
  const iconProps = { className: 'w-4 h-4' };

  switch (type) {
    case 'ORDER_CREATED':
      return (
        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
          <ShoppingBag {...iconProps} />
        </div>
      );
    case 'PAYMENT_RECEIVED':
      return (
        <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
          <Coins {...iconProps} />
        </div>
      );
    case 'ORDER_CONFIRMED':
      return (
        <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 {...iconProps} />
        </div>
      );
    case 'ORDER_SHIPPING':
      return (
        <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
          <Truck {...iconProps} />
        </div>
      );
    case 'ORDER_COMPLETED':
      return (
        <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
          <PartyPopper {...iconProps} />
        </div>
      );
    case 'NEW_MESSAGE':
      return (
        <div className="w-8 h-8 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
          <MessageSquare {...iconProps} />
        </div>
      );
    case 'OTP_SENT':
      return (
        <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
          <KeyRound {...iconProps} />
        </div>
      );
    default:
      return (
        <div className="w-8 h-8 rounded-full bg-slate-50 text-slate-600 flex items-center justify-center flex-shrink-0">
          <Bell {...iconProps} />
        </div>
      );
  }
}

export function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition border-b border-slate-100 ${
        !notification.isRead ? 'bg-indigo-50/40' : ''
      }`}
    >
      {renderNotificationIcon(notification.type)}
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${!notification.isRead ? 'font-semibold' : 'font-medium'} text-slate-900`}>
          {notification.title}
        </p>
        <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{notification.message}</p>
        <p className="text-[11px] text-slate-400 mt-1">{formatDateTime(notification.createdAt)}</p>
      </div>
      {!notification.isRead && (
        <span className="w-2 h-2 bg-indigo-600 rounded-full flex-shrink-0 mt-2" />
      )}
    </div>
  );
}
