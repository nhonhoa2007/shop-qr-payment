import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { ChatService } from '@/server/modules/chat/chat.service';
import { AdminChatView } from '@client/views/admin/AdminChatView';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Hỗ trợ khách hàng | Quản trị viên Shop QR',
};

export default async function AdminChatPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const rooms = await ChatService.getAdminChatRooms(session.user.id);

  return <AdminChatView rooms={rooms} />;
}
