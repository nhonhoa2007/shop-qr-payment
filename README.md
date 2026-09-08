# 🛒 Shop QR Payment

Hệ thống bán hàng thương mại điện tử tích hợp thanh toán tự động qua **VietQR** & Webhook ngân hàng (Casso), xác thực đăng ký bằng mã OTP qua Email, quản lý tồn kho chống race condition và hỗ trợ chat trực tiếp Realtime qua Pusher.

Dự án được xây dựng bằng **Next.js 16 (App Router)**, **React 19**, **Prisma ORM**, **PostgreSQL** và **Tailwind CSS v4**.

---

## 📑 Mục Lục
1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Cài đặt cơ sở dữ liệu PostgreSQL](#2-cài-đặt-cơ-sở-dữ-liệu-postgresql)
3. [Cấu hình biến môi trường (.env)](#3-cấu-hình-biến-môi-trường-env)
4. [Hướng dẫn cài đặt & khởi chạy](#4-hướng-dẫn-cài-đặt--khởi-chạy)
   - [Dành cho Windows](#-hướng-dẫn-trên-windows)
   - [Dành cho Linux / macOS](#-hướng-dẫn-trên-linux--macos)
5. [Tài khoản thử nghiệm (Seed data)](#5-tài-khoản-thử-nghiệm-seed-data)
6. [Chạy kiểm thử (Unit Tests)](#6-chạy-kiểm-thử-unit-tests)
8. [Tài liệu Phân tích & Thiết kế Hệ thống](#8-tài-liệu-phân-tích--thiết-kế-hệ-thống)

---

## 1. Yêu cầu hệ thống

- **Node.js**: Phiên bản `18.18+` trở lên (Khuyến nghị `Node.js 20 LTS` hoặc `Node.js 22 LTS`).
- **NPM** hoặc **PNPM** / **Yarn**.
- **PostgreSQL**: Phiên bản `14+` trở lên.

---

## 2. Cài đặt cơ sở dữ liệu PostgreSQL

Đảm bảo PostgreSQL server đang chạy và tạo một database mới cho dự án:

### Trên Windows (qua Command Prompt / PowerShell hoặc pgAdmin):
```sql
-- Đăng nhập vào psql:
psql -U postgres

-- Tạo cơ sở dữ liệu:
CREATE DATABASE shopqr;
```

### Trên Linux (Ubuntu/Debian/Fedora/macOS):
```bash
# Đăng nhập vào tài khoản postgres:
sudo -u postgres psql

# Chạy câu lệnh tạo database & cấp quyền:
CREATE DATABASE shopqr;
CREATE USER shopuser WITH ENCRYPTED PASSWORD 'mypassword';
GRANT ALL PRIVILEGES ON DATABASE shopqr TO shopuser;
\q
```

### Cách 1: Sử dụng tài khoản mặc định `postgres` (Khuyên dùng khi dev)

1. **Đặt mật khẩu cho user `postgres`**:
   ```bash
   sudo -u postgres psql
   ```
   Trong `psql`, chạy:
   ```sql
   -- Đổi mật khẩu cho user postgres (ví dụ: postgres123)
   ALTER USER postgres PASSWORD 'postgres123';

   -- Tạo database shopqr nếu chưa có
   CREATE DATABASE shopqr;

   -- Thoát
   \q
   ```

2. **Cấu hình `DATABASE_URL` trong `.env`**:
   ```env
   DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/shopqr?schema=public"
   ```

---

### Cách 2: Tạo User riêng `shopuser`
   ```bash
   sudo pacman -S postgresql
   ```

2. **Khởi tạo Database Cluster ban đầu (chỉ cần chạy 1 lần duy nhất sau khi mới cài đặt)**:
   ```bash
   sudo -u postgres initdb -D /var/lib/postgres/data
   ```

3. **Bật và khởi động dịch vụ PostgreSQL via systemd**:
   ```bash
   sudo systemctl enable --now postgresql
   ```

4. **Kiểm tra trạng thái dịch vụ**:
   ```bash
   systemctl status postgresql
   ```

5. **Tạo Database và User cho dự án**:
   ```bash
   # Đăng nhập vào PostgreSQL Shell với quyền user system postgres:
   sudo -u postgres psql
   ```
   Sau đó nhập các câu lệnh SQL trong `psql`:
   ```sql
   -- 1. Tạo cơ sở dữ liệu
   CREATE DATABASE shopqr;

   -- 2. Tạo user với mật khẩu riêng
   CREATE USER shopuser WITH ENCRYPTED PASSWORD 'mypassword';

   -- 3. Cấp toàn bộ quyền quản lý database shopqr cho shopuser
   GRANT ALL PRIVILEGES ON DATABASE shopqr TO shopuser;

   -- 4. Cho phép user tạo schema và bảng trong Postgres 15+
   \c shopqr
   GRANT ALL ON SCHEMA public TO shopuser;

   -- Thoát psql
   \q
   ```

6. **Cập nhật biến môi trường `DATABASE_URL` trong file `.env`**:
   ```env
   DATABASE_URL="postgresql://shopuser:mypassword@localhost:5432/shopqr?schema=public"
   ```

---

## 3. Cấu hình biến môi trường (.env)

Sao chép file `.env.example` thành file `.env`:

- **Windows**: `copy .env.example .env`
- **Linux / macOS**: `cp .env.example .env`

Điền các thông số thích hợp vào file `.env`:

```env
# 1. Kết nối PostgreSQL
DATABASE_URL="postgresql://postgres:mypassword@localhost:5432/shopqr?schema=public"

# 2. NextAuth (Bảo mật đăng nhập)
# Có thể tạo key ngẫu nhiên bằng lệnh: openssl rand -base64 32
NEXTAUTH_SECRET="your-super-secret-key-min-32-chars"
NEXTAUTH_URL="http://localhost:3000"

# 3. Resend (Gửi OTP kích hoạt tài khoản qua Email)
# Lấy API key miễn phí tại: https://resend.com
RESEND_API_KEY="re_your_api_key"
EMAIL_FROM="Shop <onboarding@resend.dev>"

# 4. Tài khoản ngân hàng nhận thanh toán (Tạo mã VietQR tự động)
# Mã ngân hàng theo chuẩn VietQR (ví dụ: mbbank, vcb, tcb, icb, acb, ...)
BANK_ID="mbbank"
BANK_ACCOUNT="0123456789"
BANK_NAME="NGUYEN VAN A"
BANK_DISPLAY_NAME="MB Bank"

# 5. Casso Webhook (Bắt giao dịch tự động xác nhận đơn hàng)
# Lấy mã secure token tại: https://casso.vn
CASSO_WEBHOOK_SECRET="your-casso-secure-token"

# 6. Pusher (Thông báo realtime & Chat trực tiếp)
# Đăng ký tài khoản miễn phí tại: https://pusher.com
PUSHER_APP_ID="your-pusher-app-id"
NEXT_PUBLIC_PUSHER_KEY="your-pusher-key"
PUSHER_SECRET="your-pusher-secret"
NEXT_PUBLIC_PUSHER_CLUSTER="ap1"

# 7. Cron Secret (Bảo vệ endpoint tự động hủy đơn quá hạn)
CRON_SECRET="your-cron-secret-key"
```

---

## 4. Hướng dẫn cài đặt & khởi chạy

### 🪟 Hướng dẫn trên Windows

1. **Mở Terminal**: Mở **PowerShell** hoặc **Command Prompt (CMD)** tại thư mục dự án:
   ```cmd
   cd D:\path\to\shop-qr-payment
   ```

2. **Cài đặt thư viện phụ thuộc (Dependencies)**:
   ```cmd
   npm install
   ```

3. **Đồng bộ Database Schema với Prisma**:
   ```cmd
   npx prisma db push
   ```

4. **Nạp dữ liệu mẫu ban đầu (Seed data)**:
   ```cmd
   npm run seed
   ```

5. **Khởi động server phát triển (Development)**:
   ```cmd
   npm run dev
   ```
   👉 Mở trình duyệt và truy cập: [http://localhost:3000](http://localhost:3000)

6. **Build và chạy phiên bản Production**:
   ```cmd
   npm run build
   npm run start
   ```

---

### 🐧 Hướng dẫn trên Linux / macOS

1. **Mở Terminal** và chuyển đến thư mục dự án:
   ```bash
   cd /path/to/shop-qr-payment
   ```

2. **Cài đặt thư viện phụ thuộc**:
   > *Lưu ý quan trọng:* Nếu thư mục dự án nằm trên phân vùng NTFS/exFAT mount ngoài (`/mnt/...`), hãy đảm bảo phân vùng được mount với quyền thực thi (`exec`) hoặc chạy `npm install` trực tiếp trên môi trường Linux để các gói nhị phân (`@esbuild/linux-x64`) hoạt động chính xác.
   ```bash
   npm install
   ```

3. **Cập nhật quyền thực thi cho các file nhị phân trong `node_modules` (nếu cần)**:
   ```bash
   chmod +x node_modules/.bin/* 2>/dev/null || true
   ```

4. **Đồng bộ Database Schema với Prisma**:
   ```bash
   npx prisma db push
   ```

5. **Nạp dữ liệu mẫu ban đầu (Seed data)**:
   ```bash
   npm run seed
   ```

6. **Khởi chạy Development Server**:
   ```bash
   npm run dev
   ```
   👉 Truy cập ứng dụng tại: [http://localhost:3000](http://localhost:3000)

7. **Build và chạy Production Server**:
   ```bash
   npm run build
   npm run start
   ```

---

## 5. Tài khoản thử nghiệm (Seed data)

Sau khi chạy lệnh `npm run seed`, hệ thống đã có sẵn 2 tài khoản mẫu:

| Loại tài khoản | Email | Mật khẩu | Quyền hạn |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@shop.com` | `admin123` | Quản lý sản phẩm, đơn hàng, chat khách hàng |
| **Khách hàng** | `customer@shop.com` | `customer123` | Mua sắm, thanh toán, quản lý đơn cá nhân |

---

## 6. Chạy kiểm thử (Unit Tests)

Dự án sử dụng bộ kiểm thử độc lập viết bằng **Node Native Test Runner** (`node:test` & `node:assert`) chạy trực tiếp không cần cài đặt thêm runner cồng kềnh:

```bash
# Chạy toàn bộ test suites:
npm run test

# Hoặc chạy trực tiếp qua Node:
node --experimental-strip-types --test tests/checkout.test.ts
node --experimental-strip-types --test tests/order-validation.test.ts
node --experimental-strip-types --test tests/payment-parser.test.ts
node --experimental-strip-types --test tests/order-transitions.test.ts
node --experimental-strip-types --test tests/otp.test.ts
```

Các nội dung được kiểm thử:
- ✅ Tính tiền checkout: miễn phí ship trên 500k, phí tiêu chuẩn 30k.
- ✅ Bắt lỗi đặt hàng: giỏ hàng rỗng, mã không tồn tại, vượt giới hạn 99 món, vượt số lượng tồn kho.
- ✅ Parser mã đơn hàng: bóc tách chính xác mã `DHxxxxxx` từ nội dung chuyển khoản ngân hàng.
- ✅ Quy tắc chuyển đổi trạng thái: chặn sửa đổi đơn hủy, chặn giao đơn chưa thanh toán.
- ✅ Logic OTP: chuẩn hóa email, sinh chuỗi ngẫu nhiên 6 chữ số.

---

## 7. Cấu hình Webhook & Cron Job

### 1. Webhook Casso / Ngân hàng
- URL nhận Webhook: `https://your-domain.com/api/webhooks/payment`
- Header xác thực: `secure-token: <CASSO_WEBHOOK_SECRET>`
- Tính năng: Tự động khớp mã đơn hàng từ nội dung chuyển khoản, kiểm tra trùng lặp (`Idempotency`), cập nhật trạng thái đơn thành `PAID` và thông báo tức thì qua Pusher.

### 2. Tự động hủy đơn quá hạn (Order Expiry Cron)
- Đơn hàng sau **15 phút** không thanh toán sẽ hết hạn và hoàn lại tồn kho.
- Endpoint thực thi:
  ```http
  GET /api/cron/expire-orders?secret=<CRON_SECRET>
  POST /api/cron/expire-orders
  Header: Authorization: Bearer <CRON_SECRET>
  ```
- **Vercel Hobby Tier:** File `vercel.json` đặt lịch chạy 1 lần/ngày (`0 0 * * *`) để tuân thủ chính sách Vercel Free.
- **Giải pháp 5 phút miễn phí:** Xem chi tiết 3 phương án chạy định kỳ 5 phút/lần (cron-job.org, GitHub Actions, Upstash QStash) tại 👉 **[CRON_SETUP.md](./CRON_SETUP.md)**.


---

## 8. Tài liệu Phân tích & Thiết kế Hệ thống

Xem chi tiết kiến trúc tổng thể, luồng Sequence diagram, ERD cơ sở dữ liệu và đặc tả 6 phân hệ mở rộng trong tương lai tại file:
👉 **[SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md)**
