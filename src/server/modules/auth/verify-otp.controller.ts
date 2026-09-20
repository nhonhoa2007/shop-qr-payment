import { NextResponse } from 'next/server';
import { prisma } from '@server/database/prisma';
import { verifyOtp } from '@/lib/otp';
import { createNotification } from '@server/modules/notifications/notifications.service';

interface VerifyOtpBody {
  email?: unknown;
  otp?: unknown;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as VerifyOtpBody;
    const email = normalizeText(body.email).toLowerCase();
    const otp = normalizeText(body.otp);

    if (!email || !otp) {
      return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });
    }

    const isValid = await verifyOtp(email, otp);
    if (!isValid) {
      return NextResponse.json({ error: 'Mã OTP không hợp lệ hoặc đã hết hạn' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { email },
      data: { isVerified: true },
    });

    await createNotification({
      userId: user.id,
      type: 'ORDER_CONFIRMED',
      title: 'Chào mừng bạn!',
      message: 'Tài khoản đã được xác thực thành công. Chúc bạn mua sắm vui vẻ!',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
