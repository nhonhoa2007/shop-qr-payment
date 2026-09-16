import { prisma } from './prisma';
import { resend } from './resend';
import { OtpVerificationEmail } from '@/emails/OtpVerification';
import { PasswordResetEmail } from '@/emails/PasswordResetEmail';
import {
  normalizeEmail,
  generateOtp,
  sendOtpCore,
  verifyOtpCore,
  type OtpType,
} from './password-reset';

export { normalizeEmail, generateOtp };
export type { OtpType };

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
  name: string,
  type: OtpType = 'REGISTRATION'
): Promise<{ success: boolean; error?: string }> {
  return sendOtpCore({
    rawEmail,
    name,
    type,
    prismaOtp: prisma.otpCode as unknown as Parameters<typeof sendOtpCore>[0]['prismaOtp'],
    sendEmailFn: async (otp, email, recipientName) => {
      try {
        const fromAddress = process.env.EMAIL_FROM || 'Shop QR <noreply@nhonhoadev.id.vn>';
        const subject =
          type === 'PASSWORD_RESET'
            ? `Mã xác thực đặt lại mật khẩu: ${otp}`
            : `Mã xác thực: ${otp}`;
        const react =
          type === 'PASSWORD_RESET'
            ? PasswordResetEmail({ name: recipientName, otp })
            : OtpVerificationEmail({ name: recipientName, otp });

        const { data, error } = await resend.emails.send({
          from: fromAddress,
          to: email,
          subject,
          react,
        });

        if (error) {
          console.error('Resend error details:', JSON.stringify(error, null, 2));
          return { success: false, error: error.message || 'Gửi email thất bại' };
        }

        if (process.env.NODE_ENV === 'development') {
          console.log(`[Resend] Đã gửi OTP (${type}) thành công tới ${email} (ID: ${data?.id}), mã: ${otp}`);
        }

        return { success: true };
      } catch (err) {
        console.error('Email send exception:', err);
        return { success: false, error: 'Gửi email thất bại' };
      }
    },
  });
}

export async function verifyOtp(
  rawEmail: string,
  inputOtp: string,
  type: OtpType = 'REGISTRATION'
): Promise<boolean> {
  return verifyOtpCore({
    rawEmail,
    inputOtp,
    type,
    prismaOtp: prisma.otpCode as unknown as Parameters<typeof verifyOtpCore>[0]['prismaOtp'],
  });
}
