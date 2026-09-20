'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Footer() {
  const pathname = usePathname();

  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className="bg-[#000000] text-white mt-auto">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-1 mb-4">
              <span className="font-semibold text-xl tracking-[-0.05em] text-white">shop</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#5433eb] mt-2" />
            </div>
            <p className="text-sm text-[#787574] leading-relaxed max-w-xs tracking-[-0.014em]">
              Cửa hàng trực tuyến phong cách hiện đại. Tự động tạo mã VietQR tức thì. Nhanh, tiện lợi, bảo mật.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold mb-4 tracking-[-0.017em] text-white">Khám phá</h4>
            <ul className="space-y-2.5 text-sm text-[#787574]">
              <li>
                <Link href="/" className="hover:text-white transition tracking-[-0.014em]">
                  Tất cả sản phẩm
                </Link>
              </li>
              <li>
                <Link href="/orders" className="hover:text-white transition tracking-[-0.014em]">
                  Đơn hàng
                </Link>
              </li>
              <li>
                <Link href="/wishlist" className="hover:text-white transition tracking-[-0.014em]">
                  Danh sách yêu thích
                </Link>
              </li>
              <li>
                <Link href="/chat" className="hover:text-white transition tracking-[-0.014em]">
                  Chat với shop
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-sm font-semibold mb-4 tracking-[-0.017em] text-white">Hỗ trợ</h4>
            <ul className="space-y-2.5 text-sm text-[#787574]">
              <li className="tracking-[-0.014em]">support@nhonhoadev.id.vn</li>
              <li className="tracking-[-0.014em]">1900 xxxx</li>
              <li className="tracking-[-0.014em]">Thứ 2 – Thứ 6, 8:00–17:00</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[#787574] tracking-[-0.014em]">
            © 2025 shop. · nhonhoadev.id.vn · Tất cả quyền được bảo lưu.
          </p>
          <div className="flex items-center gap-4 text-xs text-[#787574]">
            <span className="tracking-[-0.014em]">Powered by VietQR</span>
            <span className="w-1 h-1 rounded-full bg-[#787574]" />
            <span className="tracking-[-0.014em]">Bảo mật OTP</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
