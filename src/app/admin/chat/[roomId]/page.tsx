import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect, notFound } from 'next/navigation';
import { ChatService } from '@/server/modules/chat/chat.service';
import { AdminChatView } from '@client/views/admin/AdminChatView';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ roomId: string }>;
}): Promise<Metadata> {
  const { roomId } = await params;
  return {
    title: `Chi tiết hội thoại #${roomId.slice(-6)} | Quản trị viên Shop QR`,
    description: 'Hỗ trợ tư vấn khách hàng và cập nhật đơn hàng thời gian thực',
  };
}

export default async function AdminChatRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const [rooms, conversation] = await Promise.all([
    ChatService.getAdminChatRooms(session.user.id),
    ChatService.getRoomConversation(roomId, session.user.id),
  ]);

  if (!conversation.allowed) {
    notFound();
  }

  return (
    <AdminChatView
      rooms={rooms}
      selectedRoomId={roomId}
      initialMessages={conversation.messages}
      currentUserId={session.user.id}
      otherUserName={conversation.otherName}
      orderInfo={conversation.order || undefined}
    />
  );
}
