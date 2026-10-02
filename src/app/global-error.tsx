'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// Bắt lỗi ở tầng root layout — phải tự khai báo <html>/<body> và kiểu chữ cơ bản
export default function GlobalError({
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
    <html lang="vi">
      <body
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, Helvetica, Arial, sans-serif",
          background: '#f2f4f5',
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: 28,
            padding: 64,
            maxWidth: 384,
            textAlign: 'center',
            boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: '#fef2f2',
              border: '1px solid #fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#f87171',
            }}
          >
            <AlertTriangle size={32} strokeWidth={1.5} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#000', margin: '0 0 8px' }}>
            Lỗi hệ thống
          </h1>
          <p style={{ fontSize: 14, color: '#787574', margin: '0 0 24px' }}>
            Ứng dụng không thể khởi động lúc này. Vui lòng tải lại trang.
          </p>
          <button
            onClick={() => retry()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#000',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 9999,
              fontSize: 14,
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} />
            Tải lại trang
          </button>
        </div>
      </body>
    </html>
  );
}
