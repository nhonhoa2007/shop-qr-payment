import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { redirect } from 'next/navigation';
import { ChatService } from '@/server/modules/chat/chat.service';
import { ChatView } from '@client/views/ChatView';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tin nhắn & Hỗ trợ | Shop QR',
};

export default async function ChatPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const rooms = await ChatService.getCustomerChatRooms(session.user.id);

  return <ChatView rooms={rooms} />;
}
