import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { normalizeEmail, sendOtp } from '@/lib/otp';
import { checkDistributedRateLimit, getClientIp } from '@/lib/rate-limit';

interface RegisterBody {
  name?: unknown;
  email?: unknown;
  password?: unknown;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    const rateLimit = await checkDistributedRateLimit(`register:${clientIp}`, 5, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau 1 phút.' },
        { status: 429 }
      );
    }

    const body = (await req.json()) as RegisterBody;
    const name = normalizeText(body.name);
    const email = normalizeEmail(normalizeText(body.email));
    const password = normalizeText(body.password);

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ thông tin' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing?.isVerified) {
      return NextResponse.json({ error: 'Email đã được sử dụng' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash, name },
      create: { email, passwordHash, name, isVerified: false },
    });

    const result = await sendOtp(email, name);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 429 });
    }

    return NextResponse.json({ success: true, email });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
