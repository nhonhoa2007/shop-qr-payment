'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { GoogleIcon } from './GoogleIcon';
import { ArrowRight, ShieldAlert } from 'lucide-react';

// Chỉ chấp nhận đường dẫn nội bộ tuyệt đối để tránh open-redirect
function sanitizeCallbackUrl(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/';
}

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(searchParams.get('callbackUrl'));
  const needsPermission = searchParams.get('reason') === 'permission';
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (result?.error) {
        if (
          result.error.toLowerCase().includes('khóa') ||
          result.error.toLowerCase().includes('blocked') ||
          result.error.includes('TÀI_KHOẢN_BỊ_KHÓA')
        ) {
          setError('Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ quản trị viên.');
        } else if (result.error === 'CredentialsSignin') {
          setError('Email hoặc mật khẩu không đúng');
        } else {
          setError(result.error);
        }
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError('Lỗi kết nối, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signIn('google', { callbackUrl });
    } catch {
      setError('Lỗi kết nối đến Google, vui lòng thử lại');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-[28px] shadow-card p-8 sm:p-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1 mb-2">
            <span className="font-semibold text-2xl tracking-[-0.05em] text-ink-black">shop</span>
            <span className="w-1.5 h-1.5 rounded-full bg-shop-violet mt-2.5" />
          </div>
          <h1 className="text-xl font-semibold text-ink-black tracking-[-0.05em]">Đăng nhập</h1>
          <p className="text-xs text-muted-gray mt-1 tracking-[-0.014em]">Chào mừng bạn quay lại mua sắm</p>
        </div>

        {needsPermission && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-2xl mb-6 text-xs tracking-[-0.014em]">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Bạn cần đăng nhập bằng tài khoản quản trị viên để truy cập khu vực này.</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-full mb-6 text-xs tracking-[-0.014em]">
            {error}
          </div>
        )}

        {process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === 'true' && (
          <>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
              className="w-full flex items-center justify-center gap-3 bg-white border border-faint-border text-ink-black py-3 rounded-full text-xs font-medium hover:bg-canvas-mist disabled:opacity-40 transition shadow-soft-sm tracking-[-0.014em]"
            >
              <GoogleIcon className="w-4 h-4" />
              <span>{googleLoading ? 'Đang chuyển hướng...' : 'Tiếp tục với Google'}</span>
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-faint-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-muted-gray tracking-[-0.017em]">hoặc email</span>
              </div>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-medium text-muted-gray mb-1 tracking-[-0.014em]"
            >
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-2.5 rounded-full border border-ink-black/10 bg-white text-xs text-ink-black placeholder:text-muted-gray focus:outline-none focus:border-shop-violet/40 transition tracking-[-0.014em]"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-muted-gray tracking-[-0.014em]"
              >
                Mật khẩu
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-shop-violet hover:underline font-medium tracking-[-0.014em]"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <input
              id="login-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-2.5 rounded-full border border-ink-black/10 bg-white text-xs text-ink-black placeholder:text-muted-gray focus:outline-none focus:border-shop-violet/40 transition tracking-[-0.014em]"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full bg-ink-black text-white py-3 rounded-full text-xs font-medium hover:bg-slate-ink disabled:opacity-40 transition flex items-center justify-center gap-1.5 tracking-[-0.014em]"
          >
            <span>{loading ? 'Đang xử lý...' : 'Đăng nhập'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <p className="text-center text-xs text-muted-gray mt-6 tracking-[-0.014em]">
          Chưa có tài khoản?{' '}
          <Link href="/register" className="text-ink-black font-semibold hover:underline">
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
}

// useSearchParams yêu cầu Suspense boundary khi trang được prerender tĩnh
export function LoginForm() {
  return (
    <Suspense fallback={<div className="w-full max-w-md mx-auto" aria-hidden="true" />}>
      <LoginFormInner />
    </Suspense>
  );
}

export default LoginForm;
