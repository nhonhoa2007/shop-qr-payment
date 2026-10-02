import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@client/components/layout/Header';
import { Footer } from '@client/components/layout/Footer';

// Inter — thay thế được DESIGN.md chấp nhận cho GT Standard (font trả phí), self-host bởi next/font
const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'shop. — Khám phá mua sắm & Thanh toán QR',
  description: 'Cửa hàng trực tuyến phong cách hiện đại - Tự động tạo mã VietQR thanh toán tức thì',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className="min-h-screen bg-canvas-mist text-ink-black flex flex-col antialiased">
        <a href="#main-content" className="skip-link">
          Bỏ qua tới nội dung chính
        </a>
        <Providers>
          <Header />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
