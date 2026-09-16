import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { NotificationsService } from '@/server/modules/notifications/notifications.service';
import { NotificationsView } from '@/client/views/NotificationsView';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const notifications = await NotificationsService.getUserNotifications(session.user.id);

  return <NotificationsView notifications={notifications} />;
}
