import Link from 'next/link';
import { SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="max-w-[1200px] mx-auto px-4 py-20 text-center">
      <div className="bg-white rounded-[28px] p-16 shadow-card max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
          <SearchX className="w-8 h-8 stroke-[1.5]" />
        </div>
        <h1 className="text-xl font-semibold text-ink-black tracking-[-0.05em] mb-2">
          Không tìm thấy trang
        </h1>
        <p className="text-sm text-muted-gray tracking-[-0.014em] mb-6">
          Trang bạn tìm kiếm không tồn tại hoặc đã bị di chuyển.
        </p>
        <Link
          href="/"
          className="inline-block bg-ink-black text-white px-6 py-3 rounded-full font-medium tracking-[-0.014em] hover:bg-slate-ink transition text-sm"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
