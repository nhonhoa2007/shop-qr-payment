# 🛒 Shop QR Payment

Hệ thống bán hàng thương mại điện tử tích hợp thanh toán tự động qua **VietQR** & Webhook ngân hàng (Casso), xác thực đăng ký bằng mã OTP qua Email, quản lý tồn kho chống race condition, **ví nội bộ** thanh toán 1-chạm & hoàn tiền tự động, vận chuyển qua **GHN**, đánh giá sản phẩm xác thực đơn hàng, chat trực tiếp Realtime qua Pusher và **phân quyền 3 cấp CUSTOMER / STAFF / ADMIN** (kèm Ma trận phân quyền nhân viên vận hành).

Dự án được xây dựng bằng **Next.js 16 (App Router)**, **React 19**, **Prisma ORM**, **PostgreSQL**, **Redis** và **Tailwind CSS v4**.

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
7. [Cấu hình Webhook & Cron Job](#7-cấu-hình-webhook--cron-job)
8. [Kiến trúc Compact Schema & Ngân sách Model Database](#8-kiến-trúc-compact-schema--ngân-sách-model-database)
9. [Kịch bản Demo Báo cáo / Bảo vệ Đồ án Toàn diện](#9-kịch-bản-demo-báo-cáo--bảo-vệ-đồ-án-toàn-diện)
10. [Tài liệu Phân tích & Thiết kế Hệ thống](#10-tài-liệu-phân-tích--thiết-kế-hệ-thống)

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

# 7. GHN (Vận chuyển: tính phí, tạo vận đơn, dataset địa giới)
# Token dev dùng gateway dev mặc định; nếu dùng token production thì trỏ GHN_API_BASE_URL
# về https://online-gateway.ghn.vn/shiip/public-api/
GHN_TOKEN="your-ghn-token"
GHN_API_BASE_URL="https://dev-online-gateway.ghn.vn/shiip/public-api/"
GHN_WEBHOOK_TOKEN="your-ghn-webhook-token"
GHN_SHOP_ID="your-ghn-shop-id"
GHN_FROM_DISTRICT_ID=1442
GHN_FROM_WARD_CODE="20101"

# 8. Upstash Redis (Cache + Rate limit; có fallback in-memory khi dev offline)
UPSTASH_REDIS_REST_URL="https://your-upstash-redis.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"

# 9. Cron Secret (Bảo vệ endpoint tự động hủy đơn quá hạn)
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

### ⚙️ Các lệnh tiện ích khác

| Lệnh | Công dụng |
| :--- | :--- |
| `npm run seed:demo` | Nạp dữ liệu demo phong phú (idempotent) — xem mục 5 |
| `npm run ghn:import` | Tải & biên soạn dataset địa giới hành chính đầy đủ 63 tỉnh của GHN vào `src/shared/constants/vietnam-locations.ts` |
| `npm run docs:uml` | Sinh lại toàn bộ 21 sơ đồ UML + bảng xem trực tuyến vào `docs/uml/` |
| `npm run db:backup` / `npm run db:restore` | Sao lưu / phục hồi database PostgreSQL |
| `npm run lint` | Kiểm tra code style ESLint |

---

## 5. Tài khoản thử nghiệm (Seed data)

Sau khi chạy lệnh `npm run seed`, hệ thống đã có sẵn 2 tài khoản mẫu:

| Loại tài khoản | Email | Mật khẩu | Quyền hạn |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@shop.com` | `admin123` | Toàn quyền quản trị: đơn hàng, sản phẩm, đối soát, coupon, phân quyền |
| **Khách hàng** | `customer@shop.com` | `customer123` | Mua sắm, thanh toán, quản lý đơn cá nhân |

### Dữ liệu demo phong phú (tùy chọn)

Muốn có ngay một cửa hàng "trông như đã hoạt động lâu năm" để demo (đồ án, thuyết trình, chụp màn hình), chạy thêm:

```bash
npm run seed:demo
```

Script cộng dồn an toàn (idempotent — chạy nhiều lần không nhân đôi), nạp thêm: khách hàng ngẫu nhiên nhiều loại (có/khó có đơn), sản phẩm kèm biến thể màu/size, đơn hàng trải dài nhiều trạng thái + giao dịch đã thanh toán, đánh giá có trả lời, ví có lịch sử nạp/hoàn. Chạy `npm run ghn:import` trước nếu muốn dataset địa giới 63 tỉnh đầy đủ để demo tính năng định vị GPS.

---

## 6. Chạy kiểm thử (Unit Tests)

Dự án sử dụng bộ kiểm thử độc lập viết bằng **Node Native Test Runner** (`node:test` & `node:assert`) chạy trực tiếp không cần cài đặt thêm runner, **không cần** database hay dịch vụ ngoài (service có mock client và fallback in-memory). Hiện có **45 test suites**:

```bash
# Chạy toàn bộ test suites:
npm run test

# Chạy một suite cụ thể:
node --experimental-strip-types --test tests/checkout.test.ts

# Chạy theo tên test case:
node --experimental-strip-types --test --test-name-pattern="refund" tests/wallet.test.ts
```

Các nhóm nội dung được kiểm thử:
- ✅ Checkout & validation: miễn phí ship trên 500k, phí tiêu chuẩn 30k, chặn giỏ rỗng / vượt tồn kho / vượt 99 món.
- ✅ Parser & webhook: bóc tách mã `DHxxxxxx` / mã nạp ví `NAP…` khỏi nội dung chuyển khoản, idempotency `bankTransId`, chống trả thiếu tiền.
- ✅ Đơn hàng: máy trạng thái FSM (chặn ship khi chưa trả tiền, chặn sửa đơn hủy), hủy đơn hoàn kho + thu hồi coupon.
- ✅ Ví: thanh toán bằng ví CAS trừ tiền, nạp tiền idempotent, hoàn tiền chống trùng lặp.
- ✅ Auth & phân quyền: OTP, quên mật khẩu, RBAC CUSTOMER/STAFF/ADMIN, guard từng phân hệ.
- ✅ Hạ tầng: Redis fallback, rate-limit, upload ảnh, GHN, cron auth, schema Prisma.

---

## 7. Cấu hình Webhook & Cron Job

### 1. Webhook Thanh toán (Casso)
- URL nhận Webhook ngân hàng: `https://your-domain.com/api/webhooks/payment` (header xác thực: `secure-token: <CASSO_WEBHOOK_SECRET>`)
- Tính năng: Tự động khớp mã đơn hàng (`DH…`) và mã nạp ví (`NAP…`) từ nội dung chuyển khoản, kiểm tra trùng lặp (`Idempotency`), cập nhật trạng thái đơn thành `PAID` / cộng số dư ví và thông báo tức thì qua Pusher.

### 2. Webhook Vận đơn GHN
- URL: `https://your-domain.com/api/webhooks/ghn` (header xác thực: `token: <GHN_WEBHOOK_TOKEN>`)
- Tính năng: Đồng bộ lộ trình vận đơn (`delivering → SHIPPING`, `delivered → COMPLETED` — COD thì tự đánh dấu PAID, `cancel/return → CANCELLED` + hoàn kho), nối shippingLog vào timeline đơn hàng.

### 3. Tự động hủy đơn quá hạn (Order Expiry Cron)
- Đơn hàng sau **15 phút** không thanh toán sẽ hết hạn và hoàn lại tồn kho.
- Endpoint thực thi:
  ```http
  GET /api/cron/expire-orders?secret=<CRON_SECRET>
  POST /api/cron/expire-orders
  Header: Authorization: Bearer <CRON_SECRET>
  ```
- **Vercel Hobby Tier:** File `vercel.json` đặt lịch chạy 1 lần/ngày (`0 0 * * *`) để tuân thủ chính sách Vercel Free.
- **Giải pháp 5 phút miễn phí:** Xem chi tiết 3 phương án chạy định kỳ 5 phút/lần (cron-job.org, GitHub Actions, Upstash QStash) tại 👉 **[docs/architecture/CRON_SETUP.md](./docs/architecture/CRON_SETUP.md)**.


---

## 8. Kiến trúc Compact Schema & Ngân sách Model Database

Hệ thống áp dụng triết lý thiết kế **Compact-Schema JSONB** với giới hạn bất biến **đúng 34 Prisma models** (Hard Cap 40 models, Target Ceiling 37 models) trong [prisma/schema.prisma](prisma/schema.prisma) nhằm tối ưu hiệu năng truy vấn, ngăn chặn sự bùng nổ quan hệ (EAV tables) và duy trì tính toàn vẹn tài chính.

Chi tiết quản lý ngân sách và quyết định kiến trúc:
- Danh bạ Model: [docs/architecture/prisma-model-registry.md](docs/architecture/prisma-model-registry.md)
- Quyết định kiến trúc ADR: [docs/adr/2026-10-17-compact-prisma-model-budget.md](docs/adr/2026-10-17-compact-prisma-model-budget.md)
- Kiểm tra tự động bằng lệnh:
  ```bash
  npm run schema:budget -- --expected=34 --lock-registry
  ```

### Mở rộng Danh mục Thiết bị Điện tử (40–60 Product Models)
Hệ thống quản lý **40–60 product models** thiết bị điện tử (gồm 12 laptops, 12 smartphones, 26 phụ kiện & thiết bị ngoại vi) được phiên bản hóa và kiểm soát bản quyền qua file manifest [prisma/data/electronics-catalog.json](prisma/data/electronics-catalog.json) và schema [prisma/data/electronics-catalog.schema.json](prisma/data/electronics-catalog.schema.json).
*Lưu ý cốt lõi:* 40–60 là số thực thể sản phẩm (Product records trong cơ sở dữ liệu), **không phải** là số bảng database hay models Prisma.

Công cụ nạp dữ liệu manifest:
```bash
# Kiểm tra dry-run trước khi nạp:
node --experimental-strip-types scripts/import-electronics-catalog.ts --dry-run

# Nạp dữ liệu thật vào cơ sở dữ liệu:
node --experimental-strip-types scripts/import-electronics-catalog.ts
```

### Công cụ Đối soát Độc lập (Reconciliation Tools)
Các công cụ đối soát vận hành ở chế độ **read-only**, chỉ phát hiện sai lệch và xuất báo cáo, tuyệt đối không tự ý âm thầm sửa dữ liệu trong cơ sở dữ liệu:
- **Đối soát kho & số Serial/IMEI**: `scripts/reconcile-inventory.ts`
  ```bash
  node --experimental-strip-types --import ./tests/register-alias.mjs scripts/reconcile-inventory.ts
  ```
- **Đối soát tiền, ví nội bộ & đơn hàng**: `scripts/reconcile-money.ts`
  ```bash
  node --experimental-strip-types --import ./tests/register-alias.mjs scripts/reconcile-money.ts
  ```

### Đánh giá Trợ lý AI An toàn (AI Grounding Evaluation)
- Chạy đánh giá **Offline** mặc định (100 test cases, 0 chi phí, không gọi mạng ngoài):
  - `npm run eval:assistant` (thực thi qua `scripts/eval-assistant.ts`)
  - `npm run eval:commerce` (thực thi qua `scripts/eval-commerce-intelligence.ts`)
- Chạy đánh giá **Online** (bắt buộc cờ explicit và ngân sách USD):
  - `npm run eval:assistant:online -- --budget-usd=1.0`

---

## 9. Kịch bản Demo Báo cáo / Bảo vệ Đồ án Toàn diện

Kịch bản 11 bước xuyên suốt từ trải nghiệm khách hàng đến vận hành quản trị và hậu mãi:
1. **Lọc sản phẩm chuyên sâu:** Khách hàng lọc danh mục theo thương hiệu, ngân sách, dung lượng RAM/SSD và thông số kỹ thuật.
2. **So sánh đối đầu:** Chọn 2 sản phẩm điện tử xem bảng so sánh thông số kỹ thuật trực quan.
3. **Điểm Value-for-Money (P/P):** Đánh giá điểm hiệu năng trên giá thành kèm mức độ tin cậy và nguồn dữ liệu kiểm chứng.
4. **Trợ lý Mua sắm AI có cơ sở (Grounded Assistant):** Hỏi tư vấn sản phẩm, trích dẫn chính xác nguồn dữ liệu và kiểm chứng phản hồi an toàn (Fallback) khi thiếu dữ kiện.
5. **Động cơ kiểm tra tương thích (Compatibility Engine):** Kiểm tra khả năng kết nối và công suất sạc giữa điện thoại/laptop và phụ kiện sạc.
6. **Đặt hàng & Thanh toán VietQR:** Khách hàng đặt hàng, quét mã VietQR tự động khớp tiền và cập nhật trạng thái đơn ngay lập tức qua WebSocket Pusher.
7. **Quản trị Nhập hàng & Định danh Serial/IMEI:** Nhân viên quản trị tạo đơn mua hàng (PO), nhập kho qua sổ cái `InventoryMovement` và gán mã Serial/IMEI vật lý.
8. **Quy trình Bảo hành (Warranty Lifecycle):** Khách hàng mở yêu cầu bảo hành từ đơn hàng đã hoàn tất; nhân viên tiếp nhận, kiểm tra và cập nhật timeline trạng thái.
9. **Trả hàng một phần & Hoàn tiền (Partial Return & Refund):** Mở yêu cầu trả hàng, đưa sản phẩm vào kho cách ly (quarantine), kiểm tra và hoàn tiền tự động vào ví nội bộ qua `RefundCase`.
10. **Nhật ký Kiểm toán Bất biến (`AdminAuditLog`):** Quản trị viên xem lịch sử các thao tác nhạy cảm với dữ liệu nhạy cảm được che giấu (redacted).
11. **Kiểm tra Ngân sách Schema:** Chứng minh tính tinh gọn và kỷ luật kiến trúc bằng lệnh:
    ```bash
    npm run schema:budget -- --expected=34 --lock-registry
    ```

---

## 10. Tài liệu Phân tích & Thiết kế Hệ thống

Bộ tài liệu đầy đủ được đánh chỉ mục tại 👉 **[docs/README.md](./docs/README.md)**, gồm:

| Tài liệu | Nội dung |
| :--- | :--- |
| **[SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md)** | Phân tích & thiết kế hệ thống: yêu cầu, kiến trúc, ERD, API, đặc tả các phân hệ mở rộng (đã triển khai xong) |
| **[docs/HE-THONG-CHUC-NANG.md](./docs/HE-THONG-CHUC-NANG.md)** | Cách hoạt động của 14+ luồng chức năng, đối chiếu trực tiếp với mã nguồn |
| **[docs/uml/README.md](./docs/uml/README.md)** | Bộ 21 sơ đồ UML kiến trúc (use case, class, sequence, activity, state machine, deployment…) + [bảng xem trực tuyến](./docs/uml/index.html) |
| **[docs/architecture/](./docs/architecture/)** | Bản thiết kế chi tiết từng đợt refactor/redesign + hướng dẫn cấu hình Cron |
| **[docs/architecture/prisma-model-registry.md](./docs/architecture/prisma-model-registry.md)** | Danh bạ quản lý ngân sách 34 Prisma models |
| **[docs/adr/2026-10-17-compact-prisma-model-budget.md](./docs/adr/2026-10-17-compact-prisma-model-budget.md)** | Quyết định kiến trúc ADR về Compact Schema |
| **[docs/data/electronics-catalog-sources.md](./docs/data/electronics-catalog-sources.md)** | Nguồn gốc và bản quyền dữ liệu danh mục điện tử |
| **[docs/verification/2026-10-17-release-candidate.md](./docs/verification/2026-10-17-release-candidate.md)** | Biên bản nghiệm thu Release Candidate |
