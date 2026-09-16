import { ForgotPasswordView } from '@/client/views/auth/ForgotPasswordView';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Quên mật khẩu | Shop QR',
  description: 'Khôi phục mật khẩu tài khoản Shop QR bằng mã xác thực email',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordView />;
}
