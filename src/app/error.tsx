'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-20 text-center">
      <div className="bg-white rounded-[28px] p-16 shadow-card max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4 text-red-400">
          <AlertTriangle className="w-8 h-8 stroke-[1.5]" />
        </div>
        <h1 className="text-xl font-semibold text-ink-black tracking-[-0.05em] mb-2">
          Đã có lỗi xảy ra
        </h1>
        <p className="text-sm text-muted-gray tracking-[-0.014em] mb-6">
          Hệ thống gặp sự cố tạm thời. Vui lòng thử lại hoặc quay lại sau.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => retry()}
            className="inline-flex items-center justify-center gap-2 bg-ink-black text-white px-6 py-3 rounded-full font-medium tracking-[-0.014em] hover:bg-slate-ink transition text-sm cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Thử lại
          </button>
          <Link
            href="/"
            className="text-xs text-muted-gray hover:text-ink-black transition py-1 tracking-[-0.014em]"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
