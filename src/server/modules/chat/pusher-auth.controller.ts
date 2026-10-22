import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@server/database/prisma';
import { pusherServer } from '@server/infrastructure/pusher';
import { authOptions } from '@server/modules/auth/auth-options';
import { resolveOperatorAccess } from '@server/modules/admin/guards';

interface ChannelUser {
  id: string;
  role: string;
  permissions?: readonly string[];
}

interface ChannelRoom {
  customerId: string | null;
  assignedStaffId: string | null;
}

export async function canSubscribeToChannel(
  channelName: string,
  user: ChannelUser,
  findRoom: (roomId: string) => Promise<ChannelRoom | null>
): Promise<boolean> {
  if (channelName === 'private-admin-channel') return user.role === 'ADMIN';

  if (channelName.startsWith('private-user-')) {
    return channelName.slice('private-user-'.length) === user.id;
  }

  if (channelName.startsWith('private-chat-')) {
    const roomId = channelName.slice('private-chat-'.length);
    if (!roomId) return false;
    const room = await findRoom(roomId);
    return Boolean(
      (room && (room.customerId === user.id || room.assignedStaffId === user.id)) ||
      (room && resolveOperatorAccess(user, 'chat'))
    );
  }

  return false;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const formData = await req.formData();
    const socketId = formData.get('socket_id');
    const channelName = formData.get('channel_name');
    if (typeof socketId !== 'string' || !socketId || typeof channelName !== 'string') {
      return new Response('Bad Request', { status: 400 });
    }

    const allowed = await canSubscribeToChannel(channelName, session.user, (roomId) =>
      prisma.chatRoom.findUnique({ where: { id: roomId } })
    );
    if (!allowed) return new Response('Forbidden', { status: 403 });

    const auth = pusherServer.authorizeChannel(socketId, channelName);
    return NextResponse.json(auth);
  } catch (error) {
    console.error('Pusher auth error:', error);
    return new Response('Internal Error', { status: 500 });
  }
}
