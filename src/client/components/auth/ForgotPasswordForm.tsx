'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { OtpInput } from './OtpInput';
import { ArrowRight, ArrowLeft, Mail, KeyRound, CheckCircle2, RotateCw } from 'lucide-react';
import { toast } from 'sonner';

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Timer cooldown for resending OTP
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Auto-redirect to login on success after 3 seconds
  useEffect(() => {
    if (step === 3) {
      const timer = setTimeout(() => {
        router.push('/login');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [step, router]);

  // Step 1: Submit request to send OTP to email
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Vui lòng nhập địa chỉ email');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Không thể gửi mã xác thực. Vui lòng thử lại.');
        toast.error(data.error || 'Không thể gửi mã xác thực');
        return;
      }

      toast.success(data.message || 'Mã xác thực đã được gửi tới email của bạn!');
      setStep(2);
      setCooldown(60);
    } catch {
      setError('Lỗi kết nối máy chủ, vui lòng thử lại');
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP in Step 2
  const handleResendOtp = async () => {
    if (cooldown > 0 || resending) return;
    setError('');
    setResending(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Gửi lại mã xác thực thất bại');
        toast.error(data.error || 'Gửi lại mã xác thực thất bại');
      } else {
        toast.success(data.message || 'Đã gửi lại mã xác thực mới vào email');
        setCooldown(60);
      }
    } catch {
      setError('Lỗi kết nối khi gửi lại mã');
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setResending(false);
    }
  };

  // Step 2: Submit OTP and new password to reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otp.length !== 6) {
      setError('Vui lòng nhập đầy đủ mã OTP 6 chữ số');
      return;
    }

    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Đặt lại mật khẩu thất bại. Vui lòng kiểm tra mã OTP.');
        toast.error(data.error || 'Đặt lại mật khẩu thất bại');
        return;
      }

      toast.success(data.message || 'Đặt lại mật khẩu thành công!');
      setStep(3);
    } catch {
      setError('Lỗi kết nối máy chủ, vui lòng thử lại');
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-[28px] shadow-card-custom p-8 sm:p-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1 mb-2">
            <span className="font-semibold text-2xl tracking-[-0.05em] text-[#000000]">shop</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#5433eb] mt-2.5" />
          </div>
          <h1 className="text-xl font-semibold text-[#000000] tracking-[-0.05em]">
            {step === 1 && 'Quên mật khẩu'}
            {step === 2 && 'Đặt lại mật khẩu'}
            {step === 3 && 'Hoàn tất đặt lại mật khẩu'}
          </h1>
          <p className="text-xs text-[#787574] mt-1 tracking-[-0.014em]">
            {step === 1 && 'Nhập email đã đăng ký để nhận mã xác thực đặt lại mật khẩu'}
            {step === 2 && 'Nhập mã xác thực gửi tới email và tạo mật khẩu mới'}
            {step === 3 && 'Mật khẩu tài khoản của bạn đã được cập nhật an toàn'}
          </p>
        </div>

        {/* Error message alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl mb-6 text-xs tracking-[-0.014em]">
            {error}
          </div>
        )}

        {/* STEP 1: Request OTP */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#787574] mb-1 tracking-[-0.014em]">
                Email tài khoản
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-full border border-[#000000]/10 bg-white text-xs text-[#000000] placeholder:text-[#787574] focus:outline-none focus:border-[#5433eb]/40 transition tracking-[-0.014em]"
                  placeholder="name@example.com"
                />
                <Mail className="w-4 h-4 text-[#787574] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-[#000000] text-white py-3 rounded-full text-xs font-medium hover:bg-[#332f2d] disabled:opacity-40 transition flex items-center justify-center gap-1.5 tracking-[-0.014em]"
            >
              <span>{loading ? 'Đang gửi mã...' : 'Gửi mã xác thực'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <div className="pt-2 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs text-[#787574] hover:text-[#000000] font-medium transition tracking-[-0.014em]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại Đăng nhập</span>
              </Link>
            </div>
          </form>
        )}

        {/* STEP 2: Verify OTP and reset password */}
        {step === 2 && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            {/* Email info banner */}
            <div className="p-3 bg-[#f8f9fa] rounded-2xl border border-[#ebebeb] text-center text-xs text-[#787574]">
              <span>Mã OTP 6 số đã được gửi tới </span>
              <span className="font-semibold text-[#000000]">{email}</span>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setOtp('');
                  setError('');
                }}
                className="block mx-auto mt-1 text-[#5433eb] hover:underline font-medium text-[11px]"
              >
                Đổi địa chỉ email khác
              </button>
            </div>

            {/* OTP input */}
            <div>
              <label className="block text-center text-xs font-medium text-[#787574] mb-2 tracking-[-0.014em]">
                Mã xác thực OTP
              </label>
              <OtpInput
                onChange={setOtp}
                onComplete={(val) => setOtp(val)}
                disabled={loading}
              />
            </div>

            {/* New password */}
            <div>
              <label className="block text-xs font-medium text-[#787574] mb-1 tracking-[-0.014em]">
                Mật khẩu mới
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-full border border-[#000000]/10 bg-white text-xs text-[#000000] placeholder:text-[#787574] focus:outline-none focus:border-[#5433eb]/40 transition tracking-[-0.014em]"
                  placeholder="Tối thiểu 6 ký tự"
                />
                <KeyRound className="w-4 h-4 text-[#787574] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Confirm new password */}
            <div>
              <label className="block text-xs font-medium text-[#787574] mb-1 tracking-[-0.014em]">
                Xác nhận mật khẩu mới
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-full border border-[#000000]/10 bg-white text-xs text-[#000000] placeholder:text-[#787574] focus:outline-none focus:border-[#5433eb]/40 transition tracking-[-0.014em]"
                  placeholder="Nhập lại mật khẩu mới"
                />
                <KeyRound className="w-4 h-4 text-[#787574] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Resend button */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={cooldown > 0 || resending || loading}
                className="inline-flex items-center gap-1.5 text-xs text-[#5433eb] hover:underline disabled:text-[#787574] disabled:no-underline font-medium transition"
              >
                <RotateCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                <span>{cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : 'Gửi lại mã xác thực'}</span>
              </button>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || otp.length !== 6 || !newPassword || !confirmPassword}
              className="w-full bg-[#5433eb] text-white py-3 rounded-full text-xs font-medium hover:opacity-90 disabled:opacity-40 transition flex items-center justify-center gap-1.5 tracking-[-0.014em] shadow-[0_4px_24px_rgba(69,36,219,0.3)]"
            >
              <span>{loading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <div className="pt-2 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs text-[#787574] hover:text-[#000000] font-medium transition tracking-[-0.014em]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại Đăng nhập</span>
              </Link>
            </div>
          </form>
        )}

        {/* STEP 3: Success state */}
        {step === 3 && (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#000000]">
                Mật khẩu mới của bạn đã được cập nhật thành công!
              </p>
              <p className="text-xs text-[#787574] mt-1">
                Đang chuyển hướng về trang đăng nhập sau 3 giây...
              </p>
            </div>
            <Link
              href="/login"
              className="w-full bg-[#000000] text-white py-3 rounded-full text-xs font-medium hover:bg-[#332f2d] transition flex items-center justify-center gap-1.5 tracking-[-0.014em] inline-flex"
            >
              <span>Đăng nhập ngay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
