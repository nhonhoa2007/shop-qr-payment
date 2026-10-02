import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@server/database/prisma';
import { authOptions } from '@server/modules/auth/auth-options';
import {
  validateReviewSubmissionInput,
  resolveReviewEligibility,
} from './review.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
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
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const total = reviews.length;
    let avgRating = 0;
    if (total > 0) {
      const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
      avgRating = Number((sum / total).toFixed(1));
    }

    // Eligibility check for authenticated user
    let canReview = false;
    let eligibleOrders: Array<{ id: string; orderCode: string; createdAt: Date | string }> = [];
    let alreadyReviewedAll = false;

    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      const userOrders = await prisma.order.findMany({
        where: {
          userId: session.user.id,
          items: {
            some: { productId: id },
          },
        },
        include: {
          items: {
            where: { productId: id },
            select: { productId: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const existingReviews = await prisma.review.findMany({
        where: {
          productId: id,
          userId: session.user.id,
        },
        select: {
          orderId: true,
        },
      });

      const eligibility = resolveReviewEligibility({
        userId: session.user.id,
        productId: id,
        userOrders,
        existingReviews,
      });

      canReview = eligibility.eligible;
      alreadyReviewedAll = !!eligibility.alreadyReviewedAll;
      if (eligibility.availableOrders) {
        eligibleOrders = eligibility.availableOrders;
      }
    }

    return NextResponse.json({
      reviews,
      avgRating,
      total,
      canReview,
      eligibleOrders,
      alreadyReviewedAll,
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
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const validation = validateReviewSubmissionInput(body);
    if (!validation.valid || !validation.data) {
      return NextResponse.json({ error: validation.error || 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    const { rating, comment, images, orderId } = validation.data;

    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404 });
    }

    // Retrieve order candidate(s)
    const userOrders = orderId
      ? await prisma.order.findMany({
          where: { id: orderId },
          include: {
            items: {
              select: { productId: true },
            },
          },
        })
      : await prisma.order.findMany({
          where: {
            userId: session.user.id,
            items: {
              some: { productId: id },
            },
          },
          include: {
            items: {
              select: { productId: true },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

    const existingReviews = await prisma.review.findMany({
      where: {
        productId: id,
        userId: session.user.id,
      },
      select: {
        orderId: true,
      },
    });

    const eligibility = resolveReviewEligibility({
      userId: session.user.id,
      productId: id,
      userOrders,
      existingReviews,
      requestedOrderId: orderId,
    });

    if (!eligibility.eligible || !eligibility.selectedOrderId) {
      return NextResponse.json(
        { error: eligibility.error || 'Không đủ điều kiện đánh giá sản phẩm' },
        { status: eligibility.statusCode || 400 }
      );
    }

    const review = await prisma.review.create({
      data: {
        productId: id,
        userId: session.user.id,
        orderId: eligibility.selectedOrderId,
        rating,
        comment,
        images,
      },
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error('Create review error:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}
