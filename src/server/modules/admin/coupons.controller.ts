import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { prisma } from '@server/database/prisma';
import { serializeCouponDto } from '@server/modules/money/money-serialization';
import { parseMoneyVnd } from '@shared/utils/money';

function isCouponInteger(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= 2147483647;
}

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
          select: { orders: true },
        },
      },
    });

    return NextResponse.json({ coupons: coupons.map(serializeCouponDto) });
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
      isPublic,
    } = body;

    if (typeof code !== 'string' || !code.trim()) {
      return NextResponse.json({ error: 'Vui lòng nhập mã giảm giá' }, { status: 400 });
    }
    if (!['FIXED', 'PERCENTAGE', 'FREE_SHIPPING'].includes(discountType)) {
      return NextResponse.json({ error: 'Loại giảm giá không hợp lệ' }, { status: 400 });
    }
    if (!isCouponInteger(discountValue, discountType === 'FREE_SHIPPING' ? 0 : 1)) {
      return NextResponse.json({ error: 'Mức giảm phải là số nguyên dương; mã miễn phí vận chuyển có thể dùng mức giảm 0' }, { status: 400 });
    }
    if (discountType === 'PERCENTAGE' && discountValue > 100) {
      return NextResponse.json({ error: 'Mức giảm theo phần trăm phải từ 1 đến 100' }, { status: 400 });
    }
    if ((isPublic !== undefined && typeof isPublic !== 'boolean') ||
      (isActive !== undefined && typeof isActive !== 'boolean')) {
      return NextResponse.json({ error: 'Trạng thái mã giảm giá không hợp lệ' }, { status: 400 });
    }
    if ((usageLimit != null && !isCouponInteger(usageLimit, 1)) ||
      (perUserLimit != null && !isCouponInteger(perUserLimit, 1))) {
      return NextResponse.json({ error: 'Số lượt sử dụng phải là số nguyên dương' }, { status: 400 });
    }

    let minimumAmount: bigint;
    let maximumDiscount: bigint | null;
    try {
      minimumAmount = parseMoneyVnd(minOrderAmount ?? 0, 'minOrderAmount');
    } catch {
      return NextResponse.json({ error: 'Giá trị đơn tối thiểu phải là số nguyên không âm hợp lệ' }, { status: 400 });
    }
    try {
      maximumDiscount = maxDiscount == null ? null : parseMoneyVnd(maxDiscount, 'maxDiscount');
    } catch {
      return NextResponse.json({ error: 'Mức giảm tối đa phải là số nguyên không âm hợp lệ' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (typeof startDate !== 'string' || typeof endDate !== 'string' ||
      !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      return NextResponse.json({ error: 'Ngày bắt đầu và ngày kết thúc không hợp lệ' }, { status: 400 });
    }
    if (start >= end) {
      return NextResponse.json({ error: 'Ngày bắt đầu phải trước ngày kết thúc' }, { status: 400 });
    }

    const newCoupon = await prisma.coupon.create({
      data: {
        code: code.trim().toUpperCase(),
        description,
        discountType,
        discountValue: discountType === 'FREE_SHIPPING' ? 0 : discountValue,
        fixedDiscountAmount: discountType === 'FIXED' ? BigInt(discountValue) : null,
        percentageRate: discountType === 'PERCENTAGE' ? discountValue : null,
        maxDiscount: maximumDiscount,
        minOrderAmount: minimumAmount,
        usageLimit: usageLimit ?? 100,
        perUserLimit: perUserLimit ?? 1,
        startDate: start,
        endDate: end,
        isActive: isActive ?? true,
        isPublic: isPublic ?? false,
      },
    });

    return NextResponse.json(serializeCouponDto(newCoupon), { status: 201 });
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
    const { id, isActive, isPublic } = body;

    if (typeof id !== 'string' || !id ||
      (isActive === undefined && isPublic === undefined) ||
      (isActive !== undefined && typeof isActive !== 'boolean') ||
      (isPublic !== undefined && typeof isPublic !== 'boolean')) {
      return NextResponse.json({ error: 'Thiếu ID hoặc trạng thái voucher không hợp lệ' }, { status: 400 });
    }

    const updated = await prisma.coupon.update({
      where: { id },
      data: { ...(isActive === undefined ? {} : { isActive }), ...(isPublic === undefined ? {} : { isPublic }) },
    });

    return NextResponse.json({ success: true, coupon: serializeCouponDto(updated) });
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

    // Check if coupon has been used in orders
    const ordersCount = await prisma.order.count({ where: { couponId: id } });

    if (ordersCount > 0) {
      // Soft-deactivate to protect relational order history
      const updated = await prisma.coupon.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        success: true,
        softDeactivated: true,
        message: 'Mã giảm giá đã có đơn hàng sử dụng trong lịch sử. Hệ thống đã chuyển sang Vô hiệu hóa (Tắt) thay vì xóa cứng.',
        coupon: serializeCouponDto(updated),
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
