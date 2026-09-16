import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const items = await prisma.wishlist.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        product: true,
      },
      orderBy: {
        createdAt: 'desc',
      }
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Get wishlist error:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { productId } = body;

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ error: 'productId không hợp lệ' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404 });
    }

    await prisma.wishlist.upsert({
      where: {
        userId_productId: {
          userId: session.user.id,
          productId,
        }
      },
      create: {
        userId: session.user.id,
        productId,
      },
      update: {}
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let productId = searchParams.get('productId');

    if (!productId) {
      try {
        const body = await req.json();
        productId = body?.productId ?? null;
      } catch {
        // ignore if body is empty or not JSON
      }
    }

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ error: 'productId không hợp lệ' }, { status: 400 });
    }

    await prisma.wishlist.deleteMany({
      where: {
        userId: session.user.id,
        productId,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}