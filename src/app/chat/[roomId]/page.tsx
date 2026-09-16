import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect, notFound } from 'next/navigation';
import { ChatService } from '@/server/modules/chat/chat.service';
import { ChatRoomView } from '@/client/views/ChatRoomView';

export const dynamic = 'force-dynamic';

export default async function ChatRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const conversation = await ChatService.getRoomConversation(roomId, session.user.id);
  if (!conversation.allowed) {
    notFound();
  }

  return (
    <ChatRoomView
      roomId={roomId}
      currentUserId={session.user.id}
      initialMessages={conversation.messages}
      otherUserName={conversation.otherName}
    />
  );
}
