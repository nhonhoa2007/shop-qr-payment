import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { ChatRoomList } from '@/components/chat/ChatRoomList';
import type { ChatRoom } from '@/types';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const rooms: ChatRoom[] = await prisma.chatRoom.findMany({
    where: { participants: { some: { userId: session.user.id } } },
    include: {
      order: { select: { orderCode: true } },
      participants: {
        where: { userId: { not: session.user.id } },
        include: { user: { select: { id: true, name: true, avatar: true } } },
      },
    },
    orderBy: { lastActiveAt: 'desc' },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">💬 Tin nhắn</h1>
      {rooms.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
          <span className="text-5xl block mb-4">💬</span>
          <p className="text-gray-500">Chưa có cuộc trò chuyện nào</p>
          <p className="text-sm text-gray-400 mt-2">Chat room sẽ được tạo tự động khi bạn đặt đơn hàng</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <ChatRoomList rooms={rooms} />
        </div>
      )}
    </div>
  );
}
