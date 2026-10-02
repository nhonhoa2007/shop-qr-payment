'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GoogleIcon } from './GoogleIcon';
import { ArrowRight } from 'lucide-react';

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    if (form.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Đăng ký thất bại');
        return;
      }
      router.push(`/verify-otp?email=${encodeURIComponent(form.email)}`);
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
      await signIn('google', { callbackUrl: '/' });
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
          <h1 className="text-xl font-semibold text-ink-black tracking-[-0.05em]">Tạo tài khoản</h1>
          <p className="text-xs text-muted-gray mt-1 tracking-[-0.014em]">Trải nghiệm mua sắm nhanh chóng và tiện lợi</p>
        </div>

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
              <span>{googleLoading ? 'Đang chuyển hướng...' : 'Đăng ký nhanh với Google'}</span>
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
              htmlFor="register-name"
              className="block text-xs font-medium text-muted-gray mb-1 tracking-[-0.014em]"
            >
              Họ và tên
            </label>
            <input
              id="register-name"
              name="name"
              type="text"
              required
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-full border border-ink-black/10 bg-white text-xs text-ink-black placeholder:text-muted-gray focus:outline-none focus:border-shop-violet/40 transition tracking-[-0.014em]"
              placeholder="Nguyễn Văn A"
            />
          </div>
          <div>
            <label
              htmlFor="register-email"
              className="block text-xs font-medium text-muted-gray mb-1 tracking-[-0.014em]"
            >
              Email
            </label>
            <input
              id="register-email"
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
            <label
              htmlFor="register-password"
              className="block text-xs font-medium text-muted-gray mb-1 tracking-[-0.014em]"
            >
              Mật khẩu
            </label>
            <input
              id="register-password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              aria-describedby="register-password-hint"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-2.5 rounded-full border border-ink-black/10 bg-white text-xs text-ink-black placeholder:text-muted-gray focus:outline-none focus:border-shop-violet/40 transition tracking-[-0.014em]"
              placeholder="Ít nhất 6 ký tự"
            />
            <p id="register-password-hint" className="sr-only">
              Mật khẩu phải có ít nhất 6 ký tự
            </p>
          </div>
          <div>
            <label
              htmlFor="register-confirm-password"
              className="block text-xs font-medium text-muted-gray mb-1 tracking-[-0.014em]"
            >
              Xác nhận mật khẩu
            </label>
            <input
              id="register-confirm-password"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              className="w-full px-4 py-2.5 rounded-full border border-ink-black/10 bg-white text-xs text-ink-black placeholder:text-muted-gray focus:outline-none focus:border-shop-violet/40 transition tracking-[-0.014em]"
              placeholder="Nhập lại mật khẩu"
            />
          </div>
          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full bg-ink-black text-white py-3 rounded-full text-xs font-medium hover:bg-slate-ink disabled:opacity-40 transition flex items-center justify-center gap-1.5 tracking-[-0.014em]"
          >
            <span>{loading ? 'Đang xử lý...' : 'Đăng ký tài khoản'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <p className="text-center text-xs text-muted-gray mt-6 tracking-[-0.014em]">
          Đã có tài khoản?{' '}
          <Link href="/login" className="text-ink-black font-semibold hover:underline">
            Đăng nhập ngay
          </Link>
        </p>
      </div>
    </div>
  );
}
