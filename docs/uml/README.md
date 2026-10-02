# BỘ 13 SƠ ĐỒ UML KIẾN TRÚC TOÀN DIỆN — DỰ ÁN SHOP-QR-PAYMENT (SHOP.)

> **Tài liệu đặc tả kiến trúc kỹ thuật chuẩn UML 2.5**  
> **Hệ thống:** Website Thương mại điện tử Bán lẻ Tích hợp Thanh toán VietQR Tự động & Quản trị SaaS Bento Grid  
> **Chỉ huy kiến trúc:** Tech Lead & System Architect  
> **Công nghệ cốt lõi:** Next.js 16 App Router, PostgreSQL (Prisma ORM), Upstash Redis, Pusher WebSockets, PayOS VietQR, Giao Hàng Nhanh (GHN) OpenAPI.

---

## 📌 MỤC LỤC 13 BẢNG SƠ ĐỒ UML

### 1. Nhóm Sơ đồ Hành vi & Luồng Tương tác (Behavioral & Interaction Diagrams)
1. [UML 01: Sơ đồ Ca sử dụng (Use Case Diagram)](#uml-01-sơ-đồ-ca-sử-dụng-use-case-diagram)
2. [UML 03: Sơ đồ Tuần tự 1 - Đặt hàng & Thanh toán VietQR](#uml-03-sơ-đồ-tuần-tự-1-đặt-hàng--thanh-toán-vietqr)
3. [UML 04: Sơ đồ Tuần tự 2 - Nạp tiền Ví nội bộ qua VietQR](#uml-04-sơ-đồ-tuần-tự-2-nạp-tiền-ví-nội-bộ-qua-vietqr)
4. [UML 05: Sơ đồ Tuần tự 3 - Hủy đơn & Hoàn tiền Ví CAS Nguyên tử](#uml-05-sơ-đồ-tuần-tự-3-hủy-đơn--hoàn-tiền-ví-cas-nguyên-tử)
5. [UML 06: Sơ đồ Tuần tự 4 - Chat Tư vấn Trực tuyến Real-time](#uml-06-sơ-đồ-tuần-tự-4-chat-tư-vấn-trực-tuyến-real-time)
6. [UML 07: Sơ đồ Hoạt động 1 - Quy trình Đặt hàng & Giữ kho Nguyên tử](#uml-07-sơ-đồ-hoạt-động-1-quy-trình-đặt-hàng--giữ-kho-nguyên-tử)
7. [UML 08: Sơ đồ Hoạt động 2 - Bộ lọc An ninh & Đối soát Webhook Ngân hàng](#uml-08-sơ-đồ-hoạt-động-2-bộ-lọc-an-ninh--đối-soát-webhook-ngân-hàng)
8. [UML 09: Sơ đồ Máy trạng thái 1 - Vòng đời Đơn hàng & Quản lý Kho hàng (Order FSM)](#uml-09-sơ-đồ-máy-trạng-thái-1-vòng-đời-đơn-hàng--quản-lý-kho-hàng)
9. [UML 10: Sơ đồ Máy trạng thái 2 - Vòng đời Vận đơn Giao Hàng Nhanh (Logistics FSM)](#uml-10-sơ-đồ-máy-trạng-thái-2-vòng-đời-vận-đơn-giao-hàng-nhanh)

### 2. Nhóm Sơ đồ Cấu trúc & Phân tầng Phần mềm (Structural & Architectural Diagrams)
10. [UML 02: Sơ đồ Lớp Thực thể & Miền Nghiệp vụ (Class & Domain Model)](#uml-02-sơ-đồ-lớp-thực-thể--miền-nghiệp-vụ-class--domain-model)
11. [UML 11: Sơ đồ Thành phần Kiến trúc Phần mềm (Clean Architecture)](#uml-11-sơ-đồ-thành-phần-kiến-trúc-phần-mềm-clean-architecture)
12. [UML 12: Sơ đồ Triển khai Hạ tầng Hệ thống (Deployment Architecture)](#uml-12-sơ-đồ-triển-khai-hạ-tầng-hệ-thống-deployment-architecture)
13. [UML 13: Sơ đồ Gói & Cấu trúc Mô-đun (Package Diagram)](#uml-13-sơ-đồ-gói--cấu-trúc-mô-đun-package-diagram)

---

## 🏛️ NGUYÊN TẮC BẤT BIẾN KIẾN TRÚC (ARCHITECTURAL INVARIANTS)

Trước khi đi vào chi tiết từng sơ đồ, toàn bộ kỹ sư phát triển hệ thống phải tuân thủ 5 nguyên lý bất biến:
1. **Zero-Server-Leakage:** Mã nguồn client (`@client`) tuyệt đối không bao giờ được phép trực tiếp import các module server (`@server`). Toàn bộ giao tiếp bắt buộc thông qua HTTP REST API với các DTO và Zod Schema xác thực tại `@shared`.
2. **Atomic Inventory Reservation:** Việc giữ tồn kho khi tạo đơn (`reserveOrderStock`) và nhả tồn kho khi hủy đơn (`releaseOrderStock`) bắt buộc phải chạy trong cùng Database Transaction (`prisma.$transaction`) với trạng thái đơn hàng. Không bao giờ cho phép trừ kho ngoài transaction để chống race condition và overselling.
3. **Fail-Closed Webhook Security:** Webhook ngân hàng và cổng thanh toán luôn ở chế độ Fail-Closed: nếu thiếu Webhook Secret trong môi trường Production, hệ thống từ chối lập tức với mã 500. Xác thực chữ ký số bắt buộc dùng `crypto.timingSafeEqual` để loại trừ tấn công vét cạn thời gian (Timing Attack).
4. **Idempotency & Replay Attack Defense:** Mọi giao dịch ngân hàng đều được định danh qua `bankTransId`. Trước khi cộng tiền hoặc xác nhận đơn hàng, hệ thống bắt buộc kiểm tra xem giao dịch đã xử lý hay chưa để triệt tiêu lỗi cộng tiền trùng lặp khi cổng gửi lại webhook nhiều lần.
5. **Compare-And-Swap (CAS) Atomic Wallet:** Việc hoàn tiền đơn hàng vào ví nội bộ sử dụng kỹ thuật nguyên tử có điều kiện: `updateMany(where: {id, paymentStatus: 'PAID'}, data: {paymentStatus: 'REFUNDED'})`. Nếu `count !== 1`, hệ thống abort ngay lập tức để ngăn ngừa lỗi double-refund.

---

### UML 01: Sơ đồ Ca sử dụng (Use Case Diagram)

* **Phân loại UML:** `Use Case Diagram` (Hành vi)
* **Mục đích:** Mô tả tổng quan các tác nhân (Actors) và các trường hợp sử dụng (Use Cases) trong toàn bộ hệ thống shop-qr-payment.
* **Cơ chế kỹ thuật:** Phân tách ranh giới rõ ràng giữa Khách hàng (Storefront), Nhân viên & Quản trị viên (Admin SaaS Bento) và các Dịch vụ Nền / Cổng Tích hợp Ngoài (PayOS, GHN, Cron).

#### Mã nguồn Mermaid:
```mermaid
flowchart LR
    %% Actors
    Customer(["👤 Khách hàng (Customer)"])
    Staff(["👔 Nhân viên (Staff)"])
    Admin(["👑 Quản trị viên (Admin)"])
    PayOS_Bank(["🏦 PayOS & Ngân hàng (NAPAS 247)"])
    GHN(["🚚 GHN Logistics"])
    SystemCron(["⏰ Hệ thống Quét Tự động"])

    %% Storefront Subsystem
    subgraph Storefront ["🛒 Phân hệ Mua sắm & Khách hàng"]
        UC1[1. Xem & Tìm kiếm Sản phẩm]
        UC2[2. Chọn Biến thể Màu / Kích thước (SKU)]
        UC3[3. Quản lý Giỏ hàng & Áp Coupon]
        UC4[4. Đặt hàng & Nhận mã VietQR Động]
        UC5[5. Nạp tiền Ví nội bộ qua VietQR]
        UC6[6. Thanh toán Đơn bằng Ví Shop]
        UC7[7. Hủy đơn & Hoàn tiền vào Ví]
        UC8[8. Chat Tư vấn Trực tuyến Real-time]
        UC9[9. Đánh giá & Gửi nhận xét Sản phẩm]
        UC10[10. Quản lý Danh sách Yêu thích Wishlist]
    end

    %% Admin Subsystem
    subgraph AdminPortal ["📊 Phân hệ Quản trị SaaS Bento"]
        UC11[11. Giám sát Doanh thu Realtime]
        UC12[12. Đối soát Giao dịch VietQR]
        UC13[13. Quản lý Đơn & Đẩy vận đơn GHN]
        UC14[14. Quản lý Sản phẩm, Biến thể & Kho]
        UC15[15. Tư vấn Khách hàng qua Chat Room]
        UC16[16. Kiểm duyệt Đánh giá Review]
        UC17[17. Phân quyền RBAC & Khóa tài khoản]
    end

    %% Background & Gateways
    subgraph Gateways ["⚡ Phân hệ Cổng Tích hợp Ngoài"]
        UC18[18. Webhook Biến động Số dư (HMAC)]
        UC19[19. Webhook Trạng thái Vận đơn GHN]
        UC20[20. Tự động Hủy đơn & Nhả kho quá hạn]
    end

    %% Customer Connections
    Customer --> UC1
    Customer --> UC2
    Customer --> UC3
    Customer --> UC4
    Customer --> UC5
    Customer --> UC6
    Customer --> UC7
    Customer --> UC8
    Customer --> UC9
    Customer --> UC10

    %% Staff Connections
    Staff --> UC13
    Staff --> UC14
    Staff --> UC15

    %% Admin Connections
    Admin --> UC11
    Admin --> UC12
    Admin --> UC13
    Admin --> UC14
    Admin --> UC15
    Admin --> UC16
    Admin --> UC17

    %% External Systems Connections
    PayOS_Bank --> UC18
    UC18 -.->|Khớp tiền đơn hàng| UC4
    UC18 -.->|Khớp tiền nạp ví| UC5
    GHN --> UC19
    UC13 -.->|Sinh mã vận đơn tự động| GHN
    SystemCron --> UC20
```

---

### UML 02: Sơ đồ Lớp Thực thể & Miền Nghiệp vụ (Class & Domain Model)

* **Phân loại UML:** `Class Diagram` (Cấu trúc)
* **Mục đích:** Cấu trúc các thực thể dữ liệu Prisma, quan hệ thực thể (ERD) và các dịch vụ nghiệp vụ chính (Domain Services).
* **Cơ chế kỹ thuật:** Mô hình hóa toàn diện các thực thể quan hệ chặt chẽ: User, Order, Product, ProductVariant, Shipment, UserWallet, ChatRoom, Message, Review, Wishlist cùng các Domain Services chịu trách nhiệm thực thi các bất biến logic.

#### Mã nguồn Mermaid:
```mermaid
classDiagram
    direction TB

    class User {
        +String id
        +String email
        +String passwordHash
        +String name
        +String phone
        +Role role
        +Boolean isVerified
        +Boolean isBlocked
        +DateTime createdAt
    }

    class OtpCode {
        +String id
        +String email
        +String code
        +OtpType type
        +Boolean used
        +Int attempts
        +DateTime expiresAt
    }

    class Product {
        +String id
        +String name
        +String description
        +Int price
        +String category
        +Int stock
        +Boolean isActive
        +DateTime createdAt
    }

    class ProductVariant {
        +String id
        +String productId
        +String sku
        +String title
        +String color
        +String size
        +Int price
        +Int stock
        +Boolean isActive
    }

    class Order {
        +String id
        +String orderCode
        +String customerName
        +String customerPhone
        +String customerAddress
        +Int totalAmount
        +Int subtotal
        +Int discountAmount
        +Int shippingFee
        +OrderStatus status
        +PaymentStatus paymentStatus
        +String qrContent
        +DateTime expiresAt
    }

    class OrderItem {
        +String id
        +String orderId
        +String productId
        +String variantId
        +String variantTitle
        +Int quantity
        +Int price
    }

    class Coupon {
        +String code
        +DiscountType discountType
        +Int discountValue
        +Int minOrderAmount
        +Int usageLimit
        +Int usedCount
        +Boolean isActive
    }

    class CouponUsage {
        +String id
        +String couponId
        +String userId
        +String orderId
    }

    class Transaction {
        +String id
        +String orderId
        +String bankTransId
        +Int amount
        +String description
        +Boolean verified
        +DateTime receivedAt
    }

    class Shipment {
        +String id
        +String orderId
        +CarrierName carrier
        +String trackingCode
        +Int shippingFee
        +ShipmentStatus status
    }

    class UserWallet {
        +String id
        +String userId
        +Int balance
        +DateTime updatedAt
    }

    class WalletTransaction {
        +String id
        +String walletId
        +Int amount
        +WalletTxType type
        +String description
        +DateTime createdAt
    }

    class ChatRoom {
        +String id
        +String orderId
        +String lastMessage
        +DateTime lastActiveAt
    }

    class Message {
        +String id
        +String roomId
        +String senderId
        +String content
        +MessageType type
        +Boolean isRead
        +DateTime createdAt
    }

    class Review {
        +String id
        +String productId
        +String userId
        +Int rating
        +String comment
        +String reply
        +Boolean isApproved
    }

    class Wishlist {
        +String id
        +String userId
        +String productId
        +DateTime createdAt
    }

    %% Domain Service Layer
    class WalletService {
        +getOrCreateWallet(userId)
        +payOrderWithWallet(userId, orderId)
        +refundOrderToWallet(orderId)
    }

    class WalletTopupService {
        +createTopupPaymentLink(userId, amount)
        +processTopupWebhook(payload)
    }

    class InventoryService {
        +reserveOrderStock(tx, items)
        +releaseOrderStock(tx, items)
        +expireUnpaidOrders(prisma)
    }

    class OrderFSM {
        +validateOrderTransition(order, nextStatus)
        +canCancel(order)
        +canShip(order)
    }

    class PayOSService {
        +createPaymentLink(data)
        +verifyWebhookSignature(data)
    }

    class GHNService {
        +calculateFee(data)
        +createShipment(order)
    }

    class ChatService {
        +getOrCreateRoom(userId, orderId)
        +sendMessage(roomId, senderId, content)
        +markAsRead(roomId, userId)
    }

    %% Relationships
    User "1" --> "*" Order : places
    User "1" --> "1" UserWallet : owns
    User "1" --> "*" Review : writes
    User "1" --> "*" Wishlist : saves
    User "1" --> "*" OtpCode : requests
    UserWallet "1" --> "*" WalletTransaction : logs
    Order "1" --> "*" OrderItem : contains
    Product "1" --> "*" ProductVariant : owns
    Product "1" --> "*" OrderItem : references
    ProductVariant "1" --> "*" OrderItem : fulfills
    Order "1" --> "0..1" Transaction : paid_by
    Order "1" --> "0..1" Shipment : shipped_via
    Order "1" --> "0..1" ChatRoom : links
    Coupon "1" --> "*" Order : applies
    Coupon "1" --> "*" CouponUsage : records
    ChatRoom "1" --> "*" Message : contains
    Product "1" --> "*" Review : receives
    Product "1" --> "*" Wishlist : favorited_in

    %% Service Associations
    WalletService ..> UserWallet : mutates_cas
    WalletTopupService ..> UserWallet : credits_cas
    InventoryService ..> Product : locks_and_updates
    InventoryService ..> ProductVariant : locks_and_updates
    OrderFSM ..> Order : guards_transitions
    PayOSService ..> Transaction : reconciles
    GHNService ..> Shipment : syncs_status
    ChatService ..> ChatRoom : orchestrates
```

---

### UML 03: Sơ đồ Tuần tự 1: Đặt hàng & Thanh toán VietQR

* **Phân loại UML:** `Sequence Diagram` (Hành vi)
* **Mục đích:** Quy trình tạo đơn, quét mã VietQR ngân hàng, nhận Webhook an toàn, tự động khớp tiền và đẩy sang GHN.
* **Cơ chế kỹ thuật:** Sử dụng kỹ thuật Atomic Inventory Reservation trong Database Transaction và Verify Webhook HMAC timingSafeEqual ngăn chặn triệt để tấn công Replay Attack và Double-Spending.

#### Mã nguồn Mermaid:
```mermaid
sequenceDiagram
    autonumber
    actor Customer as 👤 Khách hàng
    participant UI as 🖥️ Storefront (Client)
    participant API as ⚙️ Order Controller
    participant Inv as 📦 Inventory Service
    participant PayOS as 🏦 PayOS Gateway (VietQR)
    participant BankApp as 📱 App Ngân hàng (NAPAS 247)
    participant Webhook as 🛡️ Webhook Controller
    participant DB as 🐘 PostgreSQL (Prisma)
    participant Pusher as 📡 Pusher Realtime
    participant GHN as 🚚 GHN Logistics

    Customer->>UI: Bấm "Thanh toán VietQR"
    UI->>API: POST /api/orders (items, address, coupon)
    activate API
    API->>DB: Bắt đầu Database Transaction
    API->>Inv: reserveOrderStock(tx, items) [Trừ kho nguyên tử]
    Inv-->>API: Kho hợp lệ (OK)
    API->>PayOS: createPaymentLink(orderCode, amount)
    PayOS-->>API: Trả về qrContent & checkoutUrl
    API->>DB: Lưu Order (status: PENDING, paymentStatus: UNPAID, expiresAt: +15m)
    API-->>UI: Trả về qrContent & orderCode
    deactivate API

    UI-->>Customer: Hiển thị mã QR ngân hàng kèm đồng hồ đếm ngược 15:00
    Customer->>BankApp: Quét mã VietQR & Xác nhận chuyển khoản NAPAS 247
    BankApp->>PayOS: Xử lý giao dịch liên ngân hàng thành công
    PayOS->>Webhook: POST /api/webhooks/payos (Payload kèm chữ ký HMAC-SHA256)
    
    activate Webhook
    Webhook->>Webhook: verifyPayOSWebhookSignature(timingSafeEqual)
    Webhook->>DB: Kiểm tra Idempotency (bankTransId đã xử lý chưa?)
    Webhook->>DB: Atomic Update Order (status: CONFIRMED, paymentStatus: PAID)
    Webhook->>DB: Lưu Transaction (bankTransId, amount, verified: true)
    Webhook->>GHN: createGHNShipment (Tự động sinh vận đơn giao hàng)
    GHN-->>Webhook: Trả về trackingCode GHN
    Webhook->>DB: Lưu Shipment (trackingCode, status: READY_TO_PICK)
    Webhook->>Pusher: trigger("order-paid", "analytics-updated")
    Webhook-->>PayOS: HTTP 200 OK (Ghi nhận thành công)
    deactivate Webhook

    Pusher-->>UI: Bắn sự kiện "order-paid" qua WebSocket
    UI-->>Customer: Tự động chuyển màn hình "Thanh toán Thành công! Đơn hàng đã xác nhận"
```

---

### UML 04: Sơ đồ Tuần tự 2: Nạp tiền Ví nội bộ qua VietQR

* **Phân loại UML:** `Sequence Diagram` (Hành vi)
* **Mục đích:** Quy trình khởi tạo phiên nạp tiền ví, quét mã QR VietQR PayOS và cộng tiền vào ví nguyên tử có đối soát Idempotent.
* **Cơ chế kỹ thuật:** Sinh mã giao dịch duy nhất có tiền tố `NAPVI`, kiểm tra trùng lặp qua `bankTransId` và tăng số dư ví bằng Atomic CAS Transaction kết hợp bắn Pusher cập nhật UI ngay lập tức.

#### Mã nguồn Mermaid:
```mermaid
sequenceDiagram
    autonumber
    actor Customer as 👤 Khách hàng
    participant UI as 🖥️ Wallet UI (Client)
    participant Ctrl as ⚙️ WalletTopup Controller
    participant Svc as 💳 WalletTopup Service
    participant PayOS as 🏦 PayOS Gateway (VietQR)
    participant BankApp as 📱 App Ngân hàng (NAPAS 247)
    participant Webhook as 🛡️ PayOS Webhook Controller
    participant DB as 🐘 PostgreSQL (Prisma)
    participant Pusher as 📡 Pusher Realtime Cloud

    Customer->>UI: Nhập số tiền nạp & Bấm "Tạo mã QR Nạp tiền"
    UI->>Ctrl: POST /api/wallet/topup (amount: 200.000đ)
    activate Ctrl
    Ctrl->>Ctrl: Rate Limit Check (15 req/phút per IP & User)
    Ctrl->>Svc: createWalletTopupPaymentLink(userId, amount)
    Svc->>Svc: Sinh mã giao dịch duy nhất NAPVI{orderCode}
    Svc->>PayOS: createPaymentLink(orderCode, amount, description)
    PayOS-->>Svc: Trả về qrContent & checkoutUrl
    Svc->>DB: Lưu Topup Session (PENDING, expiresAt: +15m)
    Svc-->>Ctrl: Dữ liệu VietQR
    Ctrl-->>UI: HTTP 200 OK (qrContent, checkoutUrl, topupCode)
    deactivate Ctrl

    UI-->>Customer: Hiển thị mã VietQR Động kèm nội dung NAPVI{orderCode}
    Customer->>BankApp: Mở App Ngân hàng quét QR & Chuyển tiền 24/7
    BankApp->>PayOS: Giao dịch NAPAS 247 thành công
    PayOS->>Webhook: POST /api/webhooks/payos (Kèm chữ ký HMAC-SHA256)

    activate Webhook
    Webhook->>Webhook: verifyPayOSWebhookSignature(timingSafeEqual)
    Webhook->>Webhook: Phân tích mã nạp tiền NAPVI...
    Webhook->>DB: Bắt đầu Prisma Transaction
    Webhook->>DB: Kiểm tra Idempotency bankTransId (Chống cộng tiền trùng lặp)
    Webhook->>DB: Atomic CAS: UserWallet.balance += amount
    Webhook->>DB: Tạo WalletTransaction (type: TOPUP, amount: 200.000đ)
    Webhook->>DB: Tạo Notification (PAYMENT_RECEIVED)
    Webhook->>Pusher: trigger private-user-{userId} ('wallet-updated', 'payment-success')
    Webhook->>Pusher: trigger private-admin-channel ('analytics-updated')
    Webhook-->>PayOS: HTTP 200 OK (Giao dịch nạp ví thành công)
    deactivate Webhook

    Pusher-->>UI: Bắn sự kiện "wallet-updated" với số dư mới
    UI-->>Customer: Màn hình ví cập nhật số dư tức thì & Hiện thông báo thành công
```

---

### UML 05: Sơ đồ Tuần tự 3: Hủy đơn & Hoàn tiền Ví CAS Nguyên tử

* **Phân loại UML:** `Sequence Diagram` (Hành vi)
* **Mục đích:** Quy trình hủy đơn hàng đã thanh toán với cơ chế Atomic CAS chống Double-Refund và tự động hoàn kho.
* **Cơ chế kỹ thuật:** Áp dụng điều kiện `updateMany where: {id, paymentStatus: PAID}, set {paymentStatus: REFUNDED}`. Nếu `updateResult.count !== 1` sẽ rollback ngay lập tức, ngăn ngừa triệt để lỗi đua lệnh hoàn tiền kép.

#### Mã nguồn Mermaid:
```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 Khách hàng / Admin
    participant UI as 🖥️ Giao diện Web (Client)
    participant OrderCtrl as ⚙️ OrderDetail Controller
    participant WalletSvc as 💳 Wallet Service
    participant DB as 🐘 PostgreSQL (Prisma)
    participant InvSvc as 📦 Inventory Service
    participant Pusher as 📡 Pusher Realtime Cloud

    User->>UI: Bấm "Hủy đơn hàng & Hoàn tiền vào Ví"
    UI->>OrderCtrl: PATCH /api/orders/{id} (status: CANCELLED)
    activate OrderCtrl
    OrderCtrl->>WalletSvc: refundOrderToWallet(orderId)
    
    activate WalletSvc
    WalletSvc->>DB: Bắt đầu prisma.$transaction
    WalletSvc->>DB: updateMany (where: {id, paymentStatus: PAID}, data: {paymentStatus: REFUNDED})
    
    alt updateResult.count !== 1 (Đã hoàn tiền trước đó hoặc chưa thanh toán)
        DB-->>WalletSvc: count = 0 (Race Condition / Double Refund Blocked)
        WalletSvc-->>OrderCtrl: Throw Error: Đơn không ở trạng thái PAID
        OrderCtrl-->>UI: HTTP 400 Bad Request (Không thể hoàn tiền trùng lặp)
    else updateResult.count === 1 (Chính xác 1 lần hoàn tiền)
        DB-->>WalletSvc: count = 1 (Atomic CAS thành công)
        WalletSvc->>DB: update UserWallet (balance += totalAmount)
        WalletSvc->>DB: create WalletTransaction (type: REFUND, orderId)
        WalletSvc->>InvSvc: releaseOrderStock(tx, order.items)
        InvSvc->>DB: Tăng lại stock cho Product & ProductVariant
        WalletSvc->>Pusher: trigger private-user-{userId} ('wallet-updated')
        WalletSvc->>Pusher: trigger private-admin-channel ('analytics-updated')
        WalletSvc-->>OrderCtrl: Hoàn tiền thành công
        deactivate WalletSvc
        OrderCtrl-->>UI: HTTP 200 OK (Đơn đã hủy & tiền đã hoàn vào ví)
    end
    deactivate OrderCtrl

    UI-->>User: Hiển thị thông báo "Đã hoàn 100% tiền vào Ví Shop thành công!"
```

---

### UML 06: Sơ đồ Tuần tự 4: Chat Tư vấn Trực tuyến Real-time

* **Phân loại UML:** `Sequence Diagram` (Hành vi)
* **Mục đích:** Quy trình giao tiếp thời gian thực giữa Khách hàng và Quản trị viên/Nhân viên thông qua Pusher WebSockets.
* **Cơ chế kỹ thuật:** Xác thực kênh riêng tư (`private-chat-{roomId}`) qua API bảo mật, lưu trữ tin nhắn vào PostgreSQL, bắn event tức thời đến phòng chat và đồng bộ số tin chưa đọc.

#### Mã nguồn Mermaid:
```mermaid
sequenceDiagram
    autonumber
    actor Customer as 👤 Khách hàng (Client A)
    participant UI_Cust as 🖥️ Chat Window (Storefront)
    participant API as ⚙️ Chat API Controller
    participant Auth as 🛡️ Pusher Auth Controller
    participant DB as 🐘 PostgreSQL (Prisma)
    participant Pusher as 📡 Pusher Realtime Cloud
    participant UI_Admin as 📊 Admin Chat Workspace
    actor Admin as 👑 Nhân viên / Admin (Client B)

    Note over Customer,Admin: 1. Xác thực & Đăng ký kênh WebSocket riêng tư (Pusher Private Channel)
    Customer->>API: GET /api/chat/rooms (Lấy hoặc tạo phòng chat)
    API->>DB: Query/Create ChatRoom & ChatRoomParticipant
    API-->>Customer: Trả về roomId
    Customer->>Auth: POST /api/chat/pusher-auth (channel: private-chat-{roomId})
    Auth->>Auth: Kiểm tra Session User có thuộc phòng chat
    Auth-->>Customer: Trả về Pusher Auth Signature (HMAC)
    Customer->>Pusher: Subscribe channel private-chat-{roomId}

    Admin->>Auth: POST /api/chat/pusher-auth (channel: private-chat-{roomId})
    Auth->>Auth: Kiểm tra Session Admin Role
    Auth-->>Admin: Trả về Pusher Auth Signature
    Admin->>Pusher: Subscribe channel private-chat-{roomId}

    Note over Customer,Admin: 2. Luồng gửi tin nhắn thời gian thực
    Customer->>UI_Cust: Nhập tin nhắn & Nhấn "Gửi"
    UI_Cust->>API: POST /api/chat/messages (roomId, content, type: TEXT)
    activate API
    API->>DB: Kiểm tra quyền tham gia phòng
    API->>DB: INSERT INTO Message (roomId, senderId, content, type)
    API->>DB: UPDATE ChatRoom (lastMessage, lastActiveAt: NOW)
    API->>Pusher: trigger(private-chat-{roomId}, 'new-message', data)
    API->>DB: Tạo Notification (NEW_MESSAGE) cho Admin
    API-->>UI_Cust: HTTP 200 OK (Message Object)
    deactivate API

    Pusher-->>UI_Cust: WebSocket Event 'new-message' (Xác nhận hiển thị)
    Pusher-->>UI_Admin: WebSocket Event 'new-message' tức thì (<100ms)
    UI_Admin-->>Admin: Hiển thị bóng chat & Chuông thông báo tin nhắn mới

    Note over Customer,Admin: 3. Admin phản hồi & Đánh dấu đã đọc
    Admin->>UI_Admin: Mở phòng chat & Trả lời tư vấn
    UI_Admin->>API: POST /api/chat/read (roomId)
    API->>DB: UPDATE ChatRoomParticipant (lastReadAt: NOW)
    UI_Admin->>API: POST /api/chat/messages (roomId, replyContent)
    API->>DB: INSERT Message từ Admin
    API->>Pusher: trigger(private-chat-{roomId}, 'new-message', replyData)
    Pusher-->>UI_Cust: Hiển thị phản hồi của Admin trên màn hình Khách hàng
```

---

### UML 07: Sơ đồ Hoạt động 1: Quy trình Đặt hàng & Giữ kho Nguyên tử

* **Phân loại UML:** `Activity Diagram` (Hành vi)
* **Mục đích:** Quy trình kiểm tra tính hợp lệ, trừ kho nguyên tử (Atomic Inventory Reservation) và phân luồng thanh toán.
* **Cơ chế kỹ thuật:** Đảm bảo tính toàn vẹn kho hàng giữa Product tổng và từng Biến thể SKU trong một ACID Database Transaction duy nhất, phân luồng thanh toán linh hoạt VietQR / Ví nội bộ / COD.

#### Mã nguồn Mermaid:
```mermaid
flowchart TD
    Start([👤 Khách hàng nhấn 'Đặt hàng']) --> ValidateCart{Giỏ hàng có sản phẩm?}
    ValidateCart -- Trống --> ErrEmpty[Báo lỗi: Giỏ hàng rỗng] --> StopErr([Dừng xử lý])
    
    ValidateCart -- Hợp lệ --> CheckCoupon{Có mã Coupon?}
    CheckCoupon -- Có --> ValidateCoupon[Kiểm tra HSD, Lượt dùng & Giá trị tối thiểu]
    ValidateCoupon --> ApplyDiscount[Tính giảm giá: FIXED / PERCENT / FREE_SHIPPING]
    CheckCoupon -- Không --> CalcShipping[Tính phí ship qua GHN OpenAPI]
    ApplyDiscount --> CalcShipping

    CalcShipping --> BeginTx[Bắt đầu Database Transaction]
    BeginTx --> CheckStock{Kiểm tra Tồn kho từng Sản phẩm & Biến thể SKU}
    
    CheckStock -- Thiếu hàng / Không hoạt động --> RollbackTx[Rollback Transaction]
    RollbackTx --> ErrStock[Báo lỗi: Sản phẩm hoặc Biến thể SKU đã hết hàng] --> StopErr

    CheckStock -- Đủ hàng --> ReserveStock[Trừ kho nguyên tử: reserveOrderStock]
    ReserveStock --> CreateOrder[Tạo Order: PENDING, UNPAID, TTL đếm ngược: 15p]
    CreateOrder --> CommitTx[Commit Transaction thành công]

    CommitTx --> ChoosePayment{Phương thức Thanh toán?}
    
    ChoosePayment -- VietQR / PayOS --> GenQR[Gọi API PayOS sinh chuỗi VietQR động]
    GenQR --> ShowPaymentPage[Chuyển hướng đến màn hình Quét mã VietQR]
    
    ChoosePayment -- Ví Shop --> CheckBalance{Số dư ví >= Tổng tiền đơn?}
    CheckBalance -- Thiếu tiền --> ErrWallet[Báo lỗi: Số dư ví không đủ] --> ShowPaymentPage
    CheckBalance -- Đủ tiền --> DeductWallet[Trừ ví nguyên tử & Xác nhận đơn PAID]
    
    ChoosePayment -- COD --> MarkCOD[Đánh dấu đơn COD & Đẩy sang vận đơn GHN]

    ShowPaymentPage --> AwaitPayment([Chờ Webhook Ngân hàng khớp tiền])
    DeductWallet --> SuccessOrder([Đặt hàng thành công & Chuyển sang đóng gói])
    MarkCOD --> SuccessOrder
```

---

### UML 08: Sơ đồ Hoạt động 2: Bộ lọc An ninh & Đối soát Webhook Ngân hàng

* **Phân loại UML:** `Activity Diagram` (Hành vi)
* **Mục đích:** Quy trình xử lý bất biến an toàn (Fail-Closed, Timing-Safe HMAC, Idempotency) khi tiếp nhận dữ liệu ngân hàng.
* **Cơ chế kỹ thuật:** Lọc an ninh 4 lớp: 1. Fail-closed secret check; 2. Timing-safe HMAC-SHA256; 3. Regex parser phân loại đơn hàng DHxxxx và nạp ví NAPVIxxxx; 4. Idempotency check theo bankTransId chống replay attack.

#### Mã nguồn Mermaid:
```mermaid
flowchart TD
    Start([Nhận Request POST Webhook từ PayOS]) --> CheckEnv{Môi trường Production?}
    
    CheckEnv -- Có --> CheckSecretConfig{Có cấu hình Webhook Secret?}
    CheckSecretConfig -- Thiếu --> FailClosed500[Từ chối Fail-Closed 500: Missing Secret Key] --> StopErr([Dừng])
    CheckSecretConfig -- Có --> VerifySignature
    
    CheckEnv -- Development --> DevWarning[Ghi log cảnh báo Dev Mode] --> VerifySignature

    VerifySignature{Kiểm tra chữ ký HMAC-SHA256 timingSafeEqual?}
    VerifySignature -- Chữ ký không khớp --> Reject401[Từ chối 401: Unauthorized / Tampered Request] --> StopErr
    
    VerifySignature -- Chữ ký hợp lệ --> ParseCode[Phân tích mã nội dung chuyển khoản bằng Regex]
    
    ParseCode --> CheckType{Loại giao dịch?}

    %% Nhánh 1: Nạp tiền Ví
    CheckType -- Khớp NAPVIxxxx --> QueryTopup[Truy vấn Phiên Nạp tiền Ví]
    QueryTopup --> CheckTopupExists{Tìm thấy phiên nạp ví?}
    CheckTopupExists -- Không --> LogUnmatched[Lưu Transaction: verified=false, UNMATCHED] --> Resp200[Trả về 200 OK để Ngân hàng không retry]
    
    CheckTopupExists -- Có --> CheckTopupIdempotency{bankTransId đã xử lý trước đó?}
    CheckTopupIdempotency -- Đã xử lý (Replay) --> SkipDupTopup[Bỏ qua nạp trùng: Trả về thành công Idempotent] --> Resp200
    CheckTopupIdempotency -- Giao dịch mới --> AtomicTopup[Atomic CAS: Tăng UserWallet.balance & Tạo WalletTx TOPUP]
    AtomicTopup --> PushPusherWallet[Bắn WebSocket Pusher 'wallet-updated'] --> Resp200

    %% Nhánh 2: Thanh toán Đơn hàng
    CheckType -- Khớp DHxxxx / OrderCode --> QueryOrder[Truy vấn Order trong PostgreSQL]
    QueryOrder --> OrderExists{Tìm thấy đơn hàng?}
    OrderExists -- Không --> LogUnmatched
    
    OrderExists -- Tìm thấy đơn --> CheckOrderDuplicate{bankTransId đã tồn tại trong DB?}
    CheckOrderDuplicate -- Đã tồn tại (Replay Attack) --> SkipDupOrder[Bỏ qua: Tránh ghi nhận đơn trùng lặp] --> Resp200
    
    CheckOrderDuplicate -- Giao dịch mới --> CheckOrderStatus{Trạng thái Đơn hiện tại?}
    CheckOrderStatus -- Đã PAID / CANCELLED / EXPIRED --> LogLateTx[Ghi nhận giao dịch kèm cảnh báo Admin xử lý thủ công] --> Resp200
    
    CheckOrderStatus -- PENDING (Chờ tiền) --> CompareAmount{Số tiền nhận >= Tổng tiền đơn?}
    CompareAmount -- Thiếu tiền --> UnderpaidAlert[Lưu Transaction: Cảnh báo Khách chuyển thiếu tiền] --> Resp200
    
    CompareAmount -- Đủ hoặc Thừa tiền --> AtomicUpdateOrder[Cập nhật Order: status=CONFIRMED, paymentStatus=PAID]
    AtomicUpdateOrder --> PushGHN[Tự động gọi GHN OpenAPI sinh Vận đơn Giao hàng]
    PushGHN --> BroadcastRealtime[Bắn WebSocket Pusher: 'order-paid' & 'analytics-updated']
    BroadcastRealtime --> Resp200 --> EndDone([Hoàn tất xử lý an toàn])
```

---

### UML 09: Sơ đồ Máy trạng thái 1: Vòng đời Đơn hàng & Quản lý Kho hàng

* **Phân loại UML:** `State Machine Diagram` (Hành vi)
* **Mục đích:** Cỗ máy hữu hạn trạng thái (Finite State Machine) quản lý tính nhất quán của Đơn hàng và Kho hàng.
* **Cơ chế kỹ thuật:** Quy định các bước chuyển trạng thái hợp lệ, đồng bộ giữa OrderStatus và PaymentStatus, cam kết giải phóng kho khi đơn bị hủy (CANCELLED) hoặc quá hạn (EXPIRED).

#### Mã nguồn Mermaid:
```mermaid
stateDiagram-v2
    direction TB

    [*] --> PENDING: Khách đặt hàng (reserveOrderStock - Tồn kho bị giữ)

    PENDING --> CONFIRMED: Thanh toán VietQR thành công / Trừ ví thành công
    PENDING --> EXPIRED: Quá hạn 15 phút chưa thanh toán (releaseOrderStock hoàn kho)
    PENDING --> CANCELLED: Khách hàng chủ động hủy đơn trước khi trả tiền (releaseOrderStock)

    CONFIRMED --> PROCESSING: Admin / Nhân viên kho duyệt đóng gói đơn hàng
    CONFIRMED --> CANCELLED: Hủy đơn sau khi thanh toán (Atomic CAS Hoàn tiền Ví + releaseOrderStock)

    PROCESSING --> SHIPPING: Xuất kho & Bàn giao Shipper GHN (Sinh trackingCode)
    PROCESSING --> CANCELLED: Hủy tại kho khi chưa bàn giao (Hoàn tiền Ví + releaseOrderStock)

    SHIPPING --> DELIVERED: Shipper GHN giao hàng thành công (Webhook GHN)
    SHIPPING --> CANCELLED: Giao thất bại 3 lần / Khách từ chối nhận (Hàng quay đầu về kho)

    DELIVERED --> COMPLETED: Khách bấm xác nhận nhận hàng / Hết hạn khiếu nại 7 ngày

    EXPIRED --> [*]
    CANCELLED --> [*]
    COMPLETED --> [*]

    note right of PENDING
        Trạng thái thanh toán: UNPAID
        Đồng hồ đếm ngược TTL: 15 phút
        Kho hàng: Đang giữ chỗ (Reserved)
    end note

    note right of CONFIRMED
        Trạng thái thanh toán: PAID
        Kho hàng: Đã khóa xuất chính thức
    end note

    note right of CANCELLED
        Trạng thái thanh toán: CANCELLED hoặc REFUNDED
        Kho hàng: Đã giải phóng 100% về kho khả dụng
    end note
```

---

### UML 10: Sơ đồ Máy trạng thái 2: Vòng đời Vận đơn Giao Hàng Nhanh

* **Phân loại UML:** `State Machine Diagram` (Hành vi)
* **Mục đích:** Cỗ máy trạng thái vận chuyển (Logistics FSM) đồng bộ với Giao Hàng Nhanh qua OpenAPI và Webhook.
* **Cơ chế kỹ thuật:** Quản lý vòng đời kiện hàng từ lúc tạo phiếu READY_TO_PICK, shipper lấy hàng PICKING, trung chuyển DELIVERING, đến khi DELIVERED hoặc hoàn trả RETURNED.

#### Mã nguồn Mermaid:
```mermaid
stateDiagram-v2
    direction TB

    [*] --> READY_TO_PICK: Đơn hàng PAID -> Gọi GHN API tạo Vận đơn & Lấy trackingCode

    READY_TO_PICK --> PICKING: Tài xế GHN tiếp nhận & Đến kho shop lấy hàng
    READY_TO_PICK --> CANCELLED: Shop hủy đơn trước khi tài xế đến lấy hàng

    PICKING --> DELIVERING: Hàng nhập kho trung chuyển GHN & Xuất tuyến giao hàng

    DELIVERING --> DELIVERED: Khách hàng nhận bưu phẩm thành công (Webhook GHN)
    DELIVERING --> RETURNED: Giao thất bại 3 lần / Khách từ chối nhận hàng (Hàng hoàn trả)

    DELIVERED --> [*]
    RETURNED --> [*]
    CANCELLED --> [*]

    note right of READY_TO_PICK
        Đã cấp mã trackingCode
        In phiếu gửi hàng & dán lên kiện
    end note

    note right of DELIVERING
        Đang luân chuyển trên mạng lưới bưu cục
        Khách hàng theo dõi vị trí qua App/Web
    end note

    note right of DELIVERED
        Kích hoạt cập nhật Order -> DELIVERED
        Đối soát cước phí vận chuyển
    end note

    note right of RETURNED
        Bưu phẩm chuyển hoàn về kho gốc
        Nhân viên kho kiểm tra & hoàn kho
    end note
```

---

### UML 11: Sơ đồ Thành phần Kiến trúc Phần mềm (Clean Architecture)

* **Phân loại UML:** `Component Diagram` (Cấu trúc)
* **Mục đích:** Mô hình phân tầng kiến trúc nghiêm ngặt (@client, @server, @shared) bảo đảm Zero-Server-Leakage.
* **Cơ chế kỹ thuật:** Quy tắc phân tầng Clean Architecture: Tầng Presentation (@client) tuyệt đối không import mã nội bộ của @server, chỉ chia sẻ types và contracts qua @shared và giao tiếp qua HTTP REST APIs.

#### Mã nguồn Mermaid:
```mermaid
flowchart TB
    subgraph PresentationLayer ["🖥️ Tầng Trình diễn (Presentation Layer - @client)"]
        HomeView["HomeView (Hero 3D Parallax & Liquid Flow)"]
        ProductDetailView["ProductDetailView (Variant Selector & Reviews)"]
        CartView["CartView & CheckoutView (VietQR Modal)"]
        WalletView["WalletView (Top-up & Balance Tracker)"]
        WishlistView["WishlistView (Instant Sync)"]
        ChatWindow["ChatWindow & MessageBubble"]
        AdminDashboard["AdminDashboardView (Bento Grid KPIs)"]
        AdminOrders["AdminOrders & Reconcile Views"]
        AdminChat["AdminChatView (Realtime Support)"]
        ZustandStores["Zustand Client Stores (Cart, Wishlist)"]
        PusherClient["Pusher JS WebSocket Client"]
    end

    subgraph ApplicationLayer ["⚙️ Tầng Ứng dụng & Dịch vụ (Application Layer - @server)"]
        OrderRoutes["Order & Checkout Route Handlers"]
        WebhookRoutes["PayOS & GHN Webhook Handlers"]
        WalletRoutes["Wallet Topup & Payment Controllers"]
        ChatRoutes["Chat Messages & Pusher Auth Handlers"]
        AdminRoutes["Analytics, Reconcile & Products Handlers"]
        
        WalletService["WalletService (Atomic CAS Refund & Pay)"]
        WalletTopupService["WalletTopupService (VietQR Idempotency)"]
        InventoryService["InventoryService (Atomic Reservation & Release)"]
        OrderFSM["OrderFSM Engine (State Invariant Guard)"]
        PayOSService["PayOSService (HMAC Gateway & Parsing)"]
        GHNService["GHNService (Logistics OpenAPI & Fee Calc)"]
        ChatService["ChatService (Pusher Realtime Orchestration)"]
    end

    subgraph SharedLayer ["📦 Tầng Dùng chung An toàn (Shared Kernel - @shared)"]
        SharedTypes["DTO Types & API Contract Interfaces"]
        SharedEnums["Domain Enums (OrderStatus, Role, etc.)"]
        SharedValidators["Zod Validation Schemas"]
        SharedErrors["AppError, ValidationError, AuthError"]
        SharedUtils["Formatters, Crypto Utils & Date Helpers"]
    end

    subgraph InfrastructureLayer ["🗄️ Tầng Hạ tầng & Dịch vụ Đám mây (Infrastructure Tier)"]
        PostgresDB[("🐘 PostgreSQL (Prisma ORM with Connection Pool)")]
        RedisCache[("⚡ Upstash Serverless Redis (Cache & Rate Limiting)")]
        PusherCloud["📡 Pusher Channels (WebSocket Realtime Cloud)"]
        PayOSGateway["🏦 PayOS Gateway (VietQR & NAPAS 247)"]
        GHNCloud["🚚 GHN Logistics OpenAPI Server"]
        ResendEmail["✉️ Resend Cloud API (OTP & Password Reset)"]
        CloudinaryCDN["🖼️ Cloudinary CDN (Image Optimization)"]
    end

    %% Dependencies
    PresentationLayer --> SharedLayer
    ApplicationLayer --> SharedLayer
    PresentationLayer -->|Fetch JSON REST APIs| ApplicationLayer
    PresentationLayer -.->|❌ NGHIÊM CẤM IMPORT TRỰC TIẾP (Zero-Leakage)| ApplicationLayer

    ApplicationLayer --> PostgresDB
    ApplicationLayer --> RedisCache
    ApplicationLayer --> PusherCloud
    ApplicationLayer --> PayOSGateway
    ApplicationLayer --> GHNCloud
    ApplicationLayer --> ResendEmail
    ApplicationLayer --> CloudinaryCDN
```

---

### UML 12: Sơ đồ Triển khai Hạ tầng Hệ thống (Deployment Architecture)

* **Phân loại UML:** `Deployment Diagram` (Cấu trúc)
* **Mục đích:** Kiến trúc triển khai phân tán trên nền tảng Serverless, Managed Database và các Micro-SaaS API.
* **Cơ chế kỹ thuật:** Hạ tầng triển khai 5 tầng: Client Tier -> Edge Tier (Cloudflare/Vercel) -> Compute Tier (Next.js 16 Serverless) -> Data Persistence Tier (Neon Postgres + Upstash Redis) -> External SaaS Tier.

#### Mã nguồn Mermaid:
```mermaid
flowchart TB
    %% Client Devices
    subgraph ClientTier ["📱 Tầng Thiết bị Người dùng Cuối (End User Tier)"]
        DesktopBrowser["💻 Trình duyệt Máy tính (Admin & Khách hàng Desktop)"]
        MobileBrowser["📱 Trình duyệt Di động (Mobile Safari / Chrome)"]
        BankAppDevice["🏦 App Ngân hàng Khách hàng (Quét mã VietQR)"]
    end

    %% Edge & Network
    subgraph EdgeTier ["🛡️ Tầng Biên Mạng Toàn cầu (Edge & CDN Tier)"]
        CloudflareEdge["Cloudflare Edge Network / Vercel Edge CDN
- SSL/TLS Termination (Strict HTTPS)
- DDoS Mitigation & Web Application Firewall (WAF)
- Static Asset Caching (JS, CSS, WebP Assets)"]
    end

    %% Compute Tier
    subgraph ComputeTier ["⚡ Tầng Điện toán Không máy chủ (Vercel Serverless Platform)"]
        NodeRuntime["Node.js Serverless Functions (Next.js 16 App Router)
- Edge Middleware (Session Token & RBAC Route Guard)
- API Handlers (/api/orders, /api/webhooks, /api/wallet, /api/chat)
- Server-Side Rendering (SSR) & Dynamic Streaming Components"]
    end

    %% Persistence Tier
    subgraph PersistenceTier ["💾 Tầng Dữ liệu Cốt lõi (Persistence Tier)"]
        PostgresInstance[("🐘 Managed PostgreSQL (Neon / Supabase)
- Connection Pooling (PgBouncer)
- ACID Multi-row Transactions
- Prisma ORM Query Engine")]
        RedisInstance[("⚡ Upstash Serverless Redis
- Distributed Rate Limiter (Token Bucket)
- Catalog Query Caching (TTL 10-60s)")]
    end

    %% External SaaS Ecosystem
    subgraph ExternalSaaSTier ["🌐 Tầng Dịch vụ Đám mây Chuyên biệt (Third-party Cloud Ecosystem)"]
        PayOSServer["🏦 Cổng PayOS / NAPAS 247 Switch (VietQR)"]
        GHNServer["🚚 Giao Hàng Nhanh API (Logistics OpenAPI)"]
        PusherServer["📡 Pusher Cloud Channels (WebSocket Gateway)"]
        ResendServer["✉️ Resend Cloud API (OTP & Password Reset Emails)"]
        CloudinaryServer["🖼️ Cloudinary CDN (Image Transformations)"]
    end

    %% Connections
    DesktopBrowser -->|HTTPS / WSS| CloudflareEdge
    MobileBrowser -->|HTTPS / WSS| CloudflareEdge
    BankAppDevice -->|Quét VietQR chuyển tiền NAPAS| PayOSServer

    CloudflareEdge --> NodeRuntime
    NodeRuntime -->|Prisma TCP / SSL| PostgresInstance
    NodeRuntime -->|REST over HTTPS| RedisInstance
    NodeRuntime -->|Trigger Events| PusherServer
    PusherServer -.->|WSS Push Notifications| DesktopBrowser
    PusherServer -.->|WSS Push Notifications| MobileBrowser

    NodeRuntime -->|Create Payment Link| PayOSServer
    PayOSServer -->|Webhook POST with HMAC| NodeRuntime

    NodeRuntime -->|Create Order & Calc Fee| GHNServer
    GHNServer -->|Webhook Tracking Update| NodeRuntime

    NodeRuntime -->|Send OTP & Reset Password| ResendServer
    NodeRuntime -->|Upload Media| CloudinaryServer
```

---

### UML 13: Sơ đồ Gói & Cấu trúc Mô-đun (Package Diagram)

* **Phân loại UML:** `Package Diagram` (Cấu trúc)
* **Mục đích:** Cấu trúc các gói mã nguồn, quy ước phân vùng trách nhiệm và ranh giới mô-đun trong dự án.
* **Cơ chế kỹ thuật:** Kiểm soát tính độc lập của từng package, tách rời hoàn toàn Presentation (@client), Domain (@server) và Kernel (@shared), đi kèm 250+ unit/integration tests bảo vệ kiến trúc.

#### Mã nguồn Mermaid:
```mermaid
flowchart TB
    %% Root Packages
    subgraph RootProject ["📁 shop-qr-payment (Dự án Gốc)"]
        
        subgraph PkgClient ["📦 @client (src/client)"]
            direction TB
            ClientComponents["components/
├── admin/ (Bento Dashboard, AppShell, Topbar)
├── auth/ (LoginForm, Register, OtpInput)
├── cart/ (CartItem, CartSummary)
├── chat/ (ChatWindow, MessageBubble, ChatRoomList)
├── home/ (HeroFloatingConstellation 3D)
├── layout/ (Header, Footer, Notifications)
├── payment/ (QRPayment, PaymentStatus)
├── product/ (ProductCard, ProductGrid, Reviews)
└── wallet/ (WalletTopupModal, BalanceCard)"]
            ClientViews["views/
├── HomeView
├── ProductDetailView
├── CartView & CheckoutView
├── WalletView & WishlistView
└── admin/ (7 Bento Workspaces: Analytics, Orders, Chat,...)"]
            ClientStores["stores/
├── useCartStore (Zustand)
└── useWishlistStore (Zustand)"]
        end

        subgraph PkgServer ["📦 @server (src/server)"]
            direction TB
            ServerModules["modules/
├── admin/ (admin.service, analytics, reconcile)
├── auth/ (auth-options, rbac-guard, password-reset)
├── catalog/ (catalog.service, caching)
├── chat/ (pusher-auth, chat.service, messages)
├── inventory/ (inventory.service, reservation-engine)
├── notifications/ (notifications.service)
├── orders/ (orders.controller, customer-orders, orders.fsm)
├── payment/ (payos.service, casso, vietqr-parser)
├── products/ (product.service, variant-sync)
├── reviews/ (product-reviews.controller)
├── shipping/ (ghn.service, ghn-webhook.controller)
├── wallet/ (wallet.service, wallet-topup.service)
└── wishlist/ (wishlist.controller)"]
            ServerInfrastructure["infrastructure/
├── redis.ts (Upstash Client & Rate Limiter)
├── pusher.ts (Pusher Server Instance)
└── resend.ts (Email Gateway)"]
        end

        subgraph PkgShared ["📦 @shared (src/shared)"]
            direction TB
            SharedConst["constants/ (HTTP codes, Roles, Limits, Tokens)"]
            SharedErrors["errors/ (AppError, ValidationError, AuthError)"]
            SharedTypes["types/ (Order, Product, Variant, DTO Contracts)"]
            SharedUtils["utils/ (formatVND, cryptoUtils, productVariants)"]
            SharedVal["validations/ (Zod Schemas)"]
        end

        subgraph PkgApp ["📦 App Router (src/app)"]
            AppPages["Routing Facade (Server Components & Route Handlers)
├── (storefront pages: /, /products, /cart, /checkout, /wallet)
├── /admin (Layout Guard & 7 SaaS Workspaces)
└── /api (REST Handlers forwarding to @server modules)"]
        end

        subgraph PkgPrisma ["📦 Prisma Database (prisma)"]
            PrismaSchema["schema.prisma (PostgreSQL 17 Models & Enums)"]
            PrismaSeed["seed.ts (100% Mock & Fixture Data)"]
        end

        subgraph PkgTests ["📦 Test Suites (tests)"]
            TestFiles["250+ Test Cases (node --test)
├── admin-chat-navigation.test.ts
├── order-cancellation-inventory-release.test.ts
├── product-variant-lifecycle-and-stock-sync.test.ts
├── wallet-topup-idempotency.test.ts
└── webhook-security.test.ts"]
        end
    end

    %% Dependency Arrows
    PkgApp --> PkgClient
    PkgApp --> PkgServer
    PkgApp --> PkgShared

    PkgClient --> PkgShared
    PkgServer --> PkgShared
    PkgServer --> PkgPrisma

    %% Zero Server Leakage Rule
    PkgClient -.->|❌ BỊ CHẶN: KHÔNG ĐƯỢC IMPORT| PkgServer

    PkgTests --> PkgServer
    PkgTests --> PkgShared
```
