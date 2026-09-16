import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { normalizeEmail, verifyOtp } from '@/lib/otp';
import { checkDistributedRateLimit, getClientIp } from '@/lib/rate-limit';
import { createNotification } from '@/lib/notifications';

interface ResetPasswordBody {
  email?: unknown;
  otp?: unknown;
  newPassword?: unknown;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    const rateLimit = await checkDistributedRateLimit(`reset-password:${clientIp}`, 5, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Bạn đang thao tác quá nhanh. Vui lòng thử lại sau 1 phút.' },
        { status: 429 }
      );
    }

    const body = (await req.json()) as ResetPasswordBody;
    const rawEmail = normalizeText(body.email);
    const otp = normalizeText(body.otp);
    const newPassword = normalizeText(body.newPassword);

    if (!rawEmail || !otp || !newPassword) {
      return NextResponse.json({ error: 'Vui lòng cung cấp đầy đủ thông tin' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Mật khẩu mới phải có ít nhất 6 ký tự' },
        { status: 400 }
      );
    }

    const email = normalizeEmail(rawEmail);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json({ error: 'Người dùng không tồn tại' }, { status: 404 });
    }

    if (user.isBlocked) {
      return NextResponse.json(
        { error: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.' },
        { status: 403 }
      );
    }

    const isValid = await verifyOtp(email, otp, 'PASSWORD_RESET');
    if (!isValid) {
      return NextResponse.json(
        { error: 'Mã xác thực không hợp lệ hoặc đã hết hạn' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        // If the user was somehow unverified, resetting password with email OTP proves ownership
        isVerified: true,
      },
    });

    try {
      await createNotification({
        userId: user.id,
        type: 'OTP_SENT',
        title: 'Đổi mật khẩu thành công',
        message: 'Mật khẩu tài khoản của bạn đã được thay đổi thành công.',
      });
    } catch (notifErr) {
      console.error('Failed to create password reset notification:', notifErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
