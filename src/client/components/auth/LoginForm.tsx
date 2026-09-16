'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GoogleIcon } from './GoogleIcon';
import { ArrowRight } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
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
        router.push('/');
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
      await signIn('google', { callbackUrl: '/' });
    } catch {
      setError('Lỗi kết nối đến Google, vui lòng thử lại');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-[28px] shadow-card-custom p-8 sm:p-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1 mb-2">
            <span className="font-semibold text-2xl tracking-[-0.05em] text-[#000000]">shop</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#5433eb] mt-2.5" />
          </div>
          <h1 className="text-xl font-semibold text-[#000000] tracking-[-0.05em]">Đăng nhập</h1>
          <p className="text-xs text-[#787574] mt-1 tracking-[-0.014em]">Chào mừng bạn quay lại mua sắm</p>
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
              className="w-full flex items-center justify-center gap-3 bg-white border border-[#ebebeb] text-[#000000] py-3 rounded-full text-xs font-medium hover:bg-[#f2f4f5] disabled:opacity-40 transition shadow-soft-sm-custom tracking-[-0.014em]"
            >
              <GoogleIcon className="w-4 h-4" />
              <span>{googleLoading ? 'Đang chuyển hướng...' : 'Tiếp tục với Google'}</span>
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#ebebeb]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-[#787574] tracking-[-0.017em]">hoặc email</span>
              </div>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#787574] mb-1 tracking-[-0.014em]">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-2.5 rounded-full border border-[#000000]/10 bg-white text-xs text-[#000000] placeholder:text-[#787574] focus:outline-none focus:border-[#5433eb]/40 transition tracking-[-0.014em]"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-[#787574] tracking-[-0.014em]">Mật khẩu</label>
              <Link
                href="/forgot-password"
                className="text-xs text-[#5433eb] hover:underline font-medium tracking-[-0.014em]"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-2.5 rounded-full border border-[#000000]/10 bg-white text-xs text-[#000000] placeholder:text-[#787574] focus:outline-none focus:border-[#5433eb]/40 transition tracking-[-0.014em]"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full bg-[#000000] text-white py-3 rounded-full text-xs font-medium hover:bg-[#332f2d] disabled:opacity-40 transition flex items-center justify-center gap-1.5 tracking-[-0.014em]"
          >
            <span>{loading ? 'Đang xử lý...' : 'Đăng nhập'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <p className="text-center text-xs text-[#787574] mt-6 tracking-[-0.014em]">
          Chưa có tài khoản?{' '}
          <Link href="/register" className="text-[#000000] font-semibold hover:underline">
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
}
