import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@server/database/prisma';
import { validateReviewModeration } from '@/lib/review-moderation';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const approvedParam = searchParams.get('approved');
    const ratingParam = searchParams.get('rating');

    const reviews = await prisma.review.findMany({
      where: {
        ...(approvedParam === 'true' ? { isApproved: true } : {}),
        ...(approvedParam === 'false' ? { isApproved: false } : {}),
        ...(ratingParam && !isNaN(Number(ratingParam)) ? { rating: Number(ratingParam) } : {}),
        ...(search
          ? {
              OR: [
                { comment: { contains: search, mode: 'insensitive' } },
                { reply: { contains: search, mode: 'insensitive' } },
                { product: { name: { contains: search, mode: 'insensitive' } } },
                { user: { name: { contains: search, mode: 'insensitive' } } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            image: true,
            price: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ reviews });
  } catch (error: unknown) {
    console.error('Fetch admin reviews error:', error);
    return NextResponse.json({ error: 'Lỗi tải danh sách đánh giá' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const body = await req.json();
    const validation = validateReviewModeration(body);
    if (!validation.valid || !validation.data) {
      return NextResponse.json({ error: validation.error || 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    const { id, isApproved, reply } = validation.data;

    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Không tìm thấy đánh giá' }, { status: 404 });
    }

    const updated = await prisma.review.update({
      where: { id },
      data: {
        ...(typeof isApproved === 'boolean' ? { isApproved } : {}),
        ...(reply !== undefined ? { reply } : {}),
      },
      include: {
        product: { select: { id: true, name: true, image: true, price: true } },
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    return NextResponse.json({ success: true, review: updated });
  } catch (error: unknown) {
    console.error('Update review error:', error);
    return NextResponse.json({ error: 'Lỗi cập nhật đánh giá' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Thiếu ID đánh giá' }, { status: 400 });
    }

    await prisma.review.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete review error:', error);
    return NextResponse.json({ error: 'Lỗi xóa đánh giá' }, { status: 500 });
  }
}
