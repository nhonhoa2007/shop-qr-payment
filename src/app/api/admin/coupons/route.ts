import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { userUsages: true, orders: true },
        },
      },
    });

    return NextResponse.json({ coupons });
  } catch (error) {
    console.error('Fetch coupons error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      code,
      description,
      discountType,
      discountValue,
      maxDiscount,
      minOrderAmount,
      usageLimit,
      perUserLimit,
      startDate,
      endDate,
      isActive,
    } = body;

    if (!code || discountValue <= 0) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 });
    }

    const newCoupon = await prisma.coupon.create({
      data: {
        code: code.trim().toUpperCase(),
        description,
        discountType,
        discountValue,
        maxDiscount,
        minOrderAmount: minOrderAmount || 0,
        usageLimit: usageLimit || 100,
        perUserLimit: perUserLimit || 1,
        startDate: start,
        endDate: end,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(newCoupon, { status: 201 });
  } catch (error: unknown) {
    console.error('Create coupon error:', error);
    const errObj = error as { code?: string };
    if (errObj.code === 'P2002') {
      return NextResponse.json({ error: 'Mã giảm giá đã tồn tại' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, isActive } = body;

    if (!id || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'Thiếu ID hoặc trạng thái isActive' }, { status: 400 });
    }

    const updated = await prisma.coupon.update({
      where: { id },
      data: { isActive },
    });

    return NextResponse.json({ success: true, coupon: updated });
  } catch (error: unknown) {
    console.error('Update coupon error:', error);
    return NextResponse.json({ error: 'Lỗi cập nhật mã giảm giá' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing coupon ID' }, { status: 400 });
    }

    // Check if coupon has been used in orders or couponUsages
    const usagesCount = await prisma.couponUsage.count({ where: { couponId: id } });
    const ordersCount = await prisma.order.count({ where: { couponId: id } });

    if (usagesCount > 0 || ordersCount > 0) {
      // Soft-deactivate to protect relational order history
      const updated = await prisma.coupon.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        success: true,
        softDeactivated: true,
        message: 'Mã giảm giá đã có đơn hàng sử dụng trong lịch sử. Hệ thống đã chuyển sang Vô hiệu hóa (Tắt) thay vì xóa cứng.',
        coupon: updated,
      });
    }

    await prisma.coupon.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Đã xóa mã giảm giá thành công' });
  } catch (error: unknown) {
    console.error('Delete coupon error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
