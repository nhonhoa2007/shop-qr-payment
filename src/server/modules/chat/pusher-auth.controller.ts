import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@server/database/prisma';
import { pusherServer } from '@server/infrastructure/pusher';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const formData = await req.formData();
    const socketId = formData.get('socket_id') as string;
    const channelName = formData.get('channel_name') as string;

    if (channelName === 'private-admin-channel' || channelName.startsWith('private-admin-')) {
      if (session.user.role !== 'ADMIN') return new Response('Forbidden', { status: 403 });
    }

    if (channelName.startsWith('private-chat-')) {
      const roomId = channelName.replace('private-chat-', '');
      const participant = await prisma.chatRoomParticipant.findUnique({
        where: { roomId_userId: { roomId, userId: session.user.id } },
      });
      if (!participant) return new Response('Forbidden', { status: 403 });
    }

    if (channelName.startsWith('private-user-')) {
      const userId = channelName.replace('private-user-', '');
      if (userId !== session.user.id) return new Response('Forbidden', { status: 403 });
    }

    const auth = pusherServer.authorizeChannel(socketId, channelName);
    return NextResponse.json(auth);
  } catch (error) {
    console.error('Pusher auth error:', error);
    return new Response('Internal Error', { status: 500 });
  }
}
