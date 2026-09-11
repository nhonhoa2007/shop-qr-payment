'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { OtpInput } from '@/components/auth/OtpInput';

function VerifyOtpContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get('email') || '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpValue, setOtpValue] = useState('');

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleVerify = async (otp: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Xác thực thất bại');
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      }
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setResendCooldown(60);
        setError('');
      } else {
        const data = await res.json();
        setError(data.error || 'Gửi lại thất bại');
      }
    } catch {
      setError('Lỗi kết nối');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          {success ? (
            <>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-green-600 mb-2">Xác thực thành công! 🎉</h1>
              <p className="text-gray-500">Đang chuyển đến trang đăng nhập...</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📧</span>
              </div>
              <h1 className="text-2xl font-bold mb-2">Nhập mã xác thực</h1>
              <p className="text-gray-500 mb-1">Chúng tôi đã gửi mã OTP 6 số đến</p>
              <p className="text-blue-600 font-medium mb-6">{email}</p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                  {error}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (otpValue.length === 6) {
                    handleVerify(otpValue);
                  }
                }}
                className="space-y-4"
              >
                <OtpInput
                  onChange={setOtpValue}
                  onComplete={handleVerify}
                  disabled={loading}
                />

                <button
                  type="submit"
                  disabled={loading || otpValue.length !== 6}
                  className="w-full mt-6 bg-[#5433eb] text-white py-3.5 rounded-full font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_4px_24px_rgba(69,36,219,0.34)] active:scale-[0.98]"
                >
                  {loading ? 'Đang xác thực...' : 'Xác nhận mã OTP'}
                </button>
              </form>

              <div className="mt-6">
                <p className="text-sm text-gray-400 mb-2">Không nhận được mã?</p>
                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className="text-blue-600 hover:underline text-sm font-medium disabled:text-gray-400 disabled:no-underline"
                >
                  {resendCooldown > 0 ? `Gửi lại sau ${resendCooldown}s` : 'Gửi lại mã OTP'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center"><p className="text-gray-500">Đang tải...</p></div>}>
      <VerifyOtpContent />
    </Suspense>
  );
}
