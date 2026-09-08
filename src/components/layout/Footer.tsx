import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-white border-t mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-bold text-lg mb-3">🛒 ShopQR</h3>
            <p className="text-gray-500 text-sm">Cửa hàng trực tuyến với thanh toán QR tự động. Nhanh chóng, tiện lợi, an toàn.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Liên kết</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link href="/" className="hover:text-blue-600">Trang chủ</Link></li>
              <li><Link href="/orders" className="hover:text-blue-600">Đơn hàng</Link></li>
              <li><Link href="/chat" className="hover:text-blue-600">Liên hệ</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Hỗ trợ</h4>
            <p className="text-sm text-gray-500">Email: support@shopqr.vn</p>
            <p className="text-sm text-gray-500">Hotline: 1900 xxxx</p>
          </div>
        </div>
        <div className="border-t mt-8 pt-4 text-center text-sm text-gray-400">
          © 2025 ShopQR. Tất cả quyền được bảo lưu.
        </div>
      </div>
    </footer>
  );
}
