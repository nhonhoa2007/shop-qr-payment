/**
 * Generator Script for 10 Comprehensive UML Diagrams
 * Project: shop-qr-payment (shop.)
 * Generates:
 *   1. docs/uml/diagrams/*.mmd (Mermaid source files)
 *   2. docs/uml/images/*.svg (Vector graphics)
 *   3. docs/uml/images/*.png (High-resolution raster images)
 *   4. docs/uml/README.md (Master specification document)
 *   5. docs/uml/index.html (Interactive HTML Board Viewer)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const UML_DIR = path.join(PROJECT_ROOT, 'docs', 'uml');
const DIAGRAMS_DIR = path.join(UML_DIR, 'diagrams');
const IMAGES_DIR = path.join(UML_DIR, 'images');

// Ensure directories exist
fs.mkdirSync(DIAGRAMS_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });

const diagrams = [
  {
    id: '01-use-case',
    title: 'Sơ đồ Ca sử dụng (Use Case Diagram)',
    type: 'Use Case',
    description: 'Mô tả tổng quan các tác nhân (Actors) và các trường hợp sử dụng (Use Cases) trong toàn bộ hệ thống shop-qr-payment.',
    mermaid: `flowchart LR
    %% Actors
    Customer(["👤 Khách hàng (Customer)"])
    Admin(["👑 Quản trị viên (Admin)"])
    Staff(["👔 Nhân viên (Staff)"])
    PayOS_Bank(["🏦 PayOS & Ngân hàng"])
    GHN(["🚚 GHN Logistics"])
    SystemCron(["⏰ Hệ thống Quét Tự động"])

    %% Storefront Subsystem
    subgraph Storefront ["🛒 Phân hệ Mua sắm & Khách hàng"]
        UC1[1. Xem & Tìm kiếm Sản phẩm]
        UC2[2. Chọn Biến thể Màu / Kích thước]
        UC3[3. Quản lý Giỏ hàng & Áp Coupon]
        UC4[4. Đặt hàng & Nhận mã VietQR]
        UC5[5. Thanh toán bằng Ví Shop]
        UC6[6. Hủy đơn & Hoàn tiền vào Ví]
        UC7[7. Chat tư vấn trực tuyến]
        UC8[8. Đánh giá Sản phẩm đã mua]
    end

    %% Admin Subsystem
    subgraph AdminPortal ["📊 Phân hệ Quản trị SaaS Bento"]
        UC9[9. Giám sát Doanh thu Realtime]
        UC10[10. Đối soát Giao dịch VietQR]
        UC11[11. Quản lý Đơn & Đẩy vận đơn GHN]
        UC12[12. Quản lý Sản phẩm & Tồn kho]
        UC13[13. Phân quyền RBAC & Khóa tài khoản]
        UC14[14. Kiểm duyệt Đánh giá Review]
    end

    %% Background & Gateways
    subgraph Gateways ["⚡ Phân hệ Cổng Tích hợp Ngoài"]
        UC15[15. Bắn Webhook Biến động Số dư]
        UC16[16. Cập nhật Trạng thái Vận chuyển]
        UC17[17. Tự động Hủy đơn & Nhả kho quá hạn]
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

    %% Staff Connections
    Staff --> UC11
    Staff --> UC12
    Staff --> UC7

    %% Admin Connections
    Admin --> UC9
    Admin --> UC10
    Admin --> UC11
    Admin --> UC12
    Admin --> UC13
    Admin --> UC14

    %% Third-party System Connections
    PayOS_Bank --> UC15
    UC15 -.->|Kích hoạt xác nhận tự động| UC4
    GHN --> UC16
    UC11 -.->|Sinh mã vận đơn tự động| GHN
    SystemCron --> UC17
`
  },
  {
    id: '02-class-domain',
    title: 'Sơ đồ Lớp Thực thể & Miền Nghiệp vụ (Class & Domain Model)',
    type: 'Class / Domain',
    description: 'Cấu trúc các thực thể dữ liệu Prisma, quan hệ thực thể (ERD) và các dịch vụ nghiệp vụ chính (Domain Services).',
    mermaid: `classDiagram
    direction TB

    class User {
        +String id
        +String email
        +String passwordHash
        +Role role
        +Boolean isVerified
        +Boolean isBlocked
        +DateTime createdAt
    }

    class Order {
        +String id
        +String orderCode
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
        +Int quantity
        +Int price
        +String variantTitle
    }

    class Product {
        +String id
        +String name
        +Int price
        +Int stock
        +Boolean isActive
    }

    class ProductVariant {
        +String id
        +String sku
        +String title
        +Int price
        +Int stock
        +Boolean isActive
    }

    class Transaction {
        +String id
        +String bankTransId
        +Int amount
        +String description
        +Boolean verified
    }

    class Shipment {
        +String id
        +String trackingCode
        +CarrierName carrier
        +Int shippingFee
        +ShipmentStatus status
    }

    class UserWallet {
        +String id
        +Int balance
    }

    class WalletTransaction {
        +String id
        +Int amount
        +WalletTxType type
        +String description
    }

    class Coupon {
        +String code
        +DiscountType discountType
        +Int discountValue
        +Int minOrderAmount
        +Boolean isActive
    }

    class Review {
        +String id
        +Int rating
        +String comment
        +Boolean isApproved
    }

    class ChatRoom {
        +String id
        +String orderId
        +String lastMessage
    }

    class Message {
        +String id
        +String content
        +MessageType type
        +Boolean isRead
    }

    %% Domain Service Classes
    class WalletService {
        +getOrCreateWallet(userId)
        +payOrderWithWallet(userId, orderId)
        +refundOrderToWallet(orderId)
    }

    class InventoryService {
        +reserveOrderStock(tx, items)
        +releaseOrderStock(tx, items)
        +expireUnpaidOrders(prisma)
    }

    class OrderFSM {
        +validateOrderTransition(order, nextStatus)
    }

    %% Relationships
    User "1" --> "*" Order : creates
    User "1" --> "1" UserWallet : owns
    UserWallet "1" --> "*" WalletTransaction : logs
    Order "1" --> "*" OrderItem : contains
    Product "1" --> "*" ProductVariant : owns
    Product "1" --> "*" OrderItem : relates
    ProductVariant "1" --> "*" OrderItem : fulfills
    Order "1" --> "1" Transaction : paid_via
    Order "1" --> "0..1" Shipment : delivered_via
    Coupon "1" --> "*" Order : discounts
    Order "1" --> "0..1" ChatRoom : associates
    ChatRoom "1" --> "*" Message : contains
    User "1" --> "*" Review : writes
    Product "1" --> "*" Review : receives
    WalletService ..> UserWallet : operates
    InventoryService ..> Product : manages_stock
    OrderFSM ..> Order : guards_transitions
`
  },
  {
    id: '03-sequence-vietqr-payment',
    title: 'Sơ đồ Tuần tự 1: Thanh toán VietQR & Đối soát Tự động',
    type: 'Sequence',
    description: 'Quy trình tạo đơn, quét mã VietQR ngân hàng, nhận Webhook an toàn, tự động khớp tiền và đẩy sang GHN.',
    mermaid: `sequenceDiagram
    autonumber
    actor Customer as Khách hàng
    participant UI as Giao diện Web (Client)
    participant API as Order Controller (Server)
    participant Inv as Inventory Service
    participant PayOS as Cổng VietQR (PayOS)
    participant BankApp as App Ngân hàng (Mobile)
    participant Webhook as Webhook Controller
    participant DB as PostgreSQL
    participant Pusher as Pusher Realtime
    participant GHN as GHN Logistics

    Customer->>UI: Bấm "Thanh toán VietQR"
    UI->>API: POST /api/orders
    activate API
    API->>DB: Bắt đầu Database Transaction
    API->>Inv: reserveOrderStock(tx, items) [Trừ kho nguyên tử]
    Inv-->>API: Kho hợp lệ (OK)
    API->>PayOS: createPayOSPaymentLink(orderCode, amount)
    PayOS-->>API: Trả về qrContent & checkoutUrl
    API->>DB: Lưu Order (status: PENDING, paymentStatus: UNPAID, expiresAt: +15m)
    API-->>UI: Trả về qrContent
    deactivate API

    UI-->>Customer: Hiển thị mã QR ngân hàng động kèm đồng hồ đếm ngược 15:00
    Customer->>BankApp: Mở App Ngân hàng quét QR & Xác nhận chuyển khoản
    BankApp->>PayOS: Xử lý giao dịch liên ngân hàng NAPAS 24/7
    PayOS->>Webhook: POST /api/webhooks/payos (Kèm chữ ký HMAC-SHA256)
    
    activate Webhook
    Webhook->>Webhook: verifyPayOSWebhookSignature(timingSafeEqual)
    Webhook->>DB: Kiểm tra chống phát lại (Replay Idempotency bankTransId)
    Webhook->>DB: Atomic Update Order (status: CONFIRMED, paymentStatus: PAID)
    Webhook->>DB: Lưu Transaction (bankTransId, verified: true)
    Webhook->>GHN: createGHNShipment (Tự động sinh vận đơn giao hàng)
    GHN-->>Webhook: Trả về mã trackingCode GHN
    Webhook->>DB: Lưu Shipment (trackingCode, status: READY_TO_PICK)
    Webhook->>Pusher: trigger("order-paid", "analytics-updated")
    Webhook-->>PayOS: HTTP 200 OK (Đã tiếp nhận thành công)
    deactivate Webhook

    Pusher-->>UI: Sự kiện "order-paid" đến trình duyệt
    UI-->>Customer: Màn hình tự động chuyển sang "Đã thanh toán thành công!"
`
  },
  {
    id: '04-sequence-wallet-refund',
    title: 'Sơ đồ Tuần tự 2: Hủy đơn & Hoàn tiền Ví CAS Nguyên tử',
    type: 'Sequence',
    description: 'Quy trình hủy đơn hàng đã thanh toán với cơ chế Atomic CAS chống Double-Refund và tự động hoàn kho.',
    mermaid: `sequenceDiagram
    autonumber
    actor User as Khách hàng / Admin
    participant UI as Giao diện Web
    participant OrderCtrl as OrderDetail Controller
    participant WalletSvc as Wallet Service
    participant DB as PostgreSQL
    participant InvSvc as Inventory Service
    participant Pusher as Pusher Gateway

    User->>UI: Bấm Hủy đơn & Hoàn tiền vào Ví
    UI->>OrderCtrl: PATCH /api/orders/id (status: CANCELLED)
    activate OrderCtrl
    OrderCtrl->>WalletSvc: refundOrderToWallet(orderId)
    
    activate WalletSvc
    WalletSvc->>DB: Bắt đầu prisma transaction
    WalletSvc->>DB: updateMany (paymentStatus: PAID to REFUNDED)
    
    alt updateResult.count !== 1
        DB-->>WalletSvc: count = 0
        WalletSvc-->>OrderCtrl: Báo lỗi Đơn không ở trạng thái PAID
        OrderCtrl-->>UI: HTTP 400 Bad Request
    else updateResult.count === 1
        DB-->>WalletSvc: count = 1
        WalletSvc->>DB: update UserWallet (balance += totalAmount)
        WalletSvc->>DB: create WalletTransaction (type: REFUND)
        WalletSvc->>InvSvc: releaseOrderStock(tx, order.items)
        InvSvc->>DB: Tăng lại stock cho Product & Variant
        WalletSvc->>Pusher: trigger private-admin-channel (analytics-updated)
        WalletSvc-->>OrderCtrl: Hoàn tiền thành công
        deactivate WalletSvc
        OrderCtrl-->>UI: HTTP 200 OK (Đơn đã hủy & tiền đã về ví)
    end
    deactivate OrderCtrl

    UI-->>User: Thông báo Đã hoàn 100% tiền vào Ví nội bộ thành công
`
  },
  {
    id: '05-activity-order-placement',
    title: 'Sơ đồ Hoạt động 1: Quy trình Đặt hàng & Giữ kho Nguyên tử',
    type: 'Activity',
    description: 'Quy trình kiểm tra tính hợp lệ, trừ kho nguyên tử (Atomic Inventory Reservation) và phân luồng thanh toán.',
    mermaid: `flowchart TD
    Start([Khách hàng nhấn 'Đặt hàng']) --> ValidateCart{Giỏ hàng có sản phẩm?}
    ValidateCart -- Trống --> ErrEmpty[Báo lỗi: Giỏ hàng rỗng] --> StopErr([Dừng xử lý])
    
    ValidateCart -- Hợp lệ --> CheckCoupon{Có mã Coupon?}
    CheckCoupon -- Có --> ValidateCoupon[Kiểm tra HSD, Lượt dùng & Giá trị tối thiểu]
    ValidateCoupon --> ApplyDiscount[Tính giảm giá: FIXED / PERCENT / SHIP]
    CheckCoupon -- Không --> CalcShipping[Tính phí ship qua GHN OpenAPI]
    ApplyDiscount --> CalcShipping

    CalcShipping --> BeginTx[Bắt đầu Database Transaction]
    BeginTx --> CheckStock{Kiểm tra Tồn kho từng Sản phẩm & Biến thể}
    
    CheckStock -- Thiếu hàng / Không hoạt động --> RollbackTx[Rollback Transaction]
    RollbackTx --> ErrStock[Báo lỗi: Sản phẩm X đã hết hàng] --> StopErr

    CheckStock -- Đủ hàng --> ReserveStock[Trừ kho nguyên tử: reserveOrderStock]
    ReserveStock --> CreateOrder[Tạo bản ghi Order: PENDING, UNPAID, TTL: 15p]
    CreateOrder --> CommitTx[Commit Transaction thành công]

    CommitTx --> ChoosePayment{Phương thức Thanh toán?}
    
    ChoosePayment -- VietQR / PayOS --> GenQR[Gọi API PayOS sinh chuỗi VietQR động]
    GenQR --> ShowPaymentPage[Chuyển hướng đến trang Quét mã VietQR]
    
    ChoosePayment -- Ví Shop --> CheckBalance{Số dư ví >= Tổng tiền?}
    CheckBalance -- Thiếu tiền --> ErrWallet[Báo lỗi: Số dư ví không đủ] --> ShowPaymentPage
    CheckBalance -- Đủ tiền --> DeductWallet[Trừ ví & Xác nhận đơn PAID ngay lập tức]
    
    ChoosePayment -- COD --> MarkCOD[Đánh dấu đơn COD & Chuẩn bị giao hàng]

    ShowPaymentPage --> EndOrder([Chờ thanh toán / Khớp tiền])
    DeductWallet --> EndSuccess([Đặt hàng thành công])
    MarkCOD --> EndSuccess
`
  },
  {
    id: '06-activity-webhook-security',
    title: 'Sơ đồ Hoạt động 2: Bộ lọc An ninh & Đối soát Webhook Ngân hàng',
    type: 'Activity',
    description: 'Quy trình xử lý bất biến an toàn (Fail-Closed, Timing-Safe HMAC, Idempotency) khi tiếp nhận dữ liệu ngân hàng.',
    mermaid: `flowchart TD
    Start([Nhận Request POST Webhook]) --> CheckEnv{Môi trường Production?}
    
    CheckEnv -- Có --> CheckSecretConfig{Có cấu hình Webhook Secret?}
    CheckSecretConfig -- Thiếu --> FailClosed500[Từ chối Fail-Closed 500: Missing Gateway Key] --> StopErr([Dừng])
    CheckSecretConfig -- Có --> VerifySignature
    
    CheckEnv -- Development --> DevWarning[Ghi log cảnh báo Dev Mode] --> VerifySignature

    VerifySignature{Kiểm tra chữ ký HMAC-SHA256 timingSafeEqual?}
    VerifySignature -- Sai chữ ký --> Reject401[Từ chối 401: Unauthorized / Tampered] --> StopErr
    
    VerifySignature -- Khớp chữ ký --> ParseDesc[Phân tích nội dung chuyển khoản bằng Regex]
    ParseDesc --> FindOrderCode{Trích xuất được Mã Đơn DHxxxx?}
    FindOrderCode -- Không tìm thấy --> LogUnmatched[Lưu Transaction: verified=false, UNMATCHED] --> Resp200[Trả về 200 OK để Ngân hàng không retry]
    
    FindOrderCode -- Tìm thấy mã --> QueryDB[Truy vấn Order trong PostgreSQL]
    QueryDB --> OrderExists{Tìm thấy đơn hàng?}
    OrderExists -- Không --> LogUnmatched
    
    OrderExists -- Có đơn hàng --> CheckIdempotency{bankTransId đã tồn tại trong DB?}
    CheckIdempotency -- Đã tồn tại (Replay Attack) --> SkipDuplicate[Bỏ qua: Tránh ghi nhận trùng tiền] --> Resp200
    
    CheckIdempotency -- Giao dịch mới --> CheckOrderStatus{Trạng thái Đơn hiện tại?}
    CheckOrderStatus -- Đã PAID / CANCELLED / EXPIRED --> LogLateTx[Lưu Transaction ghi nhận kèm cảnh báo Admin] --> Resp200
    
    CheckOrderStatus -- PENDING (Chờ tiền) --> CompareAmount{Số tiền nhận >= Tổng tiền đơn?}
    CompareAmount -- Thiếu tiền --> UnderpaidAlert[Lưu Transaction: Cảnh báo Khách chuyển thiếu tiền] --> Resp200
    
    CompareAmount -- Đủ hoặc Thừa tiền --> AtomicUpdate[Cập nhật Order: status=CONFIRMED, paymentStatus=PAID]
    AtomicUpdate --> PushGHN[Tự động tạo Vận đơn GHN OpenAPI]
    PushGHN --> BroadcastRealtime[Bắn WebSocket Pusher: 'order-paid' & 'analytics-updated']
    BroadcastRealtime --> Resp200 --> EndDone([Hoàn tất xử lý an toàn])
`
  },
  {
    id: '07-state-machine-orders',
    title: 'Sơ đồ Máy trạng thái: Vòng đời Đơn hàng & Thanh toán (FSM)',
    type: 'State Machine',
    description: 'Cỗ máy hữu hạn trạng thái (Finite State Machine) quản lý tính nhất quán của Đơn hàng và Kho hàng.',
    mermaid: `stateDiagram-v2
    direction TB

    [*] --> PENDING: Khách đặt hàng (reserveOrderStock - Tồn kho bị giữ)

    PENDING --> CONFIRMED: Thanh toán VietQR thành công / Trừ ví thành công
    PENDING --> EXPIRED: Quá hạn 15 phút chưa thanh toán (releaseOrderStock)
    PENDING --> CANCELLED: Khách hàng chủ động hủy đơn (releaseOrderStock)

    CONFIRMED --> PROCESSING: Admin / Nhân viên kho duyệt đóng gói
    CONFIRMED --> CANCELLED: Hủy đơn sau khi thanh toán (Atomic CAS Hoàn tiền Ví + releaseOrderStock)

    PROCESSING --> SHIPPING: Xuất kho & Bàn giao Shipper GHN (Sinh trackingCode)
    PROCESSING --> CANCELLED: Hủy tại kho (Hoàn tiền Ví + releaseOrderStock)

    SHIPPING --> DELIVERED: GHN Webhook báo giao hàng thành công
    SHIPPING --> CANCELLED: Giao thất bại / Khách từ chối nhận (Hoàn hàng về kho)

    DELIVERED --> COMPLETED: Khách bấm xác nhận / Hết hạn khiếu nại 7 ngày

    EXPIRED --> [*]
    CANCELLED --> [*]
    COMPLETED --> [*]

    note right of PENDING
        Trạng thái thanh toán: UNPAID
        Đồng hồ đếm ngược: 15 phút
    end note

    note right of CONFIRMED
        Trạng thái thanh toán: PAID
        Kho hàng: Đã khóa xuất
    end note

    note right of CANCELLED
        Trạng thái thanh toán: CANCELLED hoặc REFUNDED
        Kho hàng: Đã giải phóng 100%
    end note
`
  },
  {
    id: '08-component-clean-architecture',
    title: 'Sơ đồ Thành phần Kiến trúc Phần mềm (Clean Architecture)',
    type: 'Component',
    description: 'Mô hình phân tầng kiến trúc nghiêm ngặt (@client, @server, @shared) bảo đảm Zero-Server-Leakage.',
    mermaid: `flowchart TB
    subgraph PresentationLayer ["🖥️ Tầng Trình diễn (Presentation Layer - @client)"]
        HomeView["HomeView (Constellation 3D)"]
        ProductDetailView["ProductDetailView"]
        CartView["CartView"]
        CheckoutView["CheckoutView"]
        AdminDashboard["AdminDashboardView (Bento Grid)"]
        AdminOrders["AdminOrdersView"]
        ZustandCart["Zustand Cart Store"]
        PusherClient["Pusher JS Client"]
    end

    subgraph ApplicationLayer ["⚙️ Tầng Ứng dụng & Dịch vụ (Application Layer - @server)"]
        OrderRoutes["Order & Checkout APIs"]
        WebhookRoutes["PayOS & GHN Webhook Handlers"]
        AdminRoutes["Analytics & Reconciliation APIs"]
        WalletService["WalletService (Atomic CAS Refund)"]
        InventoryService["InventoryService (Atomic Stock & Expiry)"]
        OrderFSM["OrderFSM Engine (Invariants Guard)"]
        PayOSService["PayOSService (HMAC Gateway)"]
        GHNService["GHNService (Logistics OpenAPI)"]
    end

    subgraph SharedLayer ["📦 Tầng Dùng chung An toàn (@shared)"]
        SharedTypes["DTO Types & Interfaces"]
        SharedEnums["Domain Enums"]
        SharedValidators["Zod Validation Schemas"]
        SharedErrors["AppError, ValidationError, AuthError"]
        SharedUtils["Formatters & Crypto Utils"]
    end

    subgraph InfrastructureLayer ["🗄️ Tầng Hạ tầng & Dịch vụ Đám mây"]
        PostgresDB[("PostgreSQL Database (Prisma ORM)")]
        RedisCache[("Upstash Redis Cache")]
        PusherCloud["Pusher Realtime Cloud Gateway"]
        PayOSGateway["PayOS Payment API"]
        GHNCloud["GHN OpenAPI Server"]
        CloudinaryCDN["Cloudinary Media CDN"]
    end

    PresentationLayer --> SharedLayer
    ApplicationLayer --> SharedLayer
    PresentationLayer -->|Fetch REST APIs| ApplicationLayer
    PresentationLayer -.->|NGHIÊM CẤM IMPORT TRỰC TIẾP| ApplicationLayer

    ApplicationLayer --> PostgresDB
    ApplicationLayer --> RedisCache
    ApplicationLayer --> PusherCloud
    ApplicationLayer --> PayOSGateway
    ApplicationLayer --> GHNCloud
    ApplicationLayer --> CloudinaryCDN
`
  },
  {
    id: '09-deployment-infrastructure',
    title: 'Sơ đồ Triển khai Hạ tầng Hệ thống (Deployment Architecture)',
    type: 'Deployment',
    description: 'Kiến trúc triển khai phân tán trên nền tảng Serverless, Managed Database và các Micro-SaaS API.',
    mermaid: `flowchart TB
    %% Client Devices
    subgraph ClientTier ["📱 Tầng Người dùng Cuối (End Users)"]
        DesktopBrowser["💻 Máy tính Để bàn (Admin & Customers)"]
        MobileBrowser["📱 Thiết bị Di động (Mobile Safari / Chrome)"]
        BankAppDevice["🏦 App Ngân hàng Khách hàng (Quét VietQR)"]
    end

    %% Edge & Network
    subgraph EdgeTier ["🛡️ Tầng Biên Mạng (Edge & CDN)"]
        CloudflareEdge["Cloudflare Edge Network / Vercel Edge Cache
- SSL/TLS Termination
- DDoS Mitigation & Web Application Firewall (WAF)
- Static Asset Caching (JS/CSS/Next.js Images)"]
    end

    %% Compute Tier
    subgraph ComputeTier ["⚡ Tầng Điện toán Không máy chủ (Vercel Serverless Platform)"]
        NodeRuntime["Node.js Serverless Functions (Next.js 16 App Router)
- Edge Middleware (Session & RBAC Guard)
- API Handlers (/api/orders, /api/webhooks, /api/admin)
- Server-Side Rendering (SSR) & Dynamic Streaming"]
    end

    %% Persistence Tier
    subgraph PersistenceTier ["💾 Tầng Dữ liệu Cốt lõi (Persistence Tier)"]
        PostgresInstance[("🐘 Managed PostgreSQL (Neon / Supabase)
- Connection Pooling
- ACID Transactions
- Prisma Engine Integration")]
        RedisInstance[("⚡ Upstash Serverless Redis
- Catalogue Query Caching (TTL)
- Distributed Rate Limiting")]
    end

    %% External SaaS Ecosystem
    subgraph ExternalSaaSTier ["🌐 Tầng Dịch vụ Đám mây Chuyên biệt (Third-party Cloud Ecosystem)"]
        PayOSServer["🏦 Cổng PayOS / NAPAS 247 Switch (VietQR)"]
        GHNServer["🚚 Giao Hàng Nhanh API (Logistics OpenAPI)"]
        PusherServer["📡 Pusher Cloud Channels (WebSocket Gateway)"]
        ResendServer["✉️ Resend Cloud API (Transactional Emails)"]
        CloudinaryServer["🖼️ Cloudinary CDN (Image Optimization)"]
    end

    %% Connections
    DesktopBrowser -->|HTTPS / WSS| CloudflareEdge
    MobileBrowser -->|HTTPS / WSS| CloudflareEdge
    BankAppDevice -->|Quét QR chuyển tiền| PayOSServer

    CloudflareEdge --> NodeRuntime
    NodeRuntime -->|Prisma TCP / SSL| PostgresInstance
    NodeRuntime -->|REST API over HTTPS| RedisInstance
    NodeRuntime -->|Trigger Events| PusherServer
    PusherServer -.->|WSS Push Notifications| DesktopBrowser
    PusherServer -.->|WSS Push Notifications| MobileBrowser

    NodeRuntime -->|Create Payment Link| PayOSServer
    PayOSServer -->|Webhook POST with HMAC| NodeRuntime

    NodeRuntime -->|Create Order & Calc Fee| GHNServer
    GHNServer -->|Webhook Tracking Update| NodeRuntime

    NodeRuntime -->|Send OTP & Reset Pass| ResendServer
    NodeRuntime -->|Upload Media| CloudinaryServer
`
  },
  {
    id: '10-package-modularity',
    title: 'Sơ đồ Gói & Cấu trúc Mô-đun (Package Diagram)',
    type: 'Package',
    description: 'Cấu trúc các gói mã nguồn, quy ước phân vùng trách nhiệm và ranh giới mô-đun trong dự án.',
    mermaid: `flowchart TB
    %% Root Packages
    subgraph RootProject ["📁 shop-qr-payment (Root)"]
        
        subgraph PkgClient ["📦 @client (src/client)"]
            direction TB
            ClientComponents["components/
├── admin/ (Bento Dashboard, AppShell, Topbar)
├── auth/ (LoginForm, Register, OtpInput)
├── cart/ (CartItem, CartSummary)
├── chat/ (ChatWindow, MessageBubble)
├── home/ (HeroFloatingConstellation 3D)
├── layout/ (Header, Footer, Notifications)
├── payment/ (QRPayment, PaymentStatus)
└── product/ (ProductCard, ProductGrid, Reviews)"]
            ClientViews["views/
├── HomeView
├── ProductDetailView
├── CheckoutView
├── WishlistView
└── admin/ (7 Bento Workspaces)"]
            ClientStores["stores/
└── useCartStore (Zustand)"]
        end

        subgraph PkgServer ["📦 @server (src/server)"]
            direction TB
            ServerModules["modules/
├── admin/ (admin.service, analytics.controller, reconcile)
├── auth/ (auth-options, rbac-guard, password-reset)
├── chat/ (pusher-auth, messages.controller)
├── inventory/ (inventory.service, reservation-engine)
├── orders/ (orders.controller, orders.fsm)
├── payment/ (payos.service, casso, vietqr-parser)
├── shipping/ (ghn.service, ghn-webhook.controller)
└── wallet/ (wallet.service, wallet-pay.controller)"]
            ServerEmails["emails/
└── React Email Templates (OTP, Order Confirmation)"]
        end

        subgraph PkgShared ["📦 @shared (src/shared)"]
            direction TB
            SharedConst["constants/ (HTTP codes, Roles, Limits)"]
            SharedErrors["errors/ (AppError, ValidationError, AuthError)"]
            SharedTypes["types/ (Order, Product, DTO Contracts)"]
            SharedUtils["utils/ (formatVND, cryptoUtils, dateHelpers)"]
            SharedVal["validations/ (Zod Schemas)"]
        end

        subgraph PkgApp ["📦 App Router (src/app)"]
            AppPages["Routing Facade (Server Components & Route Handlers)
├── (storefront pages: /, /products, /cart, /checkout)
├── /admin (Admin Layout Guard & 7 Workspaces)
└── /api (REST Handlers forwarding to @server modules)"]
        end

        subgraph PkgPrisma ["📦 Prisma Database (prisma)"]
            PrismaSchema["schema.prisma (PostgreSQL ORM)"]
            PrismaSeed["seed.ts (100% Thực nghiệm Data)"]
        end

        subgraph PkgTests ["📦 Test Suites (tests)"]
            TestFiles["240 Native Test Cases (node:test)
├── admin-analytics.test.ts
├── password-reset.test.ts
├── payos.test.ts & ghn.test.ts
├── wallet.test.ts & inventory.test.ts
└── webhook-idempotency.test.ts"]
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
`
  }
];

// Helper to sanitize filename
function sanitizeId(id) {
  return id.replace(/[^a-zA-Z0-9-_]/g, '');
}

async function main() {
  console.log('🚀 Bắt đầu khởi tạo và xuất bản 10 Bảng Sơ đồ UML cho shop-qr-payment...');

  // 1. Write individual .mmd files
  for (const d of diagrams) {
    const mmdPath = path.join(DIAGRAMS_DIR, `${d.id}.mmd`);
    fs.writeFileSync(mmdPath, d.mermaid.trim(), 'utf8');
    console.log(`  ✓ Đã ghi file mã nguồn: ${path.relative(PROJECT_ROOT, mmdPath)}`);
  }

  // 2. Render each diagram to SVG and PNG using Google Chrome Headless
  for (let i = 0; i < diagrams.length; i++) {
    const d = diagrams[i];
    const mmd = d.mermaid;
    const svgPath = path.join(IMAGES_DIR, `${d.id}.svg`);
    const pngPath = path.join(IMAGES_DIR, `${d.id}.png`);

    console.log(`  ⏳ [${i + 1}/${diagrams.length}] Đang kết xuất đồ họa cho: ${d.title}...`);

    // Create a standalone render HTML
    const renderHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <style>
    body {
      background-color: #ffffff;
      margin: 0;
      padding: 32px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: inline-block;
    }
    #diagram {
      min-width: 900px;
    }
  </style>
</head>
<body>
  <div id="diagram" class="mermaid">
${mmd}
  </div>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      flowchart: { curve: 'basis', htmlLabels: true },
      themeVariables: {
        primaryColor: '#f2f4f5',
        primaryTextColor: '#000000',
        primaryBorderColor: '#5433eb',
        lineColor: '#5433eb',
        secondaryColor: '#ffffff',
        tertiaryColor: '#ffffff'
      }
    });
  </script>
</body>
</html>`;

    const tempHtmlPath = path.join('/tmp', `uml-render-${d.id}.html`);
    fs.writeFileSync(tempHtmlPath, renderHtml, 'utf8');

    // Export PNG via headless Chrome
    try {
      execSync(
        `google-chrome-stable --headless --disable-gpu --no-sandbox --window-size=1600,1200 --virtual-time-budget=3000 --screenshot="${pngPath}" "${tempHtmlPath}" 2>/dev/null`
      );
    } catch (e) {
      console.warn(`    ⚠️ Lỗi khi xuất PNG cho ${d.id}:`, e.message);
    }

    // Export SVG via headless Chrome dump-dom
    try {
      const domOutput = execSync(
        `google-chrome-stable --headless --disable-gpu --no-sandbox --virtual-time-budget=3000 --dump-dom "${tempHtmlPath}" 2>/dev/null`,
        { maxBuffer: 10 * 1024 * 1024 }
      ).toString('utf8');

      const svgMatch = domOutput.match(/<svg[\s\S]*?<\/svg>/i);
      if (svgMatch) {
        fs.writeFileSync(svgPath, svgMatch[0], 'utf8');
      } else {
        // Fallback: write valid SVG wrapper with raw mermaid
        fs.writeFileSync(
          svgPath,
          `<svg xmlns="http://www.w3.org/2000/svg"><text>${d.title}</text></svg>`,
          'utf8'
        );
      }
    } catch (e) {
      console.warn(`    ⚠️ Lỗi khi xuất SVG cho ${d.id}:`, e.message);
    }

    // Clean up temp file
    try {
      fs.unlinkSync(tempHtmlPath);
    } catch {}
  }

  // 3. Generate Master Markdown Document
  console.log('  📄 Đang biên soạn tài liệu tài liệu tổng hợp docs/uml/README.md...');
  let mdContent = `# BỘ 10 SƠ ĐỒ UML KIẾN TRÚC TOÀN DIỆN — DỰ ÁN SHOP-QR-PAYMENT (SHOP.)

> **Tài liệu đặc tả kiến trúc kỹ thuật chuẩn UML 2.5**  
> **Hệ thống:** Website Thương mại điện tử Bán lẻ Tích hợp Thanh toán VietQR Tự động & Quản trị SaaS Bento Grid  
> **Chỉ huy kiến trúc:** Tech Lead & System Architect  
> **Ngày cập nhật:** ${new Date().toLocaleDateString('vi-VN')}

---

## MỤC LỤC 10 BẢNG SƠ ĐỒ UML

1. [UML 01: Sơ đồ Ca sử dụng (Use Case Diagram)](#uml-01-sơ-đồ-ca-sử-dụng-use-case-diagram)
2. [UML 02: Sơ đồ Lớp Thực thể & Miền Nghiệp vụ (Class & Domain Model)](#uml-02-sơ-đồ-lớp-thực-thể--miền-nghiệp-vụ-class--domain-model)
3. [UML 03: Sơ đồ Tuần tự 1 - Thanh toán VietQR & Đối soát Tự động](#uml-03-sơ-đồ-tuần-tự-1-thanh-toán-vietqr--đối-soát-tự-động)
4. [UML 04: Sơ đồ Tuần tự 2 - Hủy đơn & Hoàn tiền Ví CAS Nguyên tử](#uml-04-sơ-đồ-tuần-tự-2-hủy-đơn--hoàn-tiền-ví-cas-nguyên-tử)
5. [UML 05: Sơ đồ Hoạt động 1 - Đặt hàng & Giữ kho Nguyên tử](#uml-05-sơ-đồ-hoạt-động-1-đặt-hàng--giữ-kho-nguyên-tử)
6. [UML 06: Sơ đồ Hoạt động 2 - Bộ lọc An ninh & Đối soát Webhook](#uml-06-sơ-đồ-hoạt-động-2-bộ-lọc-an-ninh--đối-soát-webhook)
7. [UML 07: Sơ đồ Máy trạng thái - Vòng đời Đơn hàng & Thanh toán (FSM)](#uml-07-sơ-đồ-máy-trạng-thái-vòng-đời-đơn-hàng--thanh-toán-fsm)
8. [UML 08: Sơ đồ Thành phần Kiến trúc Phần mềm (Clean Architecture)](#uml-08-sơ-đồ-thành-phần-kiến-trúc-phần-mềm-clean-architecture)
9. [UML 09: Sơ đồ Triển khai Hạ tầng Hệ thống (Deployment Architecture)](#uml-09-sơ-đồ-triển-khai-hạ-tầng-hệ-thống-deployment-architecture)
10. [UML 10: Sơ đồ Gói & Cấu trúc Mô-đun (Package Diagram)](#uml-10-sơ-đồ-gói--cấu-trúc-mô-đun-package-diagram)

---
`;

  diagrams.forEach((d, idx) => {
    mdContent += `\n### UML ${String(idx + 1).padStart(2, '0')}: ${d.title}

* **Phân loại UML:** \`${d.type} Diagram\`
* **Mục đích:** ${d.description}
* **Đường dẫn Vector (SVG):** \`docs/uml/images/${d.id}.svg\`
* **Đường dẫn Ảnh (PNG):** \`docs/uml/images/${d.id}.png\`

#### Biểu diễn Trực quan:
![${d.title}](./images/${d.id}.png)

#### Mã nguồn Mermaid:
\`\`\`mermaid
${d.mermaid.trim()}
\`\`\`

---
`;
  });

  fs.writeFileSync(path.join(UML_DIR, 'README.md'), mdContent, 'utf8');

  // 4. Generate Interactive HTML Board Dashboard
  console.log('  🌐 Đang tạo Dashboard HTML tương tác docs/uml/index.html...');
  const htmlViewer = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bảng Điều Khiển 10 Sơ Đồ UML — shop-qr-payment (shop.)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <style>
    /* Boutique Refero Tokens */
    :root {
      --canvas: #f2f4f5;
      --violet: #5433eb;
      --ink: #000000;
      --muted: #787574;
    }
    body {
      background-color: var(--canvas);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .shadow-violet {
      box-shadow: 0 4px 24px rgba(69, 36, 219, 0.28);
    }
    .shadow-card {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.02);
    }
  </style>
</head>
<body class="text-[#000000] min-h-screen flex flex-col">

  <!-- TOPBAR -->
  <header class="bg-white border-b border-[#ebebeb] sticky top-0 z-50 px-6 py-4 flex items-center justify-between shadow-xs">
    <div class="flex items-center gap-3">
      <div class="inline-flex items-center gap-1">
        <span class="font-extrabold text-2xl tracking-tighter text-[#000000]">shop</span>
        <span class="w-2.5 h-2.5 rounded-full bg-[#5433eb]"></span>
      </div>
      <span class="text-xs px-2.5 py-1 rounded-full bg-[#5433eb]/10 text-[#5433eb] font-bold">
        UML 2.5 Architecture Board
      </span>
    </div>
    <div class="text-xs text-[#787574] font-medium hidden sm:block">
      Hệ thống Bán lẻ & Thanh toán VietQR Tự động • 10 Sơ đồ Chuẩn hóa
    </div>
  </header>

  <!-- MAIN WORKSPACE -->
  <div class="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-4 sm:p-6 gap-6">

    <!-- SIDEBAR NAVIGATION TABS -->
    <aside class="w-full md:w-80 flex-shrink-0 space-y-2">
      <div class="bg-white rounded-[24px] p-4 border border-[#ebebeb] shadow-card">
        <h2 class="text-xs font-bold uppercase tracking-wider text-[#787574] mb-3 px-2">
          Danh sách 10 Sơ đồ UML
        </h2>
        <nav class="space-y-1" id="nav-list">
          ${diagrams
            .map(
              (d, idx) => `
            <button
              onclick="switchTab(${idx})"
              id="tab-btn-${idx}"
              class="w-full text-left px-3.5 py-2.5 rounded-[16px] text-xs font-semibold transition-all flex items-center justify-between ${
                idx === 0
                  ? 'bg-[#5433eb] text-white shadow-violet'
                  : 'text-slate-700 hover:bg-slate-100'
              }"
            >
              <div class="truncate mr-2">
                <span class="opacity-70 mr-1.5 font-mono">#${String(idx + 1).padStart(2, '0')}</span>
                <span>${d.title.split('(')[0].trim()}</span>
              </div>
              <span class="text-[10px] px-1.5 py-0.5 rounded-full ${
                idx === 0 ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }">
                ${d.type}
              </span>
            </button>
          `
            )
            .join('')}
        </nav>
      </div>

      <!-- EXPORT ACTIONS CARD -->
      <div class="bg-white rounded-[24px] p-4 border border-[#ebebeb] shadow-card space-y-2">
        <h3 class="text-xs font-bold text-[#000000] px-2">Thao tác Nhanh</h3>
        <a
          id="download-png"
          href="./images/01-use-case.png"
          download="01-use-case.png"
          class="w-full block text-center py-2.5 px-4 rounded-full bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
        >
          Tải ảnh PNG Sắc nét
        </a>
        <a
          id="download-svg"
          href="./images/01-use-case.svg"
          download="01-use-case.svg"
          class="w-full block text-center py-2.5 px-4 rounded-full border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
        >
          Tải Vector SVG Gốc
        </a>
      </div>
    </aside>

    <!-- VIEWER CANVAS -->
    <main class="flex-1 min-w-0">
      <div class="bg-white rounded-[28px] p-6 sm:p-8 border border-[#ebebeb] shadow-card flex flex-col min-h-[700px]">
        
        <!-- HEADER OF DIAGRAM -->
        <div class="border-b border-slate-100 pb-4 mb-6">
          <div class="flex items-center gap-2 mb-1.5">
            <span id="diagram-type" class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#5433eb]/10 text-[#5433eb]">
              ${diagrams[0].type} Diagram
            </span>
            <span id="diagram-id" class="text-xs text-slate-400 font-mono">
              ${diagrams[0].id}
            </span>
          </div>
          <h1 id="diagram-title" class="text-xl sm:text-2xl font-bold text-[#000000] tracking-tight">
            ${diagrams[0].title}
          </h1>
          <p id="diagram-desc" class="text-sm text-[#787574] mt-1">
            ${diagrams[0].description}
          </p>
        </div>

        <!-- DIAGRAM DISPLAY CONTAINER -->
        <div class="flex-1 flex items-center justify-center bg-[#fcfcfd] rounded-[20px] p-4 border border-slate-100 overflow-auto">
          <div id="mermaid-container" class="w-full flex justify-center">
            <!-- Mermaid SVG Rendered Here -->
          </div>
        </div>

        <!-- MERMAID CODE COLLAPSIBLE -->
        <details class="mt-6 border-t border-slate-100 pt-4">
          <summary class="text-xs font-bold text-[#5433eb] cursor-pointer hover:underline">
            Xem và sao chép mã nguồn Mermaid
          </summary>
          <pre id="mermaid-code-view" class="mt-3 p-4 rounded-[16px] bg-slate-900 text-emerald-400 text-xs font-mono overflow-auto max-h-60"></pre>
        </details>

      </div>
    </main>

  </div>

  <script>
    const diagramData = ${JSON.stringify(diagrams)};
    let currentIdx = 0;

    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      flowchart: { curve: 'basis' },
      themeVariables: {
        primaryColor: '#f2f4f5',
        primaryTextColor: '#000000',
        primaryBorderColor: '#5433eb',
        lineColor: '#5433eb',
        secondaryColor: '#ffffff',
        tertiaryColor: '#ffffff'
      }
    });

    async function renderCurrentDiagram() {
      const d = diagramData[currentIdx];
      document.getElementById('diagram-title').innerText = d.title;
      document.getElementById('diagram-type').innerText = d.type + ' Diagram';
      document.getElementById('diagram-id').innerText = d.id;
      document.getElementById('diagram-desc').innerText = d.description;
      document.getElementById('download-png').href = './images/' + d.id + '.png';
      document.getElementById('download-png').download = d.id + '.png';
      document.getElementById('download-svg').href = './images/' + d.id + '.svg';
      document.getElementById('download-svg').download = d.id + '.svg';
      document.getElementById('mermaid-code-view').innerText = d.mermaid;

      const container = document.getElementById('mermaid-container');
      container.innerHTML = '<div class="mermaid">' + d.mermaid + '</div>';
      await mermaid.run({ nodes: container.querySelectorAll('.mermaid') });
    }

    function switchTab(idx) {
      document.getElementById('tab-btn-' + currentIdx).className = 'w-full text-left px-3.5 py-2.5 rounded-[16px] text-xs font-semibold transition-all flex items-center justify-between text-slate-700 hover:bg-slate-100';
      currentIdx = idx;
      document.getElementById('tab-btn-' + currentIdx).className = 'w-full text-left px-3.5 py-2.5 rounded-[16px] text-xs font-semibold transition-all flex items-center justify-between bg-[#5433eb] text-white shadow-violet';
      renderCurrentDiagram();
    }

    // Initial render
    window.addEventListener('DOMContentLoaded', () => {
      renderCurrentDiagram();
    });
  </script>

</body>
</html>`;

  fs.writeFileSync(path.join(UML_DIR, 'index.html'), htmlViewer, 'utf8');

  console.log('🎉 ĐÃ HOÀN TẤT XUẤT BẢN TOÀN BỘ 10 SƠ ĐỒ UML THÀNH CÔNG!');
}

main().catch(err => {
  console.error('Lỗi thực thi:', err);
  process.exit(1);
});
