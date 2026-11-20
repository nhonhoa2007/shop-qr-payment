# Shop QR Payment

Ứng dụng thương mại điện tử bằng tiếng Việt, tích hợp thanh toán chuyển khoản VietQR, ví Shop, vận chuyển GHN và khu vực vận hành. Đây là ứng dụng Next.js dùng PostgreSQL/Prisma; các tích hợp bên ngoài chỉ hoạt động khi môi trường được cấu hình tương ứng.

## Công nghệ

- Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4.
- PostgreSQL với Prisma ORM 6; tiền được lưu bằng `BigInt` và chuyển qua DTO theo kiểu `MoneyVnd`.
- NextAuth Credentials, Argon2id, RBAC CUSTOMER/STAFF/ADMIN.
- Pusher cho sự kiện realtime; Redis/Upstash cho cache, giới hạn tần suất, quota và khóa phân tán.
- SePay là webhook thanh toán hiện tại; endpoint Casso được giữ cho giao dịch tương thích cũ.
- GHN, Resend, Cloudflare R2/Cloudinary, Telegram và AI là tích hợp tùy cấu hình.

## Bắt đầu chạy

Yêu cầu Node.js `>=20.9.0` và PostgreSQL. Lệnh cài đặt dùng `npm` và `package-lock.json` của repository.

```bash
npm install
cp .env.example .env
```

Điền `DATABASE_URL` trỏ đến PostgreSQL và các biến cần cho những dịch vụ bạn muốn chạy trong `.env`. Sau đó khởi tạo schema và client Prisma:

```bash
npx prisma migrate deploy
npx prisma generate
npm run dev
```

Ứng dụng chạy mặc định tại `http://localhost:3000`. Chỉ chạy seed/demo nếu bạn chủ động muốn thêm dữ liệu vào database đã cấu hình; các sản phẩm điện tử trong catalog demo là dữ liệu tổng hợp, không phải thông tin bán hàng đã xác minh.

## Lệnh thường dùng

| Lệnh | Tác dụng |
| --- | --- |
| `npm run dev` | Chạy ứng dụng phát triển |
| `npm run build` / `npm run start` | Build và chạy ứng dụng production |
| `npm run test` | Chạy unit test bằng Node.js test runner |
| `npm run test:integration` | Chạy integration test; cần PostgreSQL test riêng |
| `npm run lint` | ESLint trên repository |
| `npm run arch:check` | Kiểm tra ranh giới phụ thuộc giữa các tầng |
| `npm run verify` | Chạy test, integration test, lint, kiểm tra kiến trúc và build |
| `npm run docs:uml` | Sinh lại gói UML lịch sử trong `docs/uml/` |

## Tài liệu

- [Chỉ mục tài liệu](docs/README.md)
- [Luồng hiện tại và bản đồ route/API](docs/architecture/PROJECT_FLOWS.md)
- [Tổng quan chức năng](docs/HE-THONG-CHUC-NANG.md)
- [Phân tích và thiết kế hệ thống hiện tại](SYSTEM_DESIGN.md)
- [Thiết lập cron và hạn chế lịch hiện tại](docs/architecture/CRON_SETUP.md)
- [Biến môi trường mẫu](.env.example)

Tài liệu luồng mô tả hành vi trong mã nguồn. Nó không chứng minh secret, database hay dịch vụ bên ngoài đã được cấu hình trong môi trường triển khai.
