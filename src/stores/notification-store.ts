import { create } from 'zustand';
import type { Notification } from '@/types';

interface NotificationStore {
  unreadCount: number;
  notifications: Notification[];
  setUnreadCount: (count: number) => void;
  addNotification: (n: Notification) => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  unreadCount: 0,
  notifications: [],
  setUnreadCount: (count) => set({ unreadCount: count }),
  addNotification: (n) =>
    set((state) => ({
      notifications: [n, ...state.notifications].slice(0, 50),
    })),
  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
}));
