# Hệ thống chức năng — Cách hoạt động, luồng và ý nghĩa

> Tài liệu mô tả chi tiết từng chức năng của **shop-qr-payment** — cửa hàng trực tuyến
> thanh toán VietQR tức thì. Mọi luồng bên dưới đã được đối chiếu trực tiếp với mã nguồn
> (đường dẫn file kèm theo). Cập nhật: 10/2026.

---

## 0. Tổng quan kiến trúc

**Stack:** Next.js 16 (App Router, React 19) · PostgreSQL + Prisma · Redis · Pusher (realtime) · Resend (email) · GHN (vận chuyển) · VietQR + Casso (thanh toán).

**Clean Architecture 3 lớp:**

```
src/
├── app/            → Routing + API endpoints (mỏng, chỉ gọi controller/service)
├── server/         → Business logic: modules/<domain>/{*.controller, *.service}.ts
│   └── infrastructure/ → redis, rate-limit, cron-auth (hạ tầng dùng chung)
├── client/         → Mọi thứ chạy trên trình duyệt: views, components, stores (zustand), hooks
└── shared/         → Types + utils dùng chung 2 phía (validate, formatVND, checkout math…)
```

**Nguyên tắc xuyên suốt:**
- Controller chỉ xác thực + điều phối; logic nghiệp vụ nằm trong service để test được độc lập.
- Mọi thao tác đổi tiền/kho chạy trong `prisma.$transaction` + điều kiện nguyên tử (CAS) — chống bán âm kho, chống hoàn tiền kép, chống cộng ví trùng.
- Sự kiện realtime qua Pusher: kênh `private-user-<id>` (khách), `private-admin-channel` (quản trị), `private-chat-<roomId>` (chat), được cấp quyền tại `/api/pusher/auth`.
- Redis làm: cache (analytics 60s, danh mục 600s, chi tiết SP 120s), rate-limit, session top-up, lock phân tán.

---

## 1. NHÓM KHÁCH HÀNG

### 1.1. Catalog & tìm kiếm — "khám phá sản phẩm"

**Ý nghĩa:** mặt tiền cửa hàng, duy nhất một nguồn dữ liệu sản phẩm `isActive: true`.

**Luồng:** trang chủ (`src/app/page.tsx`) đọc `?category=&search=&sort=&page=` → `CatalogService.getHomeCatalog`
(`src/server/modules/catalog/catalog.service.ts`):
- Danh mục phân loại được cache Redis 10 phút (key `cache:categories`).
- Sản phẩm query `findMany` với where động (danh mục / contains search / sort `createdAt|price`), **phân trang server-side** 12 sản phẩm/trang, đếm tổng để hiển thị "Hiển thị X/Y".
- `avgRating` tính sẵn từ bảng reviews (không trả điểm khi chưa có đánh giá → UI hiện "Chưa có đánh giá").

**Ý nghĩa thiết kế:** lọc/sắp xếp/phân trang đều chạy phía server nên không bao giờ phải tải toàn bộ catalog xuống máy khách.

### 1.2. Chi tiết sản phẩm & biến thể

**Luồng:** `/products/[id]` → `CatalogService.getProductDetail` — React `cache()` chống query trùng trong 1 request + Redis 120s.
- Sản phẩm có variants: chọn phân loại (màu/size) → giá/tồn kho/ảnh của variant; tồn kho hiển thị theo variant.
- **Bất biến kho:** `Product.stock` khi có variant = tổng stock các variant. Mỗi lần variant trừ/hoàn kho, service inventory đồng bộ cộng/trừ trên sản phẩm gốc (`inventory.service.ts:28-104`) — đảm bảo "Còn X sản phẩm" ở card luôn đúng tổng.

### 1.3. Giỏ hàng

**Luồng:** zustand store + `persist` localStorage (`src/client/stores/cart-store.ts`) — giỏ sống sót qua refresh, không cần đăng nhập. Key giỏ = `productId + variantId`.
- Trang giỏ/checkout render `null` tới khi hydrate xong (tránh lệch SSR/client).
- Mọi thay đổi số lượng giới hạn bởi `MAX_QUANTITY_PER_ITEM`; Validate lại toàn bộ giá/tồn kho **ở server lúc tạo đơn** (client không được tin).

### 1.4. Checkout — nơi hội tụ mọi nghiệp vụ

**Luồng (`src/client/components/checkout/CheckoutForm.tsx` + `POST /api/orders`):**

1. **Địa chỉ giao hàng:** 3 select Tỉnh/Quận/Phường từ dataset GHN (`src/shared/constants/vietnam-locations.ts` — 63 tỉnh/723 quận/11.980 phường, sinh bởi `npm run ghn:import`), hoặc bấm **"Lấy vị trí hiện tại (1 chạm)"** → GPS tự điền (mục 1.5).
2. **Phí ship:** tự tính realtime qua `POST /api/shipping/fee` → GHN API (nặng 500g đầu 30k + 5k/500g kế tiếp khi không có token; **miễn phí ship khi đơn ≥ 500.000đ** — hằng số `FREE_SHIPPING_THRESHOLD`).
3. **Coupon:** `POST /api/coupons/validate` kiểm tra: đang bật, trong hạn, còn lượt (`usageLimit`), đạt `minOrderAmount`, giới hạn mỗi người (`perUserLimit`). Chiết khấu 3 loại: FIXED / PERCENTAGE (chặn `maxDiscount`) / FREE_SHIPPING.
4. **2 kênh thanh toán:** VietQR chuyển khoản (mặc định) · Ví Shop (chỉ bật khi đăng nhập và số dư đủ, được fetch trước ở checkout).

**Ý nghĩa:** server (`orders.controller.ts:30-233`) là nơi quyết định giá cuối cùng — re-validate từng item (SP active, variant active, đủ kho), giá lấy từ DB, `finalTotal = max(0, subtotal + ship − discount)`.

### 1.5. Định vị GPS tự động điền địa chỉ

**Luồng (`CheckoutForm.handleLocateCurrentPosition`):**
1. W3C Geolocation API: thử `enableHighAccuracy` (5s) → không được thử low accuracy (8s) → **watchdog 20s** chống treo (một số hệ điều hành không bao giờ gọi callback).
2. Gửi tọa độ lên `POST /api/shipping/geocode/reverse` → server giải mã: **Nominatim (OpenStreetMap)** chính xác đường/phường → lỗi thì **BigDataCloud** dự phòng.
3. Tên địa danh chuẩn hóa (bỏ dấu, bỏ tiền tố "Tỉnh/Quận/Phường" **chỉ ở đầu chuỗi**) rồi so khớp dần dần: Tỉnh → Quận → **suy luận ngược Phường → Quận cha** (dữ liệu BDC cho VN hay trả tên phường thay vì quận).
4. Không khớp gì → trả `isMatched:false` trung thực → client báo "chọn thủ công", **không bao giờ đoán mù** (trước đây fallback mù từng trả "Huyện đảo Hoàng Sa" cho đất liền Đà Nẵng).
5. GPS bị chặn/URL không phải HTTPS → tự động định vị theo **IP** (`ip-api.com`) — độ chính xác cấp thành phố.

**Ý nghĩa:** giảm thao tác nhập địa chỉ xuống 1 cú bấm, và địa chỉ luôn nằm trong dataset GHN nên tính phí ship không bao giờ lỗi.

### 1.6. Thanh toán VietQR — trái tim của project

**Luồng (đây là lý do project tồn tại):**

```
Tạo đơn ──→ sinh QR VietQR (img.vietqr.io/<ngân hàng>-<STK>?amount=…&addInfo="Thanh toan don hang DH…")
   │         + expiresAt = +15 phút
   ▼
Khách quét & chuyển khoản (app ngân hàng)
   ▼
Casso (cầu nối ngân hàng) gọi POST /api/webhooks/payment
   │  (auth: header secure-token = CASSO_WEBHOOK_SECRET, so khớp timing-safe)
   ▼
vietqr-parser: tách mã "DH…" khỏi nội dung chuyển khoản + số tiền
   │  quyết định PROCESS hoặc SKIP với lý do rõ ràng:
   │  DUPLICATE_TRANSACTION (bankTransId @unique) · NO_ORDER_CODE · INVALID_AMOUNT
   │  ORDER_NOT_FOUND · ALREADY_PAID · ORDER_EXPIRED · ORDER_CANCELLED · UNDERPAID (không cho trả thiếu)
   ▼
Trong 1 transaction: đơn → PAID + CONFIRMED, tạo bản ghi Transaction (verified: true)
   ▼
Bắn đồng thời: notification PAYMENT_RECEIVED + Pusher `payment-success` → trang QR
đổi sang màn hình "đã thanh toán" NGAY LẬP TỨC (không cần F5) · tin nhắn SYSTEM vào
phòng chat đơn hàng · tất cả admin nhận thông báo · analytics-updated cho dashboard
```

**Ý nghĩa:** khách không cần gửi chứng nhận chuyển khoản; tiền về là đơn tự xác nhận. `bankTransId @unique` + nuốt lỗi P2002 = webhook gửi trùng 5 lần cũng chỉ ghi nhận 1 lần.

### 1.7. Cổng thanh toán PayOS — ĐÃ GỠ BỎ (10/2026)

Hệ thống từng tích hợp cổng PayOS làm kênh thanh toán thứ hai (kèm trang mock dev). Từ 10/2026, PayOS và Google OAuth đã được gỡ bỏ hoàn toàn khỏi mã nguồn để tập trung 2 kênh cốt lõi: **VietQR/Casso** và **Ví Shop**. Nạp tiền ví chuyển sang dùng mã QR VietQR tĩnh (mục 1.8); các giao dịch cũ trong DB còn `bankName: 'PAYOS'` vẫn được dashboard thống kê vào nhóm "VietQR chuyển khoản".

### 1.8. Ví Shop — thanh toán 1-chạm & hoàn tiền tự động

**Nạp tiền:** `POST /api/wallet/topup` (rate-limit 15/phút, số tiền 10k–50tr) → session `NAP<mã>` lưu Redis 24h + **mã QR VietQR tĩnh** (img.vietqr.io, nội dung CK = mã nạp) → webhook Casso chứa "NAP <mã>" → `processWalletTopup`:
- **Chống cộng trùng 4 lớp:** guard session COMPLETED → lock phân tán Redis `setNx` 15s → tra `WalletTransaction` TOPUP đã tồn tại theo topupCode/bankTransId → rồi mới `balance: { increment }` + ghi giao dịch.

**Thanh toán bằng ví:** `POST /api/wallet/pay` → toàn bộ chạy trong **một transaction**: sở hữu đơn → chưa PAID → chưa hết hạn → **CAS trừ tiền** `updateMany({ where: { balance: { gte: totalAmount } } })` (count≠1 = số dư đã đổi, báo lỗi) → đơn PAID + CONFIRMED. Ý nghĩa: thanh toán tức thì không cần quét QR, và không bao giờ trừ âm ví.

**Hoàn tiền:** `refundOrderToWallet` (`src/server/modules/wallet/wallet.service.ts`) — khi hủy đơn đã PAID:
- **CAS `updateMany({ where: { paymentStatus: 'PAID' } })`**: chỉ người thắng count===1 được hoàn → hủy 2 lần song song chỉ hoàn 1 lần (chống double-refund).
- Hoàn **100%** `totalAmount` vào ví + giao dịch `REFUND` + **tự động hoàn kho** (`releaseOrderStock`).
- Khách vãng lai (guest, không có ví) → đánh dấu `isGuest` để xử lý ngoài hệ thống.

### 1.9. Vòng đời đơn hàng — FSM (máy trạng thái)

**Trạng thái đơn:** `PENDING → CONFIRMED → PROCESSING → SHIPPING → COMPLETED`, nhánh `CANCELLED` (hạch toán riêng).
**Trạng thái tiền:** `UNPAID → PAID → (REFUNDED | EXPIRED)`.

**Luật (`orders.fsm.ts:41-69`):**
- `CANCELLED` là trạng thái **chốt** — không thể đi tiếp đâu nữa.
- Chưa `PAID` **không được** `SHIPPING` hay `COMPLETED` (chặn ship hàng chưa nhận tiền).
- `EXPIRED → PAID` bị cấm qua đường thường — chỉ **đối soát thủ công** (admin) được "hồi sinh".
- **Khách hàng**: chỉ được hủy đơn **của mình** khi còn `PENDING`, không được đụng `paymentStatus`.
- **Admin**: mọi chuyển trạng thái hợp lệ; đánh dấu PAID thủ công kèm CONFIRMED.

**Hết hạn tự động:** đơn PENDING+UNPAID quá `expiresAt` (15 phút) → cron `/api/cron/expire-orders` (auth `CRON_SECRET`, fail-closed) hoặc chạy lười khi ai đó mở danh sách đơn → CAS: `EXPIRED + CANCELLED` → **hoàn kho + thu hồi coupon**. Ý nghĩa: giữ hàng 15 phút cho khách thanh toán, quá giờ nhả hàng cho người khác.

**Hủy đơn (admin hoặc khách):** trong 1 transaction — đơn đã PAID → `refundOrderToWallet`; chưa PAID → `releaseOrderStock` + `coupon.usedCount` giảm + xóa `couponUsage`. Kèm thông báo + tin nhắn SYSTEM vào phòng chat đơn.

### 1.10. Vận đơn GHN

**Luồng:**
- Admin duyệt đơn chuyển `PROCESSING` → **tự động tạo vận đơn GHN** (`createGHNShipment`: client_order_code = mã đơn, COD = tổng tiền nếu chưa trả, người bán trả cước) → status `READY_TO_PICK`. Không có token → tạo mã tracking mock `GHN…` (dev).
- GHN đẩy trạng thái thật về `POST /api/webhooks/ghn` (auth `GHN_WEBHOOK_TOKEN`, production fail-closed) → map: `delivering→SHIPPING`, `delivered→COMPLETED` (**COD thì đồng thời đánh dấu PAID** — đối soát tiền shipper), `cancel/return→CANCELLED + hoàn kho` → thông báo + Pusher cho khách.
- Mỗi lần GHN cập nhật, 1 dòng shippingLog được nối vào timeline hiển thị ở trang Đơn hàng của khách.

### 1.11. Đánh giá sản phẩm

**Luồng:** chỉ ai có đơn **COMPLETED chứa sản phẩm đó** mới được đánh giá (`resolveReviewEligibility` — kiểm tra sở hữu đơn + trạng thái + chưa đánh giá đơn đó) → `POST /api/products/[id]/reviews` → review `isApproved: true` mặc định. Ràng buộc `@@unique(productId, userId, orderId)` — mỗi đơn mỗi sản phẩm 1 review. Admin ẩn/duyệt + **trả lời** (set `reply`). Điểm trung bình chảy về card sản phẩm + hero trang chủ.

**Ý nghĩa:** review là "bằng chứng mua hàng", không spam được.

### 1.12. Wishlist

**Luồng:** zustand store + optimistic update — bấm tim là đổi màu ngay, API `POST/DELETE /api/wishlist` chạy sau; lỗi thì **rollback** + báo toast (kèm thông điệp riêng cho 401). Có dedupe request đang bay để không gọi API trùng khi bấm nhanh.

### 1.13. Chat & thông báo realtime

**Chat:** mỗi đơn hàng của khách đã đăng nhập **tự tạo 1 phòng chat** (khách + mọi ADMIN, kèm tin nhắn SYSTEM chào) — chat gắn với bối cảnh đơn hàng, không phải chat trôi nổi. Gửi tin → Pusher `private-chat-<roomId>` `new-message` + notification `NEW_MESSAGE`; có đọc-kéo-đã-đọc (`/api/chat/messages/read`), gửi optimistic. Pusher auth (`/api/pusher/auth`) kiểm tra: admin channel cần role ADMIN, chat channel cần là participant, user channel cần đúng user.

**Thông báo:** `createNotification` ghi DB + đếm số chưa đọc + Pusher `private-user-<id>` `new-notification`. Sự kiện: tạo đơn (khách + mọi admin), tiền về (khách + admin), đổi trạng thái, hoàn tiền, tin nhắn mới, chào mừng khi xác thực, đổi mật khẩu.

### 1.14. Tài khoản & bảo mật

- **Đăng ký → OTP:** bcrypt cost 12; OTP 6 số (`crypto.randomInt`), **lưu bcrypt-hash** (rò DB cũng không lộ OTP), TTL 5 phút, cooldown 60 giây giữa 2 lần gửi, tối đa 5 lần nhập sai, tự dọn code cũ. Gửi qua Resend (template React Email).
- **Đăng nhập:** NextAuth credentials (JWT session), chặn tài khoản chưa xác thực/bị khóa. (Google OAuth đã được gỡ bỏ 10/2026.)
- **Quên mật khẩu:** OTP riêng loại PASSWORD_RESET → đặt mã mới → thông báo "Đổi mật khẩu thành công".
- **RBAC:** `Role { CUSTOMER, STAFF, ADMIN }`; admin không tự khóa mình, không hạ chính mình khi là admin cuối. Mọi API admin tự kiểm tra role (401/403) + layout `/admin` redirect về `/login?callbackUrl=/admin&reason=permission`. *Lưu ý: STAFF hiện chưa có quyền riêng biệt.*
- **Rate limit** (Redis INCR + EXPIRE, theo IP `x-forwarded-for`): tạo đơn 10/phút, đăng ký 5/phút, resend OTP 3/phút, quên mật khẩu 3/phút, đặt lại 5/phút, nạp ví 15/phút.
- **Security headers** (`next.config.ts`): X-Frame-Options DENY, nosniff, Referrer-Policy, `Permissions-Policy: camera=(), microphone=(), geolocation=(self)` (cho phép tính năng định vị, chặn iframe third-party).

---

## 2. NHÓM QUẢN TRỊ

### 2.1. Dashboard realtime (Bento Grid)

**Ý nghĩa:** một màn hình trả lời "hôm nay kinh doanh thế nào + có gì cần xử lý ngay".

**Dữ liệu:** `/api/admin/analytics?range=today|7days|month` → `AdminService.getAdminAnalytics` — **21 truy vấn Prisma song song** (doanh thu all-time/hôm nay/hôm qua, đơn theo trạng thái, kho thấp, khách hàng, tỷ lệ khớp QR, vận đơn, giao dịch, trend 24 giờ/7 ngày/30 ngày kèm số đơn, khách mới 12 tháng, cơ cấu thanh toán trên 500 đơn PAID gần nhất, top 5 bán chạy, 5 đơn mới nhất) — cache Redis 60s.

**Card và nguồn số liệu (đã đối chiếu 1:1 với DB):**
| Card | Nguồn |
|---|---|
| Doanh thu kỳ | tổng `totalAmount` đơn PAID trong kỳ + delta vs hôm qua |
| Đơn hàng | count theo kỳ + chip "chờ duyệt" + mini strip theo bucket |
| Tỷ lệ giao thành công | `deliveredShipmentsCount / totalShipmentsCount` (all-time) |
| Khớp VietQR | `(totalTx − chưa khớp) / totalTx` |
| Khách hàng | `user.count(role=CUSTOMER)` + trend 12 tháng |
| Doanh thu kỳ này (progress) | periodRevenue / totalRevenue all-time |
| Đơn hàng (card tối) | tổng đơn all-time + hôm nay + sparkline doanh thu kỳ |
| Top sản phẩm | `orderItem.groupBy` trên đơn PAID |
| Cơ cấu thanh toán | phân loại: `SHOP_WALLET` → Ví, COD>0 không transaction → COD, còn lại → VietQR (Casso) |
| Cần xử lý ngay | giao dịch chưa khớp, tồn kho ≤ 3, đơn chờ duyệt |

**Realtime:** Pusher `analytics-updated` (bắn từ tạo đơn/webhook tiền/đối soát…) + polling 15s + nút làm mới; hiển thị "Sync HH:MM:SS".

### 2.2. Quản lý đơn hàng

Danh sách tất cả đơn + tìm kiếm `?search=` (mã đơn, SĐT); nút hành động theo FSM: Duyệt (CONFIRMED) → Đóng gói (PROCESSING, **tự tạo vận đơn GHN**) → Đã giao (COMPLETED) / Hủy; đánh dấu đã nhận tiền (PAID + CONFIRMED) khi khách chuyển khoản ngoài hệ thống. Mỗi chuyển trạng thái phát thông báo + Pusher + tin nhắn SYSTEM.

### 2.3. Vận đơn GHN

Danh sách shipment + timeline log (được GHN webhook nối vào), sửa thông tin. Trạng thái GHN map 1-1 sang order status (mục 1.10).

### 2.4. Sản phẩm & biến thể

CRUD + **Matrix Generator**: nhập màu × size → tự sinh N biến thể (SKU/ giá/ tồn kho theo mẫu, có dialog xác nhận "Thêm vào" hoặc "Thay thế toàn bộ"). Khi có biến thể: `Product.stock` = tổng variant (đồng bộ 2 chiều cùng inventory service). Xóa SP có dialog xác nhận riêng (ConfirmDialog, thay `confirm()` native).

### 2.5. Đối soát VietQR (thủ công)

**Luồng:** `POST /api/admin/transactions/reconcile` — nhập mã đơn + số tiền:
- Tiền ít hơn đơn → từ chối; đơn đang PAID/CANCELLED → cho phép kèm cảnh báo.
- Đơn CANCELLED/EXPIRED → **tái giữ kho trước** (`reserveOrderStock` — hết kho thì dừng) rồi đơn → PAID + CONFIRMED. Đây là **luồng duy nhất được phép** "hồi sinh" đơn hết hạn (FSM cấm đường thường).
- Ghi `Transaction` với `manualReconcile: true` + email admin thực hiện — đủ dấu vết kiểm toán.

**Ý nghĩa:** khách chuyển khoản đúng tiền nhưng sai nội dung, hoặc ngân hàng/Casso nghẽn webhook — admin vẫn khớp được trong 1 phút.

### 2.6. Coupon (admin) — CRUD; xóa coupon đã có lượt dùng → **soft-deactivate** (tắt, giữ lịch sử).

### 2.7. Khách hàng & RBAC — danh sách user, khóa/mở, thăng/giảm role (có 2 safeguard ở mục 1.14) kèm hộp chọn cấp quyền chi tiết (Permission Matrix) khi user có vai trò STAFF.

### 2.8. Chat CSKH — mọi phòng chat theo đơn, admin hoặc staff có quyền `chat` vào phòng tự tham gia, trả lời realtime; khách nhận ngay qua Pusher.

### 2.9. Kiểm duyệt đánh giá — lọc theo duyệt/điểm/từ khóa; ẩn/duyệt; trả lời công khai dưới sản phẩm; xóa vĩnh viễn (có ConfirmDialog, chỉ dành riêng cho ADMIN).

### 2.10. Nhân viên vận hành (STAFF) & Ma trận phân quyền (Permission Matrix)

**Ý nghĩa:** Tách biệt vai trò vận hành của nhân viên khỏi quyền tài chính và kiểm soát nhân sự của Admin. Một tài khoản `STAFF` được cấp linh hoạt một hoặc nhiều nhóm quyền:
- `orders`: Xem toàn bộ đơn hàng, duyệt đơn, chuyển FSM, hủy/hoàn tiền ví.
- `products`: Thêm/sửa sản phẩm, biến thể, tồn kho, upload ảnh (cấm xóa vĩnh viễn).
- `shipments`: Theo dõi hành trình vận đơn GHN.
- `chat`: Trực chat realtime, auto-join phòng chat khách hàng qua Pusher.
- `reviews`: Kiểm duyệt và phản hồi đánh giá khách hàng (cấm xóa vĩnh viễn).

**Bảo vệ an ninh (Safeguards):**
- STAFF **không** có quyền truy cập: Doanh thu tài chính, Chi tiết banking VietQR, Đối soát ngân hàng, Quản lý coupon và Quản lý phân quyền user.
- Thao tác xóa vĩnh viễn (`DELETE` product, `DELETE` review) chỉ dành cho `ADMIN`.
- Dashboard của STAFF tự động ẩn các biểu đồ doanh thu, chỉ hiển thị số liệu vận hành và danh sách cảnh báo phù hợp với quyền được cấp.

---

## 3. SƠ ĐỒ LUỒNG CHÍNH

```
KHÁCH MUA HÀNG
┌─────────┐   ┌──────────┐   ┌───────────┐   ┌───────────────┐   ┌──────────────┐
│ Giỏ hàng │──▶│ Checkout │──▶│ POST /api │──▶│ QR VietQR 15' │──▶│ Casso webhook│
│ (zustand)│   │ + GPS    │   │ /orders   │   │ QR hoặc Ví    │   │ khớp tiền    │
└─────────┘   └──────────┘   └───────────┘   └───────────────┘   └──────┬───────┘
                                     │ giữ kho 15' (CAS, trừ variant+gốc)│
                                     │ trừ coupon                        ▼
                                     │                          PAID + CONFIRMED
                                     │                 (Pusher đổi màn hình ngay)
                                     ▼                                   ▼
                          (quá 15' → EXPIRED + CANCELLED          Admin duyệt → PROCESSING
                           + hoàn kho + thu hồi coupon)                  │ tự tạo GHN
                                                                         ▼
                                     Hủy đơn (khách chỉ được khi PENDING)│ GHN delivering/
                                     ┌───────────────────────────────────┘ delivered
                                     ▼                                      ▼
              PAID → refund 100% vào ví + hoàn kho (CAS chống hoàn 2 lần)
              chưa PAID → hoàn kho + thu hồi coupon                    COMPLETED → được review
```

---

## 4. HẠN CHẾ ĐÃ BIẾT (trung thực cho người bảo trì sau)

1. **Coupon guest:** đơn vãng lai chỉ tăng `usedCount`, không tạo `couponUsage` (không có userId) → về lý thuyết có thể đẩy `usedCount` vượt `usageLimit` khi guest mua nhiều.
2. **Phân quyền STAFF theo hành động chi tiết:** Hệ thống hỗ trợ phân quyền theo 5 module vận hành (`orders`, `products`, `shipments`, `chat`, `reviews`). Phân quyền sâu hơn ở cấp độ chỉ xem (Read-only) vs ghi (Read-write) trong cùng một module được giữ đơn giản theo triết lý YAGNI (có quyền module là được xem và thao tác tác nghiệp tương ứng, riêng hành vi xóa vĩnh viễn khóa cứng cho ADMIN).
3. **Cơ cấu thanh toán** tính trên 500 đơn PAID gần nhất (cửa sổ xấp xỉ khi dữ liệu rất lớn).
4. **Trend doanh thu theo `createdAt` của đơn**, không phải thời điểm tiền về.
5. Không có CSP/HSTS; admin guard là check rải rác từng route (không có middleware tập trung).
