import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { NotificationItem } from '@/components/notification/NotificationItem';
import type { Notification } from '@/types';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const serializedNotifications: Notification[] = notifications.map((notification) => ({
    ...notification,
    data: notification.data as Record<string, unknown> | null,
    createdAt: notification.createdAt.toISOString(),
  }));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">🔔 Thông báo</h1>
      {serializedNotifications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
          <span className="text-5xl block mb-4">🔔</span>
          <p className="text-gray-500">Chưa có thông báo nào</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {serializedNotifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </div>
  );
}
