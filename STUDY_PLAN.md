# KẾ HOẠCH HỌC TẬP 4 TUẦN — LÀM CHỦ DỰ ÁN SHOP QR PAYMENT

> **Mục tiêu cuối cùng:** Hiểu rõ 100% kiến trúc, nghiệp vụ, mã nguồn, và có thể **vấn đáp tự tin** với giảng viên về bất kỳ khía cạnh nào của project.
>
> **Quy mô project:** ~43.500 LOC TypeScript · 15 models Prisma · 15 modules server · 45 test suites · 21 sơ đồ UML

---

## TỔNG QUAN CHIẾN LƯỢC

```
Tuần 1: NỀN TẢNG — Hiểu kiến trúc + Tech stack + Database + Luồng chính
Tuần 2: CỐT LÕI — Đi sâu 4 luồng nghiệp vụ trọng yếu (Thanh toán, Đơn hàng, Kho, Wallet)
Tuần 3: MỞ RỘNG — Các phân hệ phụ + Hạ tầng (Chat, GHN, Coupon, Review, Redis, Pusher)
Tuần 4: TỔNG HỢP — Ôn toàn diện + Luyện vấn đáp + Chạy demo thực tế
```

---

## TUẦN 1: NỀN TẢNG KIẾN TRÚC & TECH STACK (7 ngày)

### Ngày 1-2: Bức tranh tổng thể & Tech Stack

**Đọc:**
- [ ] `SYSTEM_DESIGN.md` — Mục 1 (Tổng quan) + Mục 3 (Kiến trúc tổng thể)
- [ ] `docs/HE-THONG-CHUC-NANG.md` — Mục 0 (Tổng quan kiến trúc) — đọc lướt toàn bộ, chưa cần hiểu sâu

**Mục tiêu nắm được:**
- [ ] Project giải quyết vấn đề gì? (Thanh toán VietQR không chạm, không cần chụp bill)
- [ ] Tech stack gồm những gì? (Next.js 16, React 19, Prisma, PostgreSQL, Pusher, Redis, Resend, GHN, VietQR/Casso)
- [ ] Mô hình kiến trúc: Layered Clean Architecture + Event-driven Realtime
- [ ] 4 phân khu mã nguồn: `src/app/` (routing mỏng) → `src/server/` (business logic) → `src/client/` (UI) → `src/shared/` (dùng chung)

**Bài tập tự kiểm tra (viết ra giấy hoặc file .md):**
1. Vẽ lại sơ đồ kiến trúc 4 tầng từ trí nhớ (Client → API → Business → Database + External)
2. Liệt kê 5 công nghệ bên ngoài mà project tích hợp và vai trò của từng cái

### Ngày 3-4: Database Schema — ERD & Quan hệ giữa các bảng

**Đọc:**
- [ ] `prisma/schema.prisma` — đọc KỸ từng model, từng relation, từng enum
- [ ] `SYSTEM_DESIGN.md` — Mục 5 (ERD)
- [ ] `docs/uml/README.md` — UML 02 (Class & Domain Model)

**Mục tiêu nắm được (15 models, nhóm theo chức năng):**

| Nhóm | Models | Câu hỏi cần trả lời được |
|------|--------|--------------------------|
| Người dùng | `User`, `OtpCode`, `StaffPermission` | Có mấy vai trò? OTP lưu thế nào? STAFF được cấp quyền ra sao? |
| Sản phẩm | `Product`, `ProductVariant` | Biến thể liên kết với SP cha thế nào? `Product.stock` đồng bộ thế nào? |
| Đơn hàng | `Order`, `OrderItem` | Đơn có mấy enum trạng thái? `OrderItem` liên kết variant bằng cách nào? |
| Thanh toán | `Transaction`, `UserWallet`, `WalletTransaction` | `bankTransId @unique` có ý nghĩa gì? Ví hoạt động ra sao? |
| Khuyến mãi | `Coupon`, `CouponUsage` | 3 loại giảm giá? Chống dùng quá lượt bằng gì? |
| Vận chuyển | `Shipment` | Mấy trạng thái? Liên kết 1-1 với Order? |
| Giao tiếp | `ChatRoom`, `ChatRoomParticipant`, `Message`, `Notification` | Chat gắn theo đơn hàng? Ai được vào phòng? |
| Tương tác | `Review`, `Wishlist` | Review chặn spam bằng gì (`@@unique`)? |

**Bài tập tự kiểm tra:**
1. Vẽ ERD 15 bảng trên giấy A3 (hoặc dùng draw.io), đánh mũi tên 1-N, 1-1, N-N
2. Giải thích ý nghĩa của 5 `@@unique` constraint quan trọng nhất
3. Liệt kê tất cả enum và giải thích giá trị từng enum

### Ngày 5-6: Cấu trúc mã nguồn & Routing

**Đọc thực tế (mở code, không chỉ đọc docs):**
- [ ] `src/app/` — xem cách routing Next.js App Router: mỗi `page.tsx` chỉ import View component
- [ ] `src/server/modules/` — mở 2-3 module (vd: `orders/`, `auth/`) để thấy pattern Controller + Service
- [ ] `src/client/views/` và `src/client/components/` — thấy cách tách View (page-level) vs Component (reusable)
- [ ] `src/shared/` — types, validations, constants, errors dùng chung 2 phía

**Mục tiêu nắm được:**
- [ ] Pattern "routing facade cực mỏng": `src/app/api/orders/route.ts` chỉ re-export từ controller
- [ ] Tại sao tách controller vs service? (testable, separation of concerns)
- [ ] Client state management: Zustand stores (cart, wishlist) + persist localStorage
- [ ] Path aliases: `@client/*`, `@server/*`, `@shared/*`

**Bài tập tự kiểm tra:**
1. Trace 1 request từ đầu đến cuối: Browser → `src/app/api/orders/route.ts` → `orders.controller.ts` → `inventory.service.ts` → Prisma → Response
2. Mở 3 page.tsx bất kỳ, chỉ ra View component mà nó render

### Ngày 7: API Endpoints & Bảo mật

**Đọc:**
- [ ] `SYSTEM_DESIGN.md` — Mục 6 (API Specification & Security)
- [ ] `docs/HE-THONG-CHUC-NANG.md` — Mục 1.14 (Tài khoản & bảo mật)
- [ ] `src/server/infrastructure/rate-limit.ts` + `cron-auth.ts` — cơ chế bảo vệ

**Mục tiêu nắm được:**
- [ ] Bảng 30+ API endpoints, phân loại theo: Public / Customer / Admin / Secret Token
- [ ] 4 lớp bảo mật: NextAuth JWT, RBAC role check, Rate limiting (Redis), Webhook secret token
- [ ] OTP: bcrypt hash cả mã OTP, cooldown 60s, max 5 attempts

**Bài tập tự kiểm tra:**
1. Phân loại 10 API quan trọng nhất theo mức phân quyền
2. Giải thích tại sao OTP lưu dạng bcrypt hash thay vì plaintext

---

## TUẦN 2: 4 LUỒNG NGHIỆP VỤ CỐT LÕI (7 ngày)

> ⚡ **Đây là tuần quan trọng nhất.** Giảng viên sẽ hỏi sâu về 4 luồng này.

### Ngày 8-9: LUỒNG 1 — Đặt hàng & Giữ kho nguyên tử (Checkout Flow)

**Đọc code (theo thứ tự luồng dữ liệu):**
- [ ] `src/client/components/checkout/CheckoutForm.tsx` — form checkout phía client
- [ ] `src/server/modules/orders/orders.controller.ts` — hàm POST tạo đơn (~200 dòng, đọc từng dòng)
- [ ] `src/server/modules/inventory/inventory.service.ts` — `reserveOrderStock()` + `releaseOrderStock()`
- [ ] `src/shared/utils/checkout.ts` — tính toán subtotal, discount, shipping fee, finalTotal
- [ ] `docs/uml/README.md` — UML 07 (Activity: Đặt hàng & Giữ kho Nguyên tử)

**Khái niệm bắt buộc phải giải thích được:**
- [ ] **Atomic Update (CAS):** `stock: { gte: quantity }` + `decrement: quantity` — tại sao chống race condition?
- [ ] **Prisma $transaction:** tất cả xảy ra trong 1 transaction — reserve stock, create order, create chat room — hoặc toàn bộ rollback
- [ ] **expiresAt = now + 15 phút:** tại sao giữ kho có thời hạn?
- [ ] **Server re-validate giá:** tại sao không tin giá từ client?

**Bài tập tự kiểm tra:**
1. Viết lại luồng checkout thành 8-10 bước tuần tự (bằng lời)
2. Nếu 100 người cùng mua 1 sản phẩm còn 5 cái, hệ thống xử lý thế nào? Giải thích cơ chế CAS
3. Đọc test: `tests/checkout.test.ts`, `tests/inventory.test.ts`, `tests/order-validation.test.ts`

### Ngày 10-11: LUỒNG 2 — Thanh toán VietQR & Webhook Casso (Payment Flow)

**Đọc code:**
- [ ] `src/client/components/payment/QRPayment.tsx` — hiển thị QR + countdown + lắng nghe Pusher
- [ ] `src/server/modules/payment/vietqr.service.ts` — sinh URL mã QR VietQR
- [ ] `src/server/modules/payment/vietqr-parser.service.ts` — **FILE QUAN TRỌNG NHẤT**: parse webhook, 8 cổng chặn
- [ ] `src/server/modules/payment/casso-webhook.controller.ts` — nhận webhook từ ngân hàng
- [ ] `docs/uml/README.md` — UML 03 (Sequence: Thanh toán VietQR) + UML 08 (Activity: Bộ lọc Webhook) + UML 15 (8 cổng chặn)

**Khái niệm bắt buộc phải giải thích được:**
- [ ] **VietQR:** URL `img.vietqr.io/<bank>-<stk>?amount=X&addInfo=DH...` — sinh mã QR chứa đúng số tiền + mã đơn
- [ ] **Casso:** cầu nối ngân hàng → webhook HTTP khi có biến động số dư
- [ ] **Idempotency:** `bankTransId @unique` — webhook gửi 5 lần chỉ xử lý 1 lần (nuốt lỗi P2002 Prisma)
- [ ] **8 cổng chặn trong parser:** DUPLICATE_TRANSACTION, NO_ORDER_CODE, INVALID_AMOUNT, ORDER_NOT_FOUND, ALREADY_PAID, ORDER_EXPIRED, ORDER_CANCELLED, UNDERPAID
- [ ] **Timing-safe token comparison:** so sánh webhook secret chống timing attack

**Bài tập tự kiểm tra:**
1. Vẽ sequence diagram 7 bước: Khách quét QR → Ngân hàng → Casso → Webhook → Parse → Xác nhận → Pusher → UI đổi màu
2. Tại sao cần 8 cổng chặn? Nếu bỏ 1 cổng thì sao?
3. Đọc test: `tests/payment-parser.test.ts`, `tests/webhook-idempotency.test.ts`

### Ngày 12-13: LUỒNG 3 — Vòng đời đơn hàng FSM & Hủy đơn / Hoàn tiền

**Đọc code:**
- [ ] `src/server/modules/orders/orders.fsm.ts` — State Machine (chỉ ~70 dòng, cực kỳ quan trọng)
- [ ] `src/server/modules/orders/orders.controller.ts` — hàm PATCH chuyển trạng thái + hàm hủy đơn
- [ ] `src/server/modules/orders/expire-orders.controller.ts` — cron quét đơn hết hạn
- [ ] `src/server/modules/wallet/wallet.service.ts` — `refundOrderToWallet()` — CAS chống hoàn kép
- [ ] `docs/uml/README.md` — UML 09 (FSM Đơn hàng) + UML 05 (Sequence: Hủy đơn & Hoàn tiền CAS)

**Khái niệm bắt buộc phải giải thích được:**
- [ ] **FSM (Finite State Machine):** `PENDING → CONFIRMED → PROCESSING → SHIPPING → COMPLETED` + nhánh `CANCELLED`
- [ ] **Luật FSM:** CANCELLED là chốt (terminal state); chưa PAID không được SHIPPING/COMPLETED
- [ ] **Hủy đơn đã PAID:** CAS `updateMany({ where: { paymentStatus: 'PAID' } })` count===1 mới hoàn → chống double-refund
- [ ] **Cron expire:** quét đơn PENDING+UNPAID quá 15 phút → EXPIRED+CANCELLED + hoàn kho + thu hồi coupon
- [ ] **Đối soát thủ công (reconcile):** luồng DUY NHẤT được phép "hồi sinh" đơn EXPIRED → PAID+CONFIRMED (phải re-reserve stock)

**Bài tập tự kiểm tra:**
1. Vẽ FSM đầy đủ trên giấy: 6 trạng thái đơn × 4 trạng thái tiền, đánh mũi tên hợp lệ
2. Tình huống: 2 admin cùng hủy 1 đơn đã PAID song song → giải thích CAS chống hoàn tiền kép
3. Đọc test: `tests/order-transitions.test.ts`, `tests/order-cancellation-inventory-release.test.ts`, `tests/reconciliation.test.ts`

### Ngày 14: LUỒNG 4 — Ví Shop (Nạp tiền, Thanh toán 1-chạm, Hoàn tiền)

**Đọc code:**
- [ ] `src/server/modules/wallet/wallet-topup.service.ts` — nạp tiền 4 lớp chống cộng trùng
- [ ] `src/server/modules/wallet/wallet-pay.controller.ts` — thanh toán CAS `balance: { gte: totalAmount }`
- [ ] `src/server/modules/wallet/wallet.service.ts` — refund
- [ ] `docs/uml/README.md` — UML 04 (Sequence: Nạp ví VietQR) + UML 17 (Activity: Thanh toán Ví CAS)

**Khái niệm bắt buộc phải giải thích được:**
- [ ] **4 lớp chống cộng trùng (idempotent topup):** session COMPLETED guard → Redis lock `setNx` 15s → DB WalletTransaction kiểm tra trùng → cuối cùng mới `balance: { increment }`
- [ ] **CAS trừ tiền:** `updateMany({ where: { balance: { gte: amount } } })` — count≠1 = số dư đã thay đổi giữa chừng
- [ ] **Refund CAS:** chống hoàn kép bằng `paymentStatus: 'PAID'` → chỉ 1 request thắng

**Bài tập tự kiểm tra:**
1. Tại sao cần đến 4 lớp chống trùng khi nạp ví? Mỗi lớp chặn ở trường hợp nào?
2. Đọc test: `tests/wallet.test.ts`, `tests/wallet-topup.test.ts`, `tests/wallet-vietqr-topup-idempotency.test.ts`

---

## TUẦN 3: PHÂN HỆ MỞ RỘNG & HẠ TẦNG (7 ngày)

### Ngày 15-16: Auth, OTP, RBAC & Phân quyền STAFF

**Đọc code:**
- [ ] `src/server/modules/auth/` — toàn bộ: register, verify-otp, login (auth-options), forgot/reset password
- [ ] `src/server/modules/auth/otp.service.ts` — sinh OTP, bcrypt hash, cooldown, max attempts
- [ ] `src/server/modules/admin/admin-rbac.service.ts` + `permission.service.ts` + `guards.ts`
- [ ] `src/shared/constants/permissions.ts` — ma trận quyền 5 module

**Mục tiêu:** Giải thích được toàn bộ luồng đăng ký → OTP → đăng nhập → session JWT → phân quyền RBAC 3 cấp → STAFF permission matrix

**Đọc test:** `tests/otp.test.ts`, `tests/password-reset.test.ts`, `tests/admin-rbac-permissions.test.ts`, `tests/permissions.test.ts`, `tests/staff-e2e.test.ts`

### Ngày 17-18: Chat Realtime, Notifications & Pusher

**Đọc code:**
- [ ] `src/server/modules/chat/` — toàn bộ: rooms, messages, pusher-auth, read status
- [ ] `src/server/modules/notifications/` — tạo thông báo + đếm chưa đọc + Pusher broadcast
- [ ] `src/server/infrastructure/pusher.ts` — singleton Pusher server
- [ ] `src/client/infrastructure/pusher-client.ts` — Pusher client
- [ ] `src/client/hooks/useChatMessages.ts` — optimistic send + rollback
- [ ] `docs/uml/README.md` — UML 06 (Sequence: Chat Realtime) + UML 21 (Sơ đồ kênh Pusher)

**Mục tiêu:** Giải thích 3 loại kênh Pusher (`private-user-<id>`, `private-admin-channel`, `private-chat-<roomId>`) và luồng auth channel. Tại sao chat gắn theo đơn hàng (context-aware)?

### Ngày 19-20: GHN Shipping, Coupon, Review, Wishlist

**GHN — Đọc code:**
- [ ] `src/server/modules/shipping/ghn.service.ts` — tính phí + tạo vận đơn + cancel
- [ ] `src/server/modules/shipping/ghn-webhook.controller.ts` — webhook lộ trình
- [ ] `src/server/modules/shipping/geocoding.service.ts` — GPS → địa chỉ GHN (Nominatim → BDC fallback)

**Coupon — Đọc code:**
- [ ] `src/server/modules/admin/coupon.service.ts` — validate 6 điều kiện (active, in-date, usageLimit, perUserLimit, minOrderAmount, discountType)

**Review — Đọc code:**
- [ ] `src/server/modules/reviews/review.service.ts` — `resolveReviewEligibility` (chặn spam: phải có đơn COMPLETED chứa SP đó)

**Wishlist:**
- [ ] `src/client/stores/wishlist-store.ts` — optimistic update + rollback

**Đọc test:** `tests/ghn.test.ts`, `tests/coupon.test.ts`, `tests/review-submission.test.ts`, `tests/wishlist-store.test.ts`

### Ngày 21: Redis, Rate Limiting & Hạ tầng

**Đọc code:**
- [ ] `src/server/infrastructure/redis.ts` — Upstash REST Redis + fallback in-memory
- [ ] `src/server/infrastructure/rate-limit.ts` — sliding window IP-based (INCR + EXPIRE)
- [ ] `src/server/infrastructure/cron-auth.ts` — Bearer token bảo vệ cron endpoint
- [ ] `src/server/modules/catalog/catalog.service.ts` — cache danh mục 600s, chi tiết SP 120s
- [ ] `src/server/modules/admin/admin-analytics.service.ts` — 21 truy vấn song song, cache 60s

**Mục tiêu:** Giải thích được chiến lược cache (TTL), tại sao cần rate limit, tại sao fallback in-memory khi dev offline

**Đọc test:** `tests/redis.test.ts`, `tests/rate-limit.test.ts`, `tests/cron-auth.test.ts`

---

## TUẦN 4: TỔNG HỢP, LUYỆN VẤN ĐÁP & DEMO (7 ngày)

### Ngày 22-23: Ôn lại toàn bộ qua sơ đồ UML

**Đọc toàn bộ:**
- [ ] `docs/uml/README.md` — 21 sơ đồ UML, đọc lại từng cái, đối chiếu với code đã đọc
- [ ] Tự vẽ lại 5 sơ đồ quan trọng nhất từ trí nhớ:
  1. ERD (Class Diagram)
  2. FSM Đơn hàng (State Machine)
  3. Sequence Thanh toán VietQR
  4. Activity Giữ kho Nguyên tử
  5. Deployment Architecture

### Ngày 24-25: Chạy project & Demo thực tế

**Thực hành hands-on:**
- [ ] `npm run dev` — chạy project, đi qua TOÀN BỘ flow trên trình duyệt:
  1. Đăng ký → nhận OTP (check Resend dashboard hoặc console) → xác thực
  2. Duyệt sản phẩm → chọn biến thể → thêm giỏ → checkout
  3. Áp coupon → chọn địa chỉ (thử GPS) → tạo đơn → xem QR
  4. (Dev) Simulate thanh toán → xem Pusher realtime
  5. Vào admin → duyệt đơn → xem dashboard → quản lý sản phẩm
  6. Thử chat giữa khách và admin
  7. Hoàn thành đơn → đánh giá sản phẩm
- [ ] `npm run test` — chạy 45 test suites, đảm bảo all pass
- [ ] `npm run seed:demo` — seed dữ liệu demo để có dữ liệu dashboard

### Ngày 26-27: Luyện vấn đáp — 50 câu hỏi giảng viên HAY HỎI

> Tự trả lời mỗi câu bằng lời (2-3 phút/câu), ghi âm hoặc viết ra

#### A. Nhóm Kiến trúc & Thiết kế (10 câu)
1. Tại sao chọn Next.js App Router thay vì Pages Router hoặc Express riêng?
2. Giải thích mô hình Clean Architecture trong project — 4 tầng là gì?
3. Tại sao file `page.tsx` chỉ import View component mà không viết logic trực tiếp?
4. Controller và Service khác nhau thế nào? Tại sao phải tách?
5. `src/shared/` dùng chung giữa server và client — nó chứa gì và tại sao cần tách riêng?
6. Tại sao dùng Zustand thay vì Redux hoặc Context API?
7. Prisma ORM đóng vai trò gì? So với viết SQL thuần thì ưu/nhược?
8. Path alias (`@server/*`, `@client/*`) giải quyết vấn đề gì?
9. Tại sao dùng PostgreSQL thay vì MySQL hay MongoDB?
10. Giải thích kiến trúc Event-driven trong project (Pusher channels, webhook).

#### B. Nhóm Thanh toán & Bảo mật (10 câu)
11. VietQR là gì? Giải thích cách sinh mã QR động cho từng đơn hàng.
12. Casso đóng vai trò gì trong hệ thống? Nếu Casso down thì sao?
13. Webhook Casso gửi trùng 5 lần — hệ thống xử lý thế nào (idempotency)?
14. Giải thích 8 cổng chặn trong bộ lọc webhook (`vietqr-parser.service.ts`).
15. Timing-safe comparison khi kiểm tra webhook token là gì? Tại sao không dùng `===`?
16. Khách chuyển khoản đúng tiền nhưng sai nội dung → admin xử lý thế nào?
17. OTP được lưu trong DB dưới dạng gì? Tại sao?
18. Rate limiting hoạt động thế nào? (Sliding window, Redis INCR + EXPIRE)
19. JWT session trong NextAuth — token chứa gì? Lưu ở đâu?
20. RBAC 3 cấp (CUSTOMER/STAFF/ADMIN) — ma trận phân quyền STAFF hoạt động thế nào?

#### C. Nhóm Nghiệp vụ & Đơn hàng (10 câu)
21. Vẽ và giải thích FSM vòng đời đơn hàng (6 trạng thái).
22. Tại sao CANCELLED là "terminal state" — không chuyển đi được nữa?
23. 100 người cùng mua 1 sản phẩm còn 5 cái — giải thích cơ chế CAS chống bán vượt kho.
24. Tại sao giá hiển thị ở client không được tin — server phải re-validate?
25. Đơn hàng hết hạn 15 phút — cron job xử lý thế nào? Nếu cron chết thì sao?
26. Giải thích luồng hủy đơn đã thanh toán — CAS chống hoàn tiền kép hoạt động ra sao?
27. Đối soát thủ công "hồi sinh" đơn hết hạn — tại sao phải re-reserve stock trước?
28. Coupon validate 6 điều kiện — liệt kê và giải thích từng cái.
29. Biến thể sản phẩm: tại sao `Product.stock` phải = tổng stock variant? Đồng bộ ở đâu?
30. Shipping fee tính động qua GHN — miễn phí ship khi nào? Hằng số ở đâu?

#### D. Nhóm Ví Shop & Tài chính (10 câu)
31. 4 lớp chống cộng trùng khi nạp ví — giải thích từng lớp.
32. CAS trừ tiền ví: `updateMany({ where: { balance: { gte: amount } } })` — tại sao an toàn?
33. Nếu 2 request thanh toán ví đồng thời cho cùng 1 đơn — chuyện gì xảy ra?
34. Hoàn tiền vào ví khi hủy đơn — tại sao dùng CAS `paymentStatus: 'PAID'`?
35. Khách vãng lai (guest) không có ví — hủy đơn đã PAID thì hoàn tiền thế nào?
36. Dashboard 21 metrics realtime — cache Redis 60s, tại sao không cache lâu hơn?
37. Cơ cấu thanh toán (VietQR / Ví / COD) — logic phân loại trong analytics thế nào?
38. Tỷ lệ khớp VietQR trên dashboard tính bằng công thức gì?
39. `$transaction` trong Prisma — nếu 1 bước thất bại thì toàn bộ sao?
40. Prisma `@unique` vs `@@unique` — khác nhau thế nào? Cho ví dụ trong project.

#### E. Nhóm Frontend, Realtime & UX (10 câu)
41. Pusher có mấy loại kênh trong project? Auth channel hoạt động thế nào?
42. Optimistic update trong wishlist/chat — nếu API fail thì rollback thế nào?
43. Giỏ hàng dùng Zustand + localStorage persist — tại sao không lưu DB?
44. Server Components vs Client Components — trong project phân chia thế nào?
45. Hydration mismatch — project xử lý ra sao? (`useHydrated` hook)
46. Trang QR Payment lắng nghe Pusher event gì? Khi nhận được thì UI thay đổi thế nào?
47. Chat realtime — tin nhắn SYSTEM là gì? Khi nào tự tạo?
48. GPS fallback chain: High Accuracy → Low Accuracy → IP-based — tại sao cần?
49. ConfirmDialog thay `window.confirm()` — tại sao?
50. Loading states (`loading.tsx`) trong App Router hoạt động thế nào?

### Ngày 28: Tổng hợp & Chuẩn bị slide/notes vấn đáp

- [ ] Tổng hợp 1 trang A4 "cheat sheet" — các con số và kiến trúc quan trọng:
  - 43.500 LOC, 15 models, 30+ API, 45 tests, 21 UML diagrams
  - 4 tầng kiến trúc, 15 server modules, 3 vai trò RBAC
  - 2 kênh thanh toán (VietQR + Ví), 8 cổng chặn webhook, 4 lớp idempotent ví
  - FSM 6 trạng thái đơn, 4 trạng thái tiền
- [ ] Chuẩn bị 3-5 "câu chuyện kỹ thuật" hấp dẫn để kể cho giảng viên:
  1. "Bài toán race condition khi 100 người mua cùng lúc — giải bằng CAS"
  2. "Webhook ngân hàng gửi trùng — idempotency 4 lớp"
  3. "GPS trả sai địa chỉ Hoàng Sa cho user ở Đà Nẵng — chuỗi fallback"
  4. "2 admin hủy đơn song song — CAS chống hoàn tiền kép"

---

## BẢNG THEO DÕI TIẾN ĐỘ

| Tuần | Ngày | Chủ đề | Trạng thái |
|------|------|--------|------------|
| 1 | 1-2 | Tổng quan & Tech Stack | ⬜ |
| 1 | 3-4 | Database Schema & ERD | ⬜ |
| 1 | 5-6 | Cấu trúc mã nguồn & Routing | ⬜ |
| 1 | 7 | API Endpoints & Bảo mật | ⬜ |
| 2 | 8-9 | Checkout Flow & Giữ kho CAS | ⬜ |
| 2 | 10-11 | Thanh toán VietQR & Webhook Casso | ⬜ |
| 2 | 12-13 | FSM Đơn hàng & Hủy/Hoàn tiền | ⬜ |
| 2 | 14 | Ví Shop (Nạp/Trừ/Hoàn) | ⬜ |
| 3 | 15-16 | Auth, OTP, RBAC & STAFF | ⬜ |
| 3 | 17-18 | Chat, Notifications & Pusher | ⬜ |
| 3 | 19-20 | GHN, Coupon, Review, Wishlist | ⬜ |
| 3 | 21 | Redis, Rate Limit & Hạ tầng | ⬜ |
| 4 | 22-23 | Ôn qua 21 sơ đồ UML | ⬜ |
| 4 | 24-25 | Chạy demo & Test thực tế | ⬜ |
| 4 | 26-27 | Luyện 50 câu hỏi vấn đáp | ⬜ |
| 4 | 28 | Tổng hợp cheat sheet & câu chuyện KT | ⬜ |

---

## MẸO VẤN ĐÁP VỚI GIẢNG VIÊN

1. **Bắt đầu từ bức tranh lớn, rồi zoom vào chi tiết:** "Hệ thống có 4 tầng... tầng business logic xử lý ở `src/server/modules/`, ví dụ module orders có controller và FSM..."
2. **Dùng con số cụ thể:** "8 cổng chặn webhook", "4 lớp idempotent", "15 phút giữ kho", "6 trạng thái FSM"
3. **Kể câu chuyện vấn đề → giải pháp:** "Vấn đề race condition khi 100 người mua cùng lúc → giải pháp CAS atomic update trong Prisma transaction"
4. **Thừa nhận hạn chế:** Nếu được hỏi về điểm yếu, nêu trung thực: "Guest coupon chưa hoàn hảo, admin guard rải rác chưa có middleware tập trung, chưa có CSP/HSTS" → thể hiện sự hiểu biết sâu
5. **Chỉ đường dẫn file cụ thể:** "Code FSM nằm ở `src/server/modules/orders/orders.fsm.ts`, chỉ 70 dòng nhưng kiểm soát toàn bộ vòng đời đơn hàng"
