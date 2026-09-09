import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { resend } from './resend';
import { OtpVerificationEmail } from '@/emails/OtpVerification';
import { normalizeEmail, generateOtp } from './otp-utils';
export { normalizeEmail, generateOtp };

const OTP_COOLDOWN_MS = 60_000;
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

export async function cleanupExpiredOtps(email?: string): Promise<void> {
  await prisma.otpCode.deleteMany({
    where: {
      ...(email ? { email } : {}),
      OR: [{ expiresAt: { lt: new Date() } }, { used: true }],
    },
  });
}

export async function sendOtp(
  rawEmail: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  const email = normalizeEmail(rawEmail);
  await cleanupExpiredOtps(email);

  const lastOtp = await prisma.otpCode.findFirst({
    where: { email, type: 'REGISTRATION' },
    orderBy: { createdAt: 'desc' },
  });

  if (lastOtp && Date.now() - lastOtp.createdAt.getTime() < OTP_COOLDOWN_MS) {
    return { success: false, error: 'Vui lòng đợi 60 giây trước khi gửi lại' };
  }

  const otp = generateOtp();
  const hashedOtp = await bcrypt.hash(otp, 10);

  await prisma.otpCode.create({
    data: {
      email,
      code: hashedOtp,
      type: 'REGISTRATION',
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  try {
    const fromAddress = process.env.EMAIL_FROM || 'Shop QR <noreply@nhonhoadev.id.vn>';
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: email,
      subject: `Mã xác thực: ${otp}`,
      react: OtpVerificationEmail({ name, otp }),
    });

    if (error) {
      console.error('Resend error details:', JSON.stringify(error, null, 2));
      return { success: false, error: error.message || 'Gửi email thất bại' };
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Resend] Đã gửi OTP thành công tới ${email} (ID: ${data?.id}), mã: ${otp}`);
    }

    return { success: true };
  } catch (err) {
    console.error('Email send exception:', err);
    return { success: false, error: 'Gửi email thất bại' };
  }
}

export async function verifyOtp(rawEmail: string, inputOtp: string): Promise<boolean> {
  const email = normalizeEmail(rawEmail);
  await cleanupExpiredOtps(email);

  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      email,
      type: 'REGISTRATION',
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord || otpRecord.attempts >= MAX_OTP_ATTEMPTS) return false;

  const isValid = await bcrypt.compare(inputOtp, otpRecord.code);
  if (isValid) {
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });
    return true;
  }

  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { attempts: { increment: 1 } },
  });

  return false;
}
