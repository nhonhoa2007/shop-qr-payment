# Kế hoạch Đồng hành Phát triển Đồ án `ecommerce-web-shop` Theo Từng Ngày

> **Quy ước vai trò:** Người dùng (User) là người trực tiếp kiểm tra, nghiệm thu và thực thi lệnh Git Commit trên terminal máy thật. Trợ lý AI (Tech Lead / Assistant) chịu trách nhiệm phân chia nhiệm vụ, đẩy mã nguồn tương ứng theo từng ngày vào thư mục `/home/nhonhoa/ecommerce-web-shop` và hướng dẫn kiểm thử.

**Mục tiêu:** Từng bước xây dựng kho mã nguồn hoàn chỉnh của đồ án "Ứng dụng bán hàng tích hợp thanh toán tự động VietQR và ví nội bộ" theo đúng 6 tuần của đề cương đã duyệt với GVHD, bảo đảm lịch sử commit phát sinh tự nhiên, minh bạch, 100% pass kiểm thử.

**Kiến trúc:** Clean Architecture 4 tầng (`@client`, `@server`, `@shared`, `infrastructure`) đảm bảo tính độc lập giữa nghiệp vụ và framework.
**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Prisma ORM, PostgreSQL, NextAuth.js, VietQR (Napas 247), GHN Express API, Pusher WebSocket, Node.js Native Test Runner (`node:test`).
**Tài liệu tham chiếu gốc:** Đề cương Đồ án Cơ sở 1 (`de_cuong_do_an_co_so_1_Phung_Nhon_Hoa.pdf`).

---

## 1. Quy trình Hợp tác Hàng ngày (Daily Workflow Protocol)

Mỗi khi bước sang một ngày mới (hoặc khi bạn ra lệnh: *"Lên code ngày X"*), quy trình sẽ diễn ra theo 4 bước chuẩn:

1. **Bước 1 (Assistant chuẩn bị code):** Assistant cập nhật các file code mới hoặc sửa đổi tương ứng với nội dung kỹ thuật của ngày đó vào `/home/nhonhoa/ecommerce-web-shop`.
2. **Bước 2 (Assistant bàn giao checklist):** Assistant tóm tắt những file đã thay đổi, mục đích nghiệp vụ, lệnh chạy thử nghiệm (`npm test` hoặc script kiểm tra) và đề xuất thông điệp commit.
3. **Bước 3 (User kiểm tra & Review):** Bạn mở terminal, chạy `git status` / `git diff` để xem các thay đổi, chạy lệnh test kiểm tra.
4. **Bước 4 (User Commit):** Bạn tự tay gõ lệnh `git add` và `git commit` với thông điệp theo ý muốn (hoặc dùng gợi ý commit tiếng Việt có dấu của Assistant).

---

## 2. Kế hoạch Chi tiết Từng Ngày (6 Tuần x 7 Ngày)

### TUẦN 1: Khảo sát, Thiết lập Kiến trúc Dự án & CSDL PostgreSQL
*Mục tiêu tuần:* Thiết lập khung dự án Clean Architecture, cấu hình Next.js 16, Prisma ORM và mô hình dữ liệu lõi.

- [ ] **Ngày 1 (Thứ Hai): Khởi tạo khung dự án Next.js 16, TypeScript và Tailwind CSS v4**
  - **Files:** `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `.gitignore`, `.env.example`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`.
  - **Mô tả:** Cấu hình base runtime, path alias `@/*`, Tailwind v4 theme, biến môi trường mẫu.
  - **Kiểm tra:** `npm run lint` hoặc `npm run build`.
  - **Gợi ý commit:** `Khởi tạo khung dự án Next.js 16, TypeScript và Tailwind CSS v4`

- [ ] **Ngày 2 (Thứ Ba): Thiết kế mô hình CSDL User, Account và xác thực tài khoản**
  - **Files:** `prisma/schema.prisma` (Models: `User`, `Account`, `Session`, `StaffPermission`), `src/server/database/prisma.ts`.
  - **Mô tả:** Thiết lập Prisma client singleton và schema quản lý người dùng đa vai trò (CUSTOMER, ADMIN, STAFF).
  - **Kiểm tra:** `npx prisma validate`.
  - **Gợi ý commit:** `Thiết kế cơ sở dữ liệu PostgreSQL qua Prisma ORM cho người dùng và xác thực`

- [ ] **Ngày 3 (Thứ Tư): Định nghĩa mô hình sản phẩm và hệ thống đa biến thể phân cấp**
  - **Files:** Cập nhật `prisma/schema.prisma` (Models: `Product`, `ProductVariant`, `Category`), `src/shared/types/product.ts`.
  - **Mô tả:** Mô hình hóa sản phẩm kèm các biến thể (màu sắc, kích thước, SKU, tồn kho, giá bán riêng).
  - **Kiểm tra:** `npx prisma validate`.
  - **Gợi ý commit:** `Định nghĩa mô hình sản phẩm và hệ thống đa biến thể phân cấp`

- [ ] **Ngày 4 (Thứ Năm): Định nghĩa mô hình đơn hàng, chi tiết đơn và mã giảm giá coupon**
  - **Files:** Cập nhật `prisma/schema.prisma` (Models: `Order`, `OrderItem`, `Coupon`, `CouponUsage`), `src/server/modules/orders/orders.fsm.ts`.
  - **Mô tả:** Thiết lập quan hệ đơn hàng và máy trạng thái đơn hàng (PENDING -> PAID -> SHIPPING -> COMPLETED).
  - **Kiểm tra:** `npx prisma validate`.
  - **Gợi ý commit:** `Định nghĩa mô hình đơn hàng, chi tiết đơn và mã giảm giá coupon`

- [ ] **Ngày 5 (Thứ Sáu): Định nghĩa mô hình vận đơn GHN, ví điện tử nội bộ và phòng chat**
  - **Files:** Cập nhật `prisma/schema.prisma` (Models: `Shipment`, `UserWallet`, `WalletTransaction`, `ChatRoom`, `Message`).
  - **Mô tả:** Hoàn thiện các bảng cho phân hệ giao vận, ví nội bộ và liên lạc thời gian thực.
  - **Kiểm tra:** `npx prisma validate`.
  - **Gợi ý commit:** `Định nghĩa mô hình vận đơn GHN, ví điện tử nội bộ và phòng chat`

- [ ] **Ngày 6 (Thứ Bảy): Xây dựng script nạp dữ liệu mẫu ban đầu và tiện ích sao lưu CSDL**
  - **Files:** `prisma/seed.ts`, `scripts/db-backup.js`, `scripts/db-restore.js`.
  - **Mô tả:** Tiện ích seed tài khoản admin mẫu, danh mục ban đầu và cơ chế dump database an toàn.
  - **Kiểm tra:** Chạy thử cấu trúc seed syntax.
  - **Gợi ý commit:** `Xây dựng script nạp dữ liệu mẫu và công cụ sao lưu cơ sở dữ liệu`

- [ ] **Ngày 7 (Chủ Nhật): Tổng kết Tuần 1 - Hoàn thiện kiến trúc Clean Architecture**
  - **Files:** `.dependency-cruiser.cjs`, cập nhật cấu trúc thư mục `@client`, `@server`, `@shared`.
  - **Kiểm tra:** Kiểm tra toàn bộ kiến trúc tuần 1.
  - **Gợi ý commit:** `Tổng kết Tuần 1: Hoàn thành thiết lập kiến trúc dự án và cơ sở dữ liệu`

---

### TUẦN 2: Xác thực Người dùng, Phân quyền RBAC & Danh mục Sản phẩm
*Mục tiêu tuần:* Hoàn thiện module đăng ký/đăng nhập với Argon2id, gửi mã OTP qua Resend, ma trận phân quyền StaffPermission và trang duyệt sản phẩm.

- [ ] **Ngày 8 (Thứ Hai): Xây dựng module xác thực NextAuth và mã hóa mật khẩu Argon2id**
  - **Files:** `src/server/modules/auth/auth-options.ts`, `src/server/modules/auth/password-hash.service.ts`, `src/app/api/auth/[...nextauth]/route.ts`.
  - **Gợi ý commit:** `Xây dựng module xác thực NextAuth và mã hóa mật khẩu Argon2id chuẩn OWASP`

- [ ] **Ngày 9 (Thứ Ba): Tích hợp xác minh OTP qua Resend Email và cơ chế giới hạn tốc độ**
  - **Files:** `src/server/infrastructure/resend.ts`, `src/server/modules/auth/otp.service.ts`, `src/server/infrastructure/rate-limit.ts`.
  - **Gợi ý commit:** `Tích hợp xác minh OTP qua Resend Email và cơ chế giới hạn tốc độ truy cập`

- [ ] **Ngày 10 (Thứ Tư): Thiết lập ma trận phân quyền nhân viên StaffPermission và guards**
  - **Files:** `src/server/modules/admin/permission.service.ts`, `src/server/modules/admin/guards.ts`, `src/shared/constants/permissions.ts`.
  - **Gợi ý commit:** `Thiết lập ma trận phân quyền nhân viên StaffPermission và bảo vệ endpoint`

- [ ] **Ngày 11 (Thứ Năm): Xây dựng service quản lý sản phẩm và đồng bộ tồn kho biến thể**
  - **Files:** `src/server/modules/products/product.service.ts`, `src/server/modules/catalog/catalog.service.ts`.
  - **Gợi ý commit:** `Xây dựng service quản lý sản phẩm và đồng bộ tồn kho biến thể`

- [ ] **Ngày 12 (Thứ Sáu): Thiết kế giao diện danh sách sản phẩm và bộ lọc tìm kiếm**
  - **Files:** `src/client/components/product/ProductCard.tsx`, `src/client/views/HomeView.tsx`, `src/client/components/layout/Navbar.tsx`.
  - **Gợi ý commit:** `Thiết kế giao diện hiển thị danh sách sản phẩm và bộ lọc tìm kiếm`

- [ ] **Ngày 13 (Thứ Bảy): Xây dựng trang chi tiết sản phẩm với bộ chọn biến thể tương tác**
  - **Files:** `src/client/views/ProductDetailView.tsx`, `src/app/products/[id]/page.tsx`.
  - **Gợi ý commit:** `Xây dựng trang chi tiết sản phẩm với bộ chọn biến thể trực quan`

- [ ] **Ngày 14 (Chủ Nhật): Tổng kết Tuần 2 - Hoàn thiện phân hệ xác thực, phân quyền và danh mục**
  - **Gợi ý commit:** `Tổng kết Tuần 2: Hoàn thành xác thực, phân quyền RBAC và danh mục sản phẩm`

---

### TUẦN 3: Giỏ hàng Client, Đơn hàng FSM & Trừ kho nguyên tử CAS
*Mục tiêu tuần:* Quản lý trạng thái giỏ hàng phía client (Zustand persist), quy trình đặt hàng an toàn chống bán âm kho (CAS), cron job hủy đơn treo.

- [ ] **Ngày 15 (Thứ Hai): Cài đặt Zustand store quản lý giỏ hàng bền vững và danh sách yêu thích**
  - **Files:** `src/client/stores/cart-store.ts`, `src/client/stores/wishlist-store.ts`.
  - **Gợi ý commit:** `Cài đặt Zustand store quản lý giỏ hàng bền vững và danh sách yêu thích`

- [ ] **Ngày 16 (Thứ Ba): Xây dựng giao diện giỏ hàng và biểu mẫu đặt hàng thanh toán**
  - **Files:** `src/client/views/CartView.tsx`, `src/client/views/CheckoutView.tsx`, `src/app/cart/page.tsx`, `src/app/checkout/page.tsx`.
  - **Gợi ý commit:** `Xây dựng giao diện giỏ hàng và biểu mẫu đặt hàng thanh toán`

- [ ] **Ngày 17 (Thứ Tư): Hiện thực cỗ máy trạng thái đơn hàng nghiêm ngặt Order FSM**
  - **Files:** `src/server/modules/orders/orders.fsm.ts`, `src/server/modules/orders/customer-orders.service.ts`.
  - **Gợi ý commit:** `Hiện thực cỗ máy trạng thái đơn hàng nghiêm ngặt Order FSM`

- [ ] **Ngày 18 (Thứ Năm): Cài đặt cơ chế trừ tồn kho nguyên tử CAS chống bán âm kho**
  - **Files:** `src/server/modules/inventory/inventory.service.ts`, `src/server/modules/orders/orders.controller.ts`.
  - **Gợi ý commit:** `Cài đặt cơ chế trừ tồn kho nguyên tử CAS chống bán âm kho khi đặt hàng`

- [ ] **Ngày 19 (Thứ Sáu): Xây dựng cron job tự động hủy đơn quá hạn 15 phút và giải phóng tồn kho**
  - **Files:** `src/server/modules/orders/expire-orders.controller.ts`, `src/server/infrastructure/cron-auth.ts`, `src/app/api/cron/expire-orders/route.ts`.
  - **Gợi ý commit:** `Xây dựng cron job tự động hủy đơn quá hạn 15 phút và giải phóng tồn kho`

- [ ] **Ngày 20 (Thứ Bảy): Phát triển hệ thống mã giảm giá coupon và kiểm soát hạn mức sử dụng**
  - **Files:** `src/server/modules/admin/coupon.service.ts`, `src/app/api/coupons/apply/route.ts`.
  - **Gợi ý commit:** `Phát triển hệ thống mã giảm giá coupon và kiểm soát hạn mức sử dụng`

- [ ] **Ngày 21 (Chủ Nhật): Tổng kết Tuần 3 - Hoàn tất giỏ hàng, FSM đơn hàng và trừ kho CAS**
  - **Gợi ý commit:** `Tổng kết Tuần 3: Hoàn thành giỏ hàng, cỗ máy trạng thái và trừ kho nguyên tử`

---

### TUẦN 4: Thanh toán Tự động VietQR, Webhook Casso & Phân hệ Ví Nội bộ
*Mục tiêu tuần:* Tạo mã QR chuyển khoản động chuẩn VietQR Napas 247, tiếp nhận webhook Casso có sổ cái BankTransfer đối soát, phân hệ nạp/rút/hoàn tiền ví nội bộ.

- [ ] **Ngày 22 (Thứ Hai): Tích hợp tạo mã QR thanh toán động VietQR chuẩn Napas 247**
  - **Files:** `src/server/modules/payment/vietqr.service.ts`.
  - **Gợi ý commit:** `Tích hợp tạo mã QR thanh toán động VietQR chuẩn Napas 247`

- [ ] **Ngày 23 (Thứ Ba): Thiết kế màn hình thanh toán QR kèm đồng hồ đếm ngược hết hạn**
  - **Files:** `src/client/views/PaymentView.tsx`, `src/client/components/payment/VietQRDisplay.tsx`.
  - **Gợi ý commit:** `Thiết kế màn hình thanh toán QR kèm đồng hồ đếm ngược hết hạn`

- [ ] **Ngày 24 (Thứ Tư): Xây dựng bộ phân tích giao dịch ngân hàng và khớp mã đơn tự động**
  - **Files:** `src/server/modules/payment/vietqr-parser.service.ts`.
  - **Gợi ý commit:** `Xây dựng bộ phân tích giao dịch ngân hàng và khớp mã đơn hàng tự động`

- [ ] **Ngày 25 (Thứ Năm): Hiện thực webhook Casso bất biến kèm sổ cái BankTransfer đối soát**
  - **Files:** `src/server/modules/payment/casso-webhook.controller.ts`, `src/app/api/webhooks/payment/route.ts`.
  - **Gợi ý commit:** `Hiện thực webhook Casso bất biến kèm sổ cái BankTransfer đối soát`

- [ ] **Ngày 26 (Thứ Sáu): Xây dựng phân hệ ví nội bộ và nạp tiền tự động qua mã VietQR**
  - **Files:** `src/server/modules/wallet/wallet.service.ts`, `src/server/modules/wallet/wallet-topup.service.ts`, `src/client/views/WalletView.tsx`.
  - **Gợi ý commit:** `Xây dựng phân hệ ví nội bộ và nạp tiền tự động qua mã VietQR`

- [ ] **Ngày 27 (Thứ Bảy): Hỗ trợ thanh toán bằng ví và cơ chế tự động hoàn tiền khi hủy đơn**
  - **Files:** `src/server/modules/wallet/wallet-pay.controller.ts`, `src/server/modules/orders/order-cancel.service.ts`.
  - **Gợi ý commit:** `Hỗ trợ thanh toán bằng ví và tự động hoàn tiền khi hủy đơn hàng`

- [ ] **Ngày 28 (Chủ Nhật): Tổng kết Tuần 4 - Hoàn tất cổng thanh toán VietQR và ví nội bộ**
  - **Gợi ý commit:** `Tổng kết Tuần 4: Hoàn thành cổng thanh toán VietQR và ví điện tử nội bộ`

---

### TUẦN 5: Vận chuyển GHN, Realtime WebSockets & Telegram Bot
*Mục tiêu tuần:* Tích hợp GHN Express tính phí và tạo vận đơn, Pusher WebSocket gửi thông báo tức thời, hệ thống chat hỗ trợ trực tuyến và Telegram Bot.

- [ ] **Ngày 29 (Thứ Hai): Tích hợp API Giao Hàng Nhanh GHN tính cước phí vận chuyển động**
  - **Files:** `src/server/modules/shipping/ghn.service.ts`, `src/server/modules/shipping/shipping-quote.service.ts`.
  - **Gợi ý commit:** `Tích hợp API Giao Hàng Nhanh GHN tính cước phí vận chuyển động`

- [ ] **Ngày 30 (Thứ Ba): Biên tập bộ dữ liệu 63 tỉnh thành và geocoding định vị địa chỉ**
  - **Files:** `src/shared/constants/vietnam-locations.ts`, `src/server/modules/shipping/geocoding.service.ts`.
  - **Gợi ý commit:** `Biên tập bộ dữ liệu 63 tỉnh thành và geocoding định vị địa chỉ tự động`

- [ ] **Ngày 31 (Thứ Tư): Xây dựng engine tự động tạo vận đơn GHN và webhook hành trình**
  - **Files:** `src/server/modules/orders/order-fulfillment.service.ts`, `src/server/modules/shipping/ghn-webhook.controller.ts`.
  - **Gợi ý commit:** `Xây dựng engine tự động tạo vận đơn GHN và webhook đồng bộ hành trình`

- [ ] **Ngày 32 (Thứ Năm): Cấu hình Pusher WebSockets gửi thông báo đơn hàng theo thời gian thực**
  - **Files:** `src/server/infrastructure/pusher.ts`, `src/client/infrastructure/pusher-client.ts`, `src/client/views/NotificationsView.tsx`.
  - **Gợi ý commit:** `Cấu hình Pusher WebSockets gửi thông báo đơn hàng theo thời gian thực`

- [ ] **Ngày 33 (Thứ Sáu): Xây dựng hệ thống chat hỗ trợ trực tiếp giữa khách hàng và nhân viên**
  - **Files:** `src/server/modules/chat/chat.service.ts`, `src/client/views/ChatView.tsx`, `src/client/views/ChatRoomView.tsx`.
  - **Gợi ý commit:** `Xây dựng hệ thống chat hỗ trợ trực tiếp giữa khách hàng và nhân viên`

- [ ] **Ngày 34 (Thứ Bảy): Tích hợp Telegram Bot thông báo đơn mới và duyệt vận đơn một chạm**
  - **Files:** `src/server/infrastructure/telegram.ts`, `src/server/modules/telegram/telegram-bot.service.ts`, `src/app/api/webhooks/telegram/route.ts`.
  - **Gợi ý commit:** `Tích hợp Telegram Bot thông báo đơn mới và duyệt vận đơn một chạm`

- [ ] **Ngày 35 (Chủ Nhật): Tổng kết Tuần 5 - Hoàn tất tích hợp vận chuyển, realtime và bot**
  - **Gợi ý commit:** `Tổng kết Tuần 5: Hoàn thành vận chuyển GHN, thời gian thực và Telegram Bot`

---

### TUẦN 6: Dashboard Quản trị, Bảng Đối soát Ngân hàng, Kiểm thử Toàn diện & Nghiệm thu
*Mục tiêu tuần:* Dashboard Admin phong cách Bento Grid, bảng đối soát BankReviewPanel, suite kiểm thử tự động 100% pass và script seed demo.

- [ ] **Ngày 36 (Thứ Hai): Thiết kế Admin Dashboard phong cách Bento Grid và thống kê doanh thu**
  - **Files:** `src/client/views/admin/AdminDashboardView.tsx`, `src/server/modules/admin/admin-analytics.service.ts`.
  - **Gợi ý commit:** `Thiết kế Admin Dashboard phong cách Bento Grid và thống kê doanh thu`

- [ ] **Ngày 37 (Thứ Ba): Xây dựng bảng đối soát ngân hàng BankReviewPanel và quy trình hoàn tiền**
  - **Files:** `src/client/components/admin/BankReviewPanel.tsx`, `src/server/modules/admin/bank-review.controller.ts`, `src/server/modules/admin/reconciliation.service.ts`.
  - **Gợi ý commit:** `Xây dựng bảng đối soát ngân hàng BankReviewPanel và quy trình hoàn tiền`

- [ ] **Ngày 38 (Thứ Tư): Phát triển tính năng đánh giá sản phẩm cho người mua đã xác thực**
  - **Files:** `src/server/modules/reviews/review.service.ts`, `src/client/views/admin/AdminReviewsView.tsx`.
  - **Gợi ý commit:** `Phát triển tính năng đánh giá sản phẩm cho người mua đã xác thực`

- [ ] **Ngày 39 (Thứ Năm): Bổ sung bộ kiểm thử tự động Node.js Native Test Runner**
  - **Files:** `tests/register-alias.mjs`, `tests/*.test.ts`.
  - **Kiểm tra:** `npm run test` (chạy 50 suites).
  - **Gợi ý commit:** `Bổ sung bộ kiểm thử tự động Node.js cho tồn kho, FSM và ví nội bộ`

- [ ] **Ngày 40 (Thứ Sáu): Bổ sung kiểm thử đồng thời chống race-condition và replay webhook**
  - **Files:** `tests/integration/*.test.ts`.
  - **Gợi ý commit:** `Bổ sung kiểm thử đồng thời chống race-condition và replay webhook`

- [ ] **Ngày 41 (Thứ Bảy): Hoàn thiện kịch bản nạp dữ liệu demo toàn diện và tài liệu README**
  - **Files:** `prisma/seed-demo-data.ts`, `README.md`, `public/`.
  - **Gợi ý commit:** `Hoàn thiện script nạp dữ liệu demo và tài liệu hướng dẫn cài đặt`

- [ ] **Ngày 42 (Chủ Nhật): Tổng kết Tuần 6 - Nghiệm thu toàn diện đồ án với 100% test cases đạt**
  - **Kiểm tra:** Xác minh `npm run test` (481/481 tests pass), `npm run lint` (0 errors), `npm run build`.
  - **Gợi ý commit:** `Tổng kết Tuần 6: Nghiệm thu toàn bộ đồ án cơ sở 1 với 100% test cases đạt`
