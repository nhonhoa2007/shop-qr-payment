import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { markAllAsRead, markAsRead } from '@/lib/notifications';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ notifications });
  } catch {
    return NextResponse.json({ error: 'Lỗi' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, notificationId } = await req.json();
    if (action === 'markAllRead') {
      await markAllAsRead(session.user.id);
    } else if (action === 'markRead' && notificationId) {
      await markAsRead(notificationId, session.user.id);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Lỗi' }, { status: 500 });
  }
}
