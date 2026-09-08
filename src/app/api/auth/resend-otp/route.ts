import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendOtp } from '@/lib/otp';

interface ResendOtpBody {
  email?: unknown;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ResendOtpBody;
    const email = normalizeText(body.email).toLowerCase();
    if (!email) return NextResponse.json({ error: 'Thiếu email' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: 'Email không tồn tại' }, { status: 404 });
    if (user.isVerified) return NextResponse.json({ error: 'Tài khoản đã được xác thực' }, { status: 400 });

    const result = await sendOtp(email, user.name || 'User');
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 429 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
