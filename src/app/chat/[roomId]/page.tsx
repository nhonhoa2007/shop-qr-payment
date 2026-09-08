import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect, notFound } from 'next/navigation';
import { ChatWindow } from '@/components/chat/ChatWindow';
import type { Message } from '@/types';

export const dynamic = 'force-dynamic';

export default async function ChatRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const participant = await prisma.chatRoomParticipant.findUnique({
    where: { roomId_userId: { roomId, userId: session.user.id } },
  });
  if (!participant) notFound();

  const messages = await prisma.message.findMany({
    where: { roomId },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: {
      order: { select: { orderCode: true } },
      participants: {
        where: { userId: { not: session.user.id } },
        include: { user: { select: { name: true } } },
      },
    },
  });

  const otherName = room?.participants[0]?.user?.name || (room?.order ? `Đơn ${room.order.orderCode}` : 'Chat');
  const serializedMessages: Message[] = messages.map((message) => ({
    ...message,
    createdAt: message.createdAt.toISOString(),
  }));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <ChatWindow
        roomId={roomId}
        currentUserId={session.user.id}
        initialMessages={serializedMessages}
        otherUserName={otherName}
      />
    </div>
  );
}
