import { prisma } from '@/server/database/prisma';
import type { Notification } from '@/types';

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
