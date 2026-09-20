import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@server/database/prisma';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const product = await prisma.product.findUnique({
      where: { id }
    });
    
    if (!product) {
      return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404 });
    }

    const reviews = await prisma.review.findMany({
      where: {
        productId: id,
        isApproved: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      }
    });

    const total = reviews.length;
    let avgRating = 0;
    if (total > 0) {
      const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
      avgRating = Number((sum / total).toFixed(1));
    }

    return NextResponse.json({
      reviews,
      avgRating,
      total,
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { rating, comment, images, orderId } = body;

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating không hợp lệ (1-5)' }, { status: 400 });
    }
    
    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'orderId không hợp lệ' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id }
    });
    
    if (!product) {
      return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Không tìm thấy đơn hàng' }, { status: 404 });
    }

    if (order.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (order.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Đơn hàng phải ở trạng thái COMPLETED' }, { status: 400 });
    }

    const hasPurchasedProduct = order.items.some((item) => item.productId === id);
    if (!hasPurchasedProduct) {
      return NextResponse.json({ error: 'Bạn chỉ có thể đánh giá sản phẩm đã mua trong đơn hàng này' }, { status: 403 });
    }

    const existingReview = await prisma.review.findFirst({
      where: {
        productId: id,
        userId: session.user.id,
        orderId: orderId,
      }
    });

    if (existingReview) {
      return NextResponse.json({ error: 'Bạn đã đánh giá sản phẩm này trong đơn hàng này' }, { status: 400 });
    }

    const review = await prisma.review.create({
      data: {
        productId: id,
        userId: session.user.id,
        orderId,
        rating,
        comment: comment || null,
        images: Array.isArray(images) ? images : [],
      }
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error('Create review error:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}
