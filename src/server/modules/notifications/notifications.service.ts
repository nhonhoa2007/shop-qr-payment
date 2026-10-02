import type { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.ts';
import { pusherServer } from '../../infrastructure/pusher.ts';
import type { Notification, NotificationType } from '@/types';

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export async function createNotification(params: CreateNotificationParams) {
  const data = (params.data || {}) as Prisma.InputJsonObject;
  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      data,
    },
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: params.userId, isRead: false },
  });

  await pusherServer.trigger(`private-user-${params.userId}`, 'new-notification', {
    id: notification.id,
    type: params.type,
    title: params.title,
    message: params.message,
    data: params.data,
    unreadCount,
    createdAt: notification.createdAt,
  });

  return notification;
}

export async function markAsRead(notificationId: string, userId: string) {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

export class NotificationsService {
  /**
   * Lấy danh sách 50 thông báo gần nhất của người dùng
   */
  static async getUserNotifications(userId: string): Promise<Notification[]> {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return notifications.map((notification) => ({
      ...notification,
      data: notification.data as Record<string, unknown> | null,
      createdAt: notification.createdAt.toISOString(),
    }));
  }

  /**
   * Đếm số lượng thông báo chưa đọc
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return await prisma.notification.count({
      where: { userId, isRead: false },
    });
  }
}
