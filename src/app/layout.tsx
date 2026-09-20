import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@client/components/layout/Header';
import { Footer } from '@client/components/layout/Footer';

export const metadata: Metadata = {
  title: 'shop. — Khám phá mua sắm & Thanh toán QR',
  description: 'Cửa hàng trực tuyến phong cách hiện đại - Tự động tạo mã VietQR thanh toán tức thì',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-[#f2f4f5] text-[#000000] flex flex-col antialiased">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
