import type { Prisma } from '@prisma/client';
import { pusherServer } from './pusher-server';
import { prisma } from './prisma';
import type { NotificationType } from '@/types';

interface CreateNotificationParams {
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
