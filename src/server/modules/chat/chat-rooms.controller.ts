import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@server/database/prisma';
import { authOptions } from '@server/modules/auth/auth-options';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const hasParticipants = 'chatRoomParticipant' in prisma;
    const rooms = await (prisma as any).chatRoom.findMany({
      where: {
        OR: [
          { customerId: session.user.id },
          { assignedStaffId: session.user.id },
          ...(hasParticipants ? [{ participants: { some: { userId: session.user.id } } }] : []),
        ],
      },
      include: {
        order: { select: { orderCode: true } },
        customer: { select: { id: true, name: true, avatar: true } },
        assignedStaff: { select: { id: true, name: true, avatar: true } },
        ...(hasParticipants
          ? {
              participants: {
                where: { userId: { not: session.user.id } },
                include: { user: { select: { id: true, name: true, avatar: true } } },
              },
            }
          : {}),
        _count: { select: { messages: true } },
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    const mappedRooms = rooms.map((room: any) => {
      const otherUser = room.customerId === session.user.id ? room.assignedStaff : room.customer;
      const participants =
        room.participants && room.participants.length > 0
          ? room.participants
          : [otherUser ? { user: otherUser } : null].filter(Boolean);

      return {
        ...room,
        participants,
      };
    });

    return NextResponse.json({ rooms: mappedRooms });
  } catch (error) {
    console.error('Get chat rooms error:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
