# TÀI LIỆU PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG (SYSTEM ANALYSIS & DESIGN)
**Dự án:** Shop QR Payment (Hệ thống Thương mại Điện tử Tích hợp Thanh toán VietQR & Realtime Chat)  
**Phiên bản:** 2.0 (Bao gồm Kiến trúc hiện tại & Thiết kế mở rộng)  
**Ngày lập:** Tháng 09/2026  

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
- **Frontend & Backend Framework:** Next.js 16 (App Router, Server Components & Server Actions), React 19.
- **Ngôn ngữ:** TypeScript 5.x (Strict Type Safety).
- **ORM & Cơ sở dữ liệu:** Prisma ORM v6 + PostgreSQL 14+ (ACID Transaction compliant).
- **Xác thực & Phân quyền:** NextAuth.js (Credentials Provider, Session JWT) + BCrypt + Resend API (OTP Verification).
- **Thanh toán & Đối soát:** VietQR Generator + Casso Webhook Engine (Idempotency verification).
- **Giao tiếp Realtime:** Pusher Server / Pusher Client (WebSockets channels).
- **Kiểm thử tự động:** Node.js Native Test Runner (`node:test`, `node:assert`).
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

Hệ thống được thiết kế theo mô hình **Layered Clean Architecture** kết hợp **Event-driven Realtime** trên nền tảng Serverless Next.js App Router:

```
+-----------------------------------------------------------------------------------+
|                              CLIENT LAYER (Browser)                                |
|  - Next.js 16 Pages & Components (App Router / RSC / Client Components)           |
|  - Zustand Stores (Cart, Notification) | Pusher-js Client (WebSockets)            |
+-----------------------------------------------------------------------------------+
                                         │  ▲ HTTPS (REST API / Next Server Actions)
                                         ▼  │ WebSockets (Realtime Events)
+-----------------------------------------------------------------------------------+
|                        API & BUSINESS LOGIC LAYER (Next.js)                       |
|  +-----------------------------------------------------------------------------+  |
|  |  API Routes (/api/orders, /api/products, /api/chat, /api/auth, /api/cron)   |  |
|  +-----------------------------------------------------------------------------+  |
|  |  Business Core Modules (src/lib/):                                          |  |
|  |   - checkout.ts (Totals calculation & shipping threshold rules)             |  |
|  |   - order-validation.ts (Input sanitation & stock availability guard)       |  |
|  |   - inventory.ts (Atomic reserve/release stock transactions)                |  |
|  |   - payment-parser.ts (VietQR regex parser & amount sanitizer)               |  |
|  |   - order-transitions.ts (Finite State Machine validator)                   |  |
|  |   - otp.ts (BCrypt hash, TTL cleanup, rate limiting)                        |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
         │                                   │                           │
         ▼ (Prisma ORM)                      ▼ (WebSockets Push)         ▼ (Email API)
+--------------------+              +-------------------+       +-------------------+
|   DATABASE LAYER   |              |  PUSHER CHANNELS  |       |    RESEND API     |
|   PostgreSQL 14+   |              |  (Realtime Notif  |       |   (Transactional  |
|  (ACID Relational) |              |   & Chat Streams) |       |    OTP Emails)    |
+--------------------+              +-------------------+       +-------------------+
         ▲
         │ (HTTP Webhook POST + Secure Token)
+-----------------------------------------------------------------------------------+
|                        EXTERNAL PAYMENT GATEWAY (Casso / VietQR)                  |
|  - VietQR Image Generator API (Auto QR creation with order metadata)              |
|  - Casso Bank Webhook Handler (Auto balance fluctuation notification)             |
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

---

## 7. THIẾT KẾ KIẾN TRÚC MỞ RỘNG TƯƠNG LAI (FUTURE EXTENSIONS DESIGN)

Để nâng cấp dự án từ bản hiện tại lên hệ thống thương mại điện tử quy mô lớn (Enterprise Production), dưới đây là thiết kế chi tiết cho 6 phân hệ mở rộng trọng yếu:

---

### 7.1. Phân hệ 1: Hệ thống Mã giảm giá & Khuyến mãi (Voucher & Coupon Engine)

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

Tài liệu này xác lập nền tảng phân tích thiết kế hoàn chỉnh cho dự án **Shop QR Payment**. Hệ thống hiện tại đã đạt sự ổn định cao và sẵn sàng vận hành. Khi quy mô người dùng và sản phẩm tăng trưởng, các phân hệ mở rộng (Voucher, Biến thể sản phẩm, Tích hợp GHN/GHTK, Caching Redis) có thể được bổ sung theo từng module độc lập mà không làm gián đoạn luồng kiến trúc cốt lõi sẵn có.
