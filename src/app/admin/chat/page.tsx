import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { redirect } from 'next/navigation';
import { ChatService } from '@/server/modules/chat/chat.service';
import { AdminChatView } from '@client/views/admin/AdminChatView';
import { canAccessAdminPage } from '@shared/admin-page-access';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Hỗ trợ khách hàng | Quản trị viên Shop QR',
};

export default async function AdminChatPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canAccessAdminPage(session.user, '/admin/chat')) {
    redirect('/');
  }

  const rooms = await ChatService.getAdminChatRooms(session.user.id, session.user.role === 'STAFF');

  return <AdminChatView rooms={rooms} currentUserId={session.user.id} canViewOrders={canAccessAdminPage(session.user, '/admin/orders')} />;
}
