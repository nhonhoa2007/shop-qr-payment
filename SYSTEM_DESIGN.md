# TÀI LIỆU PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG (SYSTEM ANALYSIS & DESIGN)
**Dự án:** Shop QR Payment (Hệ thống Thương mại Điện tử Tích hợp Thanh toán VietQR & Realtime Chat)  
**Phiên bản:** 3.0 (Kiến trúc hiện tại — toàn bộ 6 phân hệ mở rộng v2.0 **đã triển khai xong**)  
**Ngày lập:** Tháng 09/2026 · **Cập nhật:** Tháng 10/2026  

> ⚡ **Trạng thái tài liệu:** Các phân hệ được thiết kế là "mở rộng tương lai" ở phiên bản 2.0
> (Coupon, Biến thể sản phẩm, Đánh giá, GHN, Ví & Hoàn tiền, Redis + Rate limit)
> **đều đã đi vào vận hành** — xem trạng thái chi tiết ở [Mục 7](#7-thiết-kế-kiến-trúc-mở-rộng-tương-lai-future-extensions-design).
> Mô tả hoạt động runtime từng luồng nằm ở **[docs/HE-THONG-CHUC-NANG.md](./docs/HE-THONG-CHUC-NANG.md)**,
> sơ đồ UML nằm ở **[docs/uml/README.md](./docs/uml/README.md)**.

---

## 📑 MỤC LỤC
1. [TỔNG QUAN HỆ THỐNG](#1-tổng-quan-hệ-thống)
2. [PHÂN TÍCH YÊU CẦU HỆ THỐNG (REQUIREMENTS SPECIFICATION)](#2-phân-tích-yêu-cầu-hệ-thống-requirements-specification)
3. [KIẾN TRÚC TỔNG THỂ (SYSTEM ARCHITECTURE)](#3-kiến-trúc-tổng-thể-system-architecture)
4. [THIẾT KẾ QUY TRÌNH NGHIỆP VỤ & LUỒNG DỮ LIỆU (SEQUENCE FLOWS)](#4-thiết-kế-quy-trình-nghiệp-vụ--luồng-dữ-liệu-sequence-flows)
5. [THIẾT KẾ CƠ SỞ DỮ LIỆU (DATABASE DESIGN - CURRENT ERD)](#5-thiết-kế-cơ-sở-dữ-liệu-database-design---current-erd)
6. [THIẾT KẾ API & BẢO MẬT (API SPECIFICATION & SECURITY)](#6-thiết-kế-api--bảo-mật-api-specification--security)
7. [THIẾT KẾ KIẾN TRÚC MỞ RỘNG TƯƠNG LAI (FUTURE EXTENSIONS DESIGN)](#7-thiết-kế-kiến-trúc-mở-rộng-tương-lai-future-extensions-design)

---

## 1. TỔNG QUAN HỆ THỐNG

### 1.1. Bối cảnh & Mục tiêu
**Shop QR Payment** là giải pháp thương mại điện tử thế hệ mới, tối ưu hóa quy trình bán hàng không chạm (touchless payment) tại thị trường Việt Nam bằng phương thức sinh mã **VietQR động** chuẩn NAPAS 247 theo từng đơn hàng, kết hợp xử lý Webhook ngân hàng tự động, chống bán vượt tồn kho (race condition) và giao tiếp hai chiều Realtime giữa Khách hàng và Quản trị viên.

### 1.2. Tech Stack & Công nghệ Cốt lõi
- **Frontend & Backend Framework:** Next.js 16 (App Router, Server Components), React 19, Zustand (client state).
- **Ngôn ngữ:** TypeScript 5.x (Strict Type Safety).
- **ORM & Cơ sở dữ liệu:** Prisma ORM v6 + PostgreSQL 14+ (ACID Transaction compliant).
- **Cache & Rate Limiting:** Upstash Redis (REST) với fallback in-memory khi phát triển offline.
- **Xác thực & Phân quyền:** NextAuth.js (Credentials, Session JWT) + BCrypt + Resend API (OTP Verification) + RBAC 3 cấp CUSTOMER/STAFF/ADMIN.
- **Thanh toán & Đối soát:** VietQR Generator + Casso Webhook Engine + Ví nội bộ (Refund Engine).
- **Vận chuyển:** GHN OpenAPI v2 (tính phí động, tạo vận đơn tự động, webhook lộ trình).
- **Giao tiếp Realtime:** Pusher Server / Pusher Client (WebSockets channels).
- **Kiểm thử tự động:** Node.js Native Test Runner (`node:test`, `node:assert`) — 47 test suites.
- **Styling & UI:** Tailwind CSS v4, Lucide React, Sonner (Toast notifications).

---

## 2. PHÂN TÍCH YÊU CẦU HỆ THỐNG (REQUIREMENTS SPECIFICATION)

### 2.1. Yêu cầu Chức năng (Functional Requirements - FR)

#### A. Phân hệ Khách hàng (Customer)
- **FR-C01 (Xác thực tài khoản):** Đăng ký tài khoản với mã OTP xác minh qua Email (TTL 5 phút, giới hạn 5 lần thử sai, cooldown 60s); Đăng nhập bằng Email/Password.
- **FR-C02 (Duyệt & Tìm kiếm Sản phẩm):** Xem danh mục sản phẩm, tìm kiếm theo từ khóa, lọc theo danh mục, xem chi tiết sản phẩm và tồn kho.
- **FR-C03 (Giỏ hàng):** Thêm/bớt/xóa sản phẩm, cập nhật số lượng (tối đa 99 món/món), lưu trữ Client state (Zustand + LocalStorage sync).
- **FR-C04 (Đặt hàng & Thanh toán QR):** Tính toán subtotal và phí vận chuyển tự động (Miễn phí ship cho đơn ≥ 500k, phí tiêu chuẩn 30k); Sinh mã VietQR động chứa số tiền chính xác và mã đơn `DHxxxxxx`; Countdown 15 phút hết hạn đơn hàng.
- **FR-C05 (Theo dõi đơn hàng & Thông báo):** Xem lịch sử đơn hàng, trạng thái xử lý/thanh toán, nhận thông báo đẩy Realtime khi ngân hàng nhận tiền.
- **FR-C06 (Chat Trực tiếp):** Chat trực tiếp với Admin theo từng đơn hàng hoặc tư vấn chung, hiển thị trạng thái typing, hỗ trợ đánh dấu đã đọc (Read/Unread) và rollback lạc quan khi lỗi mạng.

#### B. Phân hệ Quản trị (Admin)
- **FR-A01 (Quản lý Đơn hàng):** Xem danh sách đơn hàng, tìm kiếm nhanh theo mã đơn / khách hàng / SĐT, lọc theo trạng thái đơn (`PENDING`, `CONFIRMED`, `PROCESSING`, `SHIPPING`, `COMPLETED`, `CANCELLED`) và trạng thái thanh toán (`UNPAID`, `PAID`, `EXPIRED`, `REFUNDED`).
- **FR-A02 (Thực thi Trạng thái an toàn):** Chuyển trạng thái đơn hàng tuân thủ State Machine (chặn chuyển đơn đã hủy, chặn hoàn thành đơn chưa thanh toán).
- **FR-A03 (Quản lý Sản phẩm):** Thêm mới, chỉnh sửa thông tin, giá bán, số lượng tồn kho, danh mục; Soft delete sản phẩm (`isActive = false`) để bảo toàn dữ liệu lịch sử đơn hàng.
- **FR-A04 (Quản lý Chat Realtime):** Danh sách phòng chat theo khách hàng, trả lời tin nhắn tức thì qua Pusher channel.

#### C. Phân hệ Tự động hóa & Webhook (Background & Automation)
- **FR-B01 (Xử lý Webhook Casso):** Tiếp nhận thông tin biến động số dư ngân hàng, giải mã nội dung chuyển khoản tìm mã đơn `DHxxxxxx`, kiểm tra trùng lặp giao dịch (`bankTransId`), khớp số tiền và kích hoạt xác nhận thanh toán `PAID`.
- **FR-B02 (Order Expiry Cron):** Quét định kỳ các đơn hàng quá hạn 15 phút chưa thanh toán, tự động chuyển `EXPIRED`/`CANCELLED` và hoàn lại số lượng tồn kho (`releaseOrderStock`).

#### D. Phân hệ Bổ sung — đã triển khai (cập nhật 10/2026)
- **FR-C07 (Coupon):** Mã giảm giá FIXED / PERCENTAGE (chặn `maxDiscount`) / FREE_SHIPPING, ràng buộc hạn dùng, lượt dùng, lượt/người, giá trị đơn tối thiểu; hoàn lượt khi hủy/ hết hạn đơn.
- **FR-C08 (Biến thể sản phẩm):** SKU màu/size có giá – ảnh – tồn kho riêng; `Product.stock` luôn đồng bộ = tổng tồn kho biến thể.
- **FR-C09 (Đánh giá xác thực):** Chỉ đơn `COMPLETED` chứa sản phẩm mới được đánh giá 1–5 sao; admin duyệt/ẩn/trả lời công khai.
- **FR-C10 (Ví Shop):** Nạp tiền qua VietQR/Casso (idempotent 4 lớp), thanh toán đơn 1-chạm (CAS trừ tiền), hoàn tiền 100% tự động khi hủy đơn đã PAID (chống hoàn kép).
- **FR-C11 (Vận chuyển GHN):** Tính phí động theo địa giới + cân nặng, tạo vận đơn tự động khi duyệt đơn, webhook đồng bộ lộ trình, COD đối soát qua shipper.
- **FR-C12 (Định vị GPS):** Tự động điền địa chỉ giao hàng từ GPS/IP, so khớp trung thực với dataset địa giới GHN (không đoán mù).
- **FR-A05 (RBAC & Ma trận phân quyền):** Vai trò CUSTOMER / STAFF / ADMIN; STAFF được cấp quyền chi tiết theo module (`orders`, `products`, `shipments`, `chat`, `reviews`); safeguard chống tự hạ quyền/khóa chính mình.
- **FR-A06 (Dashboard Bento realtime):** Analytics 21 truy vấn (doanh thu, khớp QR, cơ cấu thanh toán, cảnh báo tồn kho…) cache Redis 60s + Pusher `analytics-updated`.
- **FR-A07 (Đối soát thủ công):** Khớp tiền tay cho đơn sai nội dung CK, kể cả "hồi sinh" đơn hết hạn (luồng duy nhất được phép theo FSM).
- **FR-B03 (Webhook GHN):** Token fail-closed; đồng bộ trạng thái đơn và vận đơn.

---

### 2.2. Yêu cầu Phi chức năng (Non-Functional Requirements - NFR)

| Tiêu chí | Đặc tả kỹ thuật |
| :--- | :--- |
| **Tính Toàn vẹn (ACID)** | Mọi thao tác tạo đơn, trừ tồn kho, cập nhật trạng thái đơn và tạo bản ghi giao dịch phải chạy trong Prisma `$transaction`. |
| **Chống Race Condition** | Sử dụng Atomic Update (`stock: { gte: quantity }`, `decrement: quantity`) để đảm bảo không bị bán vượt quá tồn kho khi có hàng trăm yêu cầu đồng thời. |
| **Tính Bất biến Webhook (Idempotency)** | Giao dịch ngân hàng được khóa theo khóa duy nhất `bankTransId`. Các webhook trùng lặp từ ngân hàng bị bỏ qua an toàn, không sinh lỗi duplicate. |
| **Bảo mật (Security)** | Mật khẩu & OTP hash bằng BCrypt; Xác thực webhook qua Header Secret Token; Bảo vệ Cron Endpoint bằng Bearer Token; Lọc dữ liệu đầu vào chống SQL Injection (Prisma parameterized queries) và XSS. |
| **Thời gian phản hồi (Performance)** | API tạo đơn & xác thực < 200ms; Tín hiệu thông báo Realtime qua Pusher < 500ms; Giao diện Client tối ưu hóa Hydration state. |

---

## 3. KIẾN TRÚC TỔNG THỂ (SYSTEM ARCHITECTURE)

Hệ thống được thiết kế theo mô hình **Layered Clean Architecture** kết hợp **Event-driven Realtime** trên nền tảng Serverless Next.js App Router. Từ phiên bản 3.0, mã nguồn được tổ chức thành 4 phân khu tường minh với path aliases (`@client/*`, `@server/*`, `@shared/*`) — chi tiết chuẩn hóa tại `docs/architecture/SYSTEM_DESIGN_REFACTOR_STRUCTURE.md`:

```
+-----------------------------------------------------------------------------------+
|                              CLIENT LAYER (Browser)                                |
|  - src/client/views/ & components/ (App Router / RSC / Client Components)          |
|  - Zustand Stores (Cart, Wishlist) | Pusher-js Client (WebSockets)                 |
+-----------------------------------------------------------------------------------+
                                         │  ▲ HTTPS (REST API)
                                         ▼  │ WebSockets (Realtime Events)
+-----------------------------------------------------------------------------------+
|                     API & BUSINESS LOGIC LAYER (Next.js App Router)                |
|  +-----------------------------------------------------------------------------+  |
|  | src/app/: Routing facade cực mỏng (Server Components + Route Handlers)      |  |
|  |    export { POST } from '@/server/modules/orders/orders.controller'          |  |
|  +-----------------------------------------------------------------------------+  |
|  |  Business Modules (src/server/modules/):                                    |  |
|  |   - orders/ (controller, FSM)          - payment/ (casso, parser)          |  |
|  |   - inventory/ (reserve/release CAS)   - wallet/ (pay, topup, refund)        |  |
|  |   - shipping/ (ghn.service, geocode)   - catalog/ (caching, pagination)      |  |
|  |   - admin/ (analytics, rbac, reconcile)- auth/ (otp, rbac, nextauth)         |  |
|  |   - chat/ - reviews/ - wishlist/ - notifications/ - products/                |  |
|  |  Infrastructure (src/server/infrastructure/): redis, rate-limit, pusher,     |  |
|  |  resend  ·  Database: src/server/database/prisma.ts (singleton)              |  |
|  +-----------------------------------------------------------------------------+  |
|  |  Shared Kernel (src/shared/): types, constants, validations, utils, errors  |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
         │                    │                    │                    │
         ▼ (Prisma ORM)       ▼ (REST)             ▼ (WebSockets Push)  ▼ (Email API)
+--------------------+  +------------------+  +------------------+  +------------------+
|   DATABASE LAYER   |  |  UPSTASH REDIS   |  |  PUSHER CHANNELS |  |    RESEND API    |
|   PostgreSQL 14+   |  |  Cache + Rate    |  |  (Realtime Notif |  |   (Transactional |
|  (ACID Relational) |  |  Limit + Locks   |  |   & Chat Streams)|  |    OTP Emails)   |
+--------------------+  +------------------+  +------------------+  +------------------+
         ▲
         │ (HTTP Webhook POST + Secure Token)
+-----------------------------------------------------------------------------------+
|                     EXTERNAL GATEWAYS (Casso · GHN)                               |
|  - Casso Webhook Engine (Auto balance fluctuation notification)                   |
|  - GHN Logistics OpenAPI v2 (Fee calc, shipment creation, tracking webhook)       |
+-----------------------------------------------------------------------------------+
```

---

## 4. THIẾT KẾ QUY TRÌNH NGHIỆP VỤ & LUỒNG DỮ LIỆU (SEQUENCE FLOWS)

### 4.1. Luồng Đặt hàng & Khởi tạo Thanh toán QR (Checkout Flow)

```
Khách hàng               Next.js API (/api/orders)       Prisma / PostgreSQL          Pusher / Admin
    │                               │                             │                          │
    │ 1. POST /api/orders (items)   │                             │                          │
    │──────────────────────────────>│                             │                          │
    │                               │ 2. Validate Items & Max Qty │                          │
    │                               │ 3. Tính subtotal & shipFee  │                          │
    │                               │ 4. BEGIN TRANSACTION        │                          │
    │                               │────────────────────────────>│                          │
    │                               │    Atomic Reserve Stock     │                          │
    │                               │    Create Order (PENDING)   │                          │
    │                               │    Create Chat Room         │                          │
    │                               │    COMMIT TRANSACTION       │                          │
    │                               │<────────────────────────────│                          │
    │                               │ 5. Trigger Notifications    │                          │
    │                               │───────────────────────────────────────────────────────>│ (Báo Admin)
    │ 6. Trả về OrderCode & QR URL  │                             │                          │
    │<──────────────────────────────│                             │                          │
    │                               │                             │                          │
    │ 7. Hiển thị QR & Countdown    │                             │                          │
```

---

### 4.2. Luồng Xử lý Webhook Thanh toán Ngân hàng (Payment Webhook Flow)

```
Ngân hàng (Casso)          API Webhook (/api/webhooks/payment)    PostgreSQL Database        Pusher / Khách hàng
    │                                   │                                  │                        │
    │ 1. POST Webhook (secure-token)    │                                  │                        │
    │──────────────────────────────────>│                                  │                        │
    │                                   │ 2. Check Token & Parse OrderCode │                        │
    │                                   │ 3. Check Idempotency (TransId)   │                        │
    │                                   │─────────────────────────────────>│                        │
    │                                   │<─────────────────────────────────│                        │
    │                                   │ 4. Match Order & Check Amount    │                        │
    │                                   │ 5. BEGIN TRANSACTION             │                        │
    │                                   │    Update Order (PAID/CONFIRMED) │                        │
    │                                   │    Insert Transaction Record     │                        │
    │                                   │    COMMIT TRANSACTION            │                        │
    │                                   │─────────────────────────────────>│                        │
    │                                   │<─────────────────────────────────│                        │
    │                                   │ 6. Pusher Broadcast:             │                        │
    │                                   │    'payment-success'             │                        │
    │                                   │──────────────────────────────────────────────────────────>│
    │ 7. Return HTTP 200 {success:true} │                                  │                        │ (UI đổi xanh
    │<──────────────────────────────────│                                  │                          ngay lập tức)
```

---

### 4.3. Finite State Machine (Quy chuẩn Chuyển đổi Trạng thái Đơn hàng)

Hệ thống quản lý trạng thái đơn theo máy trạng thái hữu hạn chặt chẽ:

```
[ PENDING (UNPAID) ] ───(Khách quét QR / Webhook khớp)───► [ CONFIRMED (PAID) ]
        │                                                           │
        │ (Quá 15p chưa thanh toán                                 │ (Admin bắt đầu chuẩn bị hàng)
        │  hoặc Khách/Admin hủy)                                    ▼
        ▼                                                   [ PROCESSING (PAID) ]
[ CANCELLED (EXPIRED) ]                                             │
 (Hoàn kho tự động)                                                │ (Bàn giao shipper)
                                                                    ▼
                                                            [ SHIPPING (PAID) ]
                                                                    │
                                                                    │ (Giao hàng thành công)
                                                                    ▼
                                                            [ COMPLETED (PAID) ]
```
*Quy tắc nghiệp vụ:*
- Đơn đã ở trạng thái `CANCELLED` **không thể** chuyển sang bất kỳ trạng thái nào khác.
- Đơn chưa có `paymentStatus == PAID` **không thể** chuyển sang `SHIPPING` hoặc `COMPLETED`.

---

## 5. THIẾT KẾ CƠ SỞ DỮ LIỆU (DATABASE DESIGN - CURRENT ERD)

### 5.1. Entity Relationship Diagram (ERD Hiện tại)

```
+--------------------+        +---------------------+        +--------------------+
|       User         | 1    N |      OtpCode        |        |      Product       |
|--------------------|        |---------------------|        |--------------------|
| id (PK)            |        | id (PK)             |        | id (PK)            |
| email (UQ)         |        | email               |        | name               |
| passwordHash       |        | code (Bcrypt)       |        | description        |
| name               |        | type (ENUM)         |        | price              |
| phone              |        | attempts (Int)      |        | image              |
| address            |        | expiresAt           |        | category           |
| role (CUSTOMER/ADM)|        | createdAt           |        | stock              |
| isVerified         |        +---------------------+        | isActive (Boolean) |
| createdAt          |                                       | createdAt          |
+--------------------+                                       +--------------------+
     │ 1                                                                ▲ 1
     │                                                                  │
     │ N                                                                │ N
+--------------------+ 1    N +---------------------+ 1              N +--------------------+
|       Order        |───────<|      OrderItem      |>─────────────────|     (Product)      |
|--------------------|        |---------------------|                  +--------------------+
| id (PK)            |        | id (PK)             |
| orderCode (UQ)     |        | orderId (FK)        |
| userId (FK, Null)  |        | productId (FK)      |
| customerName       |        | quantity            |
| customerPhone      |        | price               |
| customerAddress    |        +---------------------+
| totalAmount        |
| status (ENUM)      |
| paymentStatus(ENUM)|
| qrContent          |
| expiresAt          |
+--------------------+
     │ 1
     ├─────────────────────────────────────────┐
     │ 1                                       │ 1
+--------------------+                  +--------------------+ 1    N +--------------------+
|    Transaction     |                  |      ChatRoom      |───────<|ChatRoomParticipant |
|--------------------|                  |--------------------|        |--------------------|
| id (PK)            |                  | id (PK)            |        | id (PK)            |
| orderId (FK, UQ)   |                  | orderId (FK, UQ)   |        | roomId (FK)        |
| bankTransId (UQ)   |                  | lastMessage        |        | userId (FK)        |
| amount             |                  | lastActiveAt       |        | lastReadAt         |
| description        |                  +--------------------+        +--------------------+
| verified (Boolean) |                            │ 1
| rawWebhookData     |                            │ N
+--------------------+                  +--------------------+
                                        |      Message       |
                                        |--------------------|
                                        | id (PK)            |
                                        | roomId (FK)        |
                                        | senderId (FK)      |
                                        | content            |
                                        | type (TEXT/SYS/IMG)|
                                        | isRead (Boolean)   |
                                        | createdAt          |
                                        +--------------------+
```

> **📌 Bổ sung 10/2026 — Các thực thể gia nhập mô hình dữ liệu** (đặc tả đầy đủ tại `prisma/schema.prisma` và sơ đồ UML 02 — Class & Domain Model):
>
> | Thực thể | Vai trò | Quan hệ chính |
> | :--- | :--- | :--- |
> | `Coupon` / `CouponUsage` | Mã giảm giá 3 loại + lịch sử áp dụng theo user/đơn | Coupon 1—N Order, N—N qua CouponUsage (`@@unique(couponId,userId,orderId)`) |
> | `ProductVariant` | Biến thể SKU màu/size (giá, ảnh, tồn kho riêng) | Product 1—N ProductVariant 1—N OrderItem |
> | `Review` | Đánh giá 1–5 sao xác thực đơn COMPLETED, có `reply` của shop | `@@unique(productId,userId,orderId)` |
> | `Wishlist` | Danh sách yêu thích per-user | User N—N Product qua Wishlist |
> | `Shipment` (+ cột `shippingLogs Json?` lưu timeline log do webhook GHN nối vào) | Vận đơn GHN, trackingCode, COD | Order 1—1 Shipment |
> | `UserWallet` / `WalletTransaction` | Ví nội bộ + sổ giao dịch TOPUP/PURCHASE/REFUND | User 1—1 UserWallet 1—N WalletTransaction |
> | `Notification` | Thông báo per-user, đếm chưa đọc realtime | User 1—N Notification |
> | `StaffPermission` | Ma trận quyền chi tiết cho vai trò STAFF (module orders/products/shipments/chat/reviews) | User 1—N StaffPermission |

---

## 6. THIẾT KẾ API & BẢO MẬT (API SPECIFICATION & SECURITY)

### 6.1. Danh mục API Endpoints

| Phương thức | Đường dẫn API | Chức năng | Phân quyền (Auth) |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Khởi tạo đăng ký tài khoản & gửi mã OTP | Public |
| `POST` | `/api/auth/verify-otp` | Xác thực mã OTP và tạo tài khoản | Public |
| `POST` | `/api/auth/resend-otp` | Yêu cầu gửi lại OTP (cooldown 60s) | Public |
| `GET` | `/api/products` | Lấy danh sách sản phẩm (hỗ trợ filter, search) | Public |
| `POST` | `/api/products` | Tạo sản phẩm mới | Admin |
| `PUT` | `/api/products` | Cập nhật thông tin / tồn kho sản phẩm | Admin |
| `DELETE`| `/api/products?id=...`| Soft delete sản phẩm (`isActive = false`) | Admin |
| `POST` | `/api/orders` | Tạo đơn hàng, reserve tồn kho & sinh VietQR | Public / Customer |
| `GET` | `/api/orders` | Lấy danh sách đơn hàng của tôi hoặc toàn bộ (Admin) | Logged-in User |
| `GET` | `/api/orders/[id]` | Chi tiết đơn hàng | Chủ đơn / Admin |
| `PATCH` | `/api/orders/[id]` | Chuyển đổi trạng thái đơn hàng | Admin |
| `POST` | `/api/webhooks/payment`| Tiếp nhận biến động số dư từ Casso | Secret Token |
| `GET/POST`| `/api/cron/expire-orders`| Tự động quét đơn quá hạn và hoàn kho | Bearer Secret |
| `POST` | `/api/chat/messages` | Gửi tin nhắn chat trong phòng | Room Participant |
| `POST` | `/api/chat/messages/read`| Đánh dấu tin nhắn trong phòng là đã đọc | Room Participant |
| `POST` | `/api/pusher/auth` | Cấp quyền subscription kênh private Pusher | Session + RBAC check |

**Các endpoint bổ sung theo phân hệ mới (đã vận hành):**

| Phương thức | Đường dẫn API | Chức năng | Phân quyền (Auth) |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/wallet/pay` | Thanh toán đơn bằng Ví Shop (CAS) | Customer sở hữu đơn |
| `POST` | `/api/wallet/topup` | Tạo phiên nạp ví (rate-limit 15/phút) | Logged-in |
| `POST` | `/api/shipping/fee` | Tính phí ship động qua GHN | Public |
| `POST` | `/api/shipping/geocode/reverse` | GPS → địa chỉ GHN (Nominatim/BDC/IP) | Public |
| `POST` | `/api/webhooks/ghn` | Webhook lộ trình vận đơn GHN | GHN Token |
| `POST` | `/api/coupons/validate` | Kiểm tra & áp mã giảm giá | Public |
| `POST/DELETE` | `/api/wishlist` | Thêm/bỏ yêu thích (optimistic UI) | Logged-in |
| `POST` | `/api/products/[id]/reviews` | Đánh giá sản phẩm (xác thực đơn COMPLETED) | Customer đã mua |
| `GET` | `/api/admin/analytics` | Dữ liệu dashboard Bento (21 metrics, cache 60s) | Admin/STAFF* |
| `POST` | `/api/admin/transactions/reconcile` | Đối soát VietQR thủ công | Admin |
| `PATCH` | `/api/admin/customers` | Đổi role, khóa/mở khóa tài khoản | Admin |
| `POST` | `/api/admin/upload` | Upload ảnh sản phẩm | Admin/STAFF `products` |

\* STAFF chỉ thấy phần dữ liệu phù hợp ma trận quyền; tài chính & đối soát chỉ dành cho ADMIN.

---

## 7. THIẾT KẾ KIẾN TRÚC MỞ RỘNG TƯƠNG LAI (FUTURE EXTENSIONS DESIGN)

> ✅ **TRẠNG THÁI (cập nhật 10/2026): TẤT CẢ 6 PHÂN HỆ BÊN DƯỚI ĐÃ TRIỂN KHAI HOÀN TẤT**
> và đang vận hành theo đúng thiết kế (thiết kế gốc được giữ nguyên làm tài liệu tham chiếu).
> Vị trí mã nguồn tương ứng được ghi chú ngay dưới mỗi phân hệ.

Để nâng cấp dự án từ bản hiện tại lên hệ thống thương mại điện tử quy mô lớn (Enterprise Production), dưới đây là thiết kế chi tiết cho 6 phân hệ mở rộng trọng yếu:

---

### 7.1. Phân hệ 1: Hệ thống Mã giảm giá & Khuyến mãi (Voucher & Coupon Engine)

> ✅ **Đã triển khai:** `src/server/modules/admin/coupon.service.ts` (validate) + `admin/coupons.controller.ts` (CRUD) · API `/api/coupons/validate`, `/api/admin/coupons` · Test: `tests/coupon.test.ts` · Xóa coupon đã dùng → soft-deactivate.

#### Mục tiêu:
Cho phép áp dụng voucher theo phần trăm (`PERCENTAGE`), số tiền cố định (`FIXED`), hoặc miễn phí vận chuyển (`FREE_SHIPPING`) kèm các điều kiện ràng buộc (giá trị đơn tối thiểu, số lượt dùng tối đa, giới hạn mỗi user).

#### Thiết kế Schema bổ sung:
```prisma
model Coupon {
  id             String       @id @default(cuid())
  code           String       @unique
  description    String?
  discountType   DiscountType @default(FIXED)
  discountValue  Int          // Ví dụ: 50000 (50k) hoặc 10 (10%)
  maxDiscount    Int?         // Mức giảm tối đa nếu là phần trăm
  minOrderAmount Int          @default(0)
  usageLimit     Int          @default(100)
  usedCount      Int          @default(0)
  startDate      DateTime
  endDate        DateTime
  isActive       Boolean      @default(true)
  orders         Order[]
  userUsages     CouponUsage[]
}

enum DiscountType {
  FIXED
  PERCENTAGE
  FREE_SHIPPING
}

model CouponUsage {
  id        String   @id @default(cuid())
  couponId  String
  coupon    Coupon   @relation(fields: [couponId], references: [id])
  userId    String
  orderId   String
  createdAt DateTime @default(now())

  @@unique([couponId, userId, orderId])
}
```

---

### 7.2. Phân hệ 2: Biến thể sản phẩm (Product Variants - Size / Color / SKU)

> ✅ **Đã triển khai:** `src/server/modules/products/` + Matrix Generator trong Admin (tự sinh N biến thể màu×size) · Bất biến đồng bộ 2 chiều: `Product.stock` = tổng stock variant qua `inventory.service` · Tests: `product-variant-lifecycle-and-stock-sync`, `product-variants-ui`.

#### Mục tiêu:
Mỗi sản phẩm cha có thể có nhiều biến thể con với mức giá, hình ảnh, mã SKU và số lượng tồn kho riêng biệt thay vì chỉ quản lý tồn kho ở cấp độ sản phẩm cha.

#### Thiết kế Schema bổ sung:
```prisma
model ProductVariant {
  id         String      @id @default(cuid())
  productId  String
  product    Product     @relation(fields: [productId], references: [id], onDelete: Cascade)
  sku        String      @unique
  title      String      // Ví dụ: "Xanh Navy / Size XL"
  color      String?
  size       String?
  price      Int         // Giá ghi đè của biến thể
  stock      Int         @default(0)
  image      String?
  orderItems OrderItem[]
  createdAt  DateTime    @default(now())
}
```

---

### 7.3. Phân hệ 3: Đánh giá & Xếp hạng sản phẩm (Product Reviews & Ratings)

> ✅ **Đã triển khai:** `src/server/modules/reviews/` · API `/api/products/[id]/reviews` · `resolveReviewEligibility` chặn đánh giá khi chưa mua/đơn chưa COMPLETED · Admin kiểm duyệt + trả lời tại `/admin/reviews` · Tests: `review-submission`, `review-moderation`.

#### Mục tiêu:
Khách hàng chỉ được đánh giá và chấm điểm từ 1 đến 5 sao khi đơn hàng đã hoàn tất (`status == COMPLETED`), hỗ trợ đính kèm hình ảnh thực tế và phản hồi từ Admin.

#### Thiết kế Schema bổ sung:
```prisma
model Review {
  id        String   @id @default(cuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  orderId   String
  rating    Int      // 1 đến 5 sao
  comment   String?
  images    String[] // URLs ảnh đánh giá
  reply     String?  // Phản hồi từ shop
  createdAt DateTime @default(now())

  @@unique([productId, userId, orderId])
}
```

---

### 7.4. Phân hệ 4: Tích hợp Đơn vị Vận chuyển (Logistics Integration - GHN / GHTK)

> ✅ **Đã triển khai (GHN):** `src/server/modules/shipping/` (fee động, tạo vận đơn khi duyệt đơn, webhook lộ trình `/api/webhooks/ghn`) · Dataset địa giới 63 tỉnh đầy đủ qua `npm run ghn:import` · Admin `/admin/shipments` · Test: `tests/ghn.test.ts` · GHTK chưa tích hợp (chỉ GHN).

#### Luồng hoạt động:
1. Khi khách chọn Tỉnh/Thành, Quận/Huyện, Phường/Xã ở Checkout: Hệ thống gọi API GHN/GHTK để tính phí ship động theo cân nặng và khoảng cách.
2. Khi Admin chuyển đơn sang trạng thái `PROCESSING` / `SHIPPING`: Hệ thống tự động đẩy đơn sang GHN/GHTK qua REST API, nhận về **Mã vận đơn (Tracking Code)** và in phiếu gửi hàng.
3. Nhận Webhook lộ trình đơn giao từ đơn vị vận chuyển để tự động cập nhật trạng thái đơn thành `COMPLETED`.

#### Thiết kế Model bổ sung:
```prisma
model Shipment {
  id               String       @id @default(cuid())
  orderId          String       @unique
  order            Order        @relation(fields: [orderId], references: [id])
  carrier          CarrierName  // GHN, GHTK, VIETTEL_POST
  trackingCode     String       @unique
  shippingFee      Int
  codAmount        Int          @default(0)
  status           String       // READY_TO_PICK, DELIVERING, DELIVERED, RETURNED
  estimatedArrival DateTime?
  shippingLogs     Json?
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
}

enum CarrierName {
  GHN
  GHTK
  VIETTEL_POST
}
```

---

### 7.5. Phân hệ 5: Cổng thanh toán Dự phòng & Quản lý Hoàn tiền (Payment Gateway Fallbacks & Refund Engine)

> ⚠️ **Cập nhật 10/2026:** Phân hệ **PayOS đã được GỠ BỎ hoàn toàn** khỏi mã nguồn (cùng Google OAuth)
> để tập trung 2 kênh cốt lõi VietQR/Casso + Ví Shop — phần thiết kế PayOS dưới đây chỉ còn giá trị lịch sử.
> **Còn vận hành:** Ví Shop + Refund Engine tại `src/server/modules/wallet/` + `src/lib/wallet.ts` — CAS chống bán âm ví /
> chống hoàn kép · Nạp ví qua QR VietQR tĩnh, idempotent 4 lớp `wallet-topup.service` · Tests: `wallet`, `wallet-topup`,
> `wallet-vietqr-topup-idempotency` · VNPAY chưa tích hợp.

#### Mục tiêu:
- Bổ sung **PayOS** và **VNPAY QR** chạy song song với VietQR Casso.
- Khi một đơn hàng VietQR bị hủy sau khi đã chuyển tiền, hệ thống kích hoạt luồng **Refund**: Tự động tạo lệnh hoàn tiền vào số tài khoản gốc hoặc cộng vào số dư Ví nội bộ (Shop Wallet).

```prisma
model UserWallet {
  id           String              @id @default(cuid())
  userId       String              @unique
  user         User                @relation(fields: [userId], references: [id])
  balance      Int                 @default(0)
  transactions WalletTransaction[]
  updatedAt    DateTime            @updatedAt
}

model WalletTransaction {
  id          String         @id @default(cuid())
  walletId    String
  wallet      UserWallet     @relation(fields: [walletId], references: [id])
  amount      Int            // Dương (cộng tiền hoàn), Âm (trừ tiền mua hàng)
  type        WalletTxType   // REFUND, PURCHASE, TOPUP
  description String
  createdAt   DateTime       @default(now())
}

enum WalletTxType {
  REFUND
  PURCHASE
  TOPUP
}
```

---

### 7.6. Phân hệ 6: Hạ tầng Caching, Quản lý Media & Rate Limiting (DevOps & Performance)

> ✅ **Đã triển khai:** Upstash Redis tại `src/server/infrastructure/redis.ts` (cache analytics 60s / danh mục 600s / chi tiết SP 120s, fallback in-memory offline) · Rate-limit IP sliding-window `rate-limit.ts` · Media: upload nội bộ `/api/admin/upload` (Cloudinary/S3 CDN là định hướng tương lai, chưa dùng).

```
                            [ Client Request ]
                                    │
                                    ▼
                         [ Cloudflare / CDN ] (DDoS Protection, Static Asset Cache)
                                    │
                                    ▼
                     [ Upstash Redis Rate Limiter ]
                   (Chặn Spam OTP / Brute-force Login)
                                    │
                                    ▼
                      [ Next.js Edge / Node Server ]
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
   [ Upstash Redis Cache ]                      [ Cloudinary / AWS S3 ]
  - Cache Danh mục & Top Sản phẩm               - Upload ảnh Sản phẩm & Review
  - TTL: 60s (Auto invalidate khi update)       - Auto Crop & Resize WebP/AVIF
               │
               ▼
      [ PostgreSQL Database ]
```

---

## 8. KẾT LUẬN & ĐỊNH HƯỚNG TRIỂN KHAI

Tài liệu này xác lập nền tảng phân tích thiết kế hoàn chỉnh cho dự án **Shop QR Payment**. Tính đến 10/2026, toàn bộ 6 phân hệ mở rộng đã được hiện thực (PayOS/Google OAuth sau đó được gỡ bỏ để đơn giản hóa — xem mục 7.5) và hệ thống vận hành ổn định với: 2 kênh thanh toán (VietQR/Casso + Ví nội bộ), vận chuyển GHN tự động, RBAC 3 cấp kèm ma trận phân quyền STAFF, dashboard SaaS realtime, và 45 test suites bảo vệ nghiệp vụ.

**Định hướng tiếp theo (chưa triển khai):**
- CDN ảnh (Cloudinary/S3) thay upload nội bộ; chuẩn hóa CSP/HSTS ở security headers.
- Middleware tập trung bảo vệ route admin (hiện là guard rải rác từng route).
- Phân quyền STAFF ở mức read-only/ghi chi tiết trong từng module.
- Bổ sung cổng VNPAY QR; coupon cho khách vãng lai (hiện guest chỉ tăng `usedCount`).
