import { NextResponse } from 'next/server';
import { prisma } from '@server/database/prisma';
import { normalizeEmail, sendOtp } from '@/lib/otp';
import { checkDistributedRateLimit, getClientIp } from '@server/infrastructure/rate-limit';

interface ForgotPasswordBody {
  email?: unknown;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    const rateLimit = await checkDistributedRateLimit(`forgot-password:${clientIp}`, 3, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Bạn đang thao tác quá nhanh. Vui lòng thử lại sau 1 phút.' },
        { status: 429 }
      );
    }

    const body = (await req.json()) as ForgotPasswordBody;
    const rawEmail = normalizeText(body.email);
    if (!rawEmail || !rawEmail.includes('@')) {
      return NextResponse.json({ error: 'Email không hợp lệ' }, { status: 400 });
    }

    const email = normalizeEmail(rawEmail);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json({ error: 'Email không tồn tại trong hệ thống' }, { status: 404 });
    }

    if (user.isBlocked) {
      return NextResponse.json(
        { error: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.' },
        { status: 403 }
      );
    }

    const result = await sendOtp(email, user.name || 'Khách hàng', 'PASSWORD_RESET');
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Gửi mã OTP thất bại' }, { status: 429 });
    }

    return NextResponse.json({
      success: true,
      message: 'Mã xác thực đã được gửi tới email của bạn',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
