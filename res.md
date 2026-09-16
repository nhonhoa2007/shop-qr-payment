# BÁO CÁO KẾT QUẢ TRIỂN KHAI & ĐÁNH GIÁ DỰ ÁN (res.md)

Dự án: **Shop QR Payment**  
Thời điểm thực hiện: Tháng 09/2026  
Mục tiêu: Đánh giá và hiện thực các hạng mục cải tiến theo kế hoạch `improve.md`.

---

## I. TỔNG QUAN KẾT QUẢ ĐẠT ĐƯỢC

Toàn bộ các module cốt lõi liên quan đến an toàn dữ liệu, thanh toán VietQR, tồn kho, trải nghiệm người dùng và tự động hóa đã được rà soát và bổ sung hoàn chỉnh. Mức độ đáp ứng kế hoạch đạt **99% - 100%**.

---

## II. CHI TIẾT CÁC HẠNG MỤC ĐÃ HOÀN THIỆN

### 1. Luồng tính tiền Checkout & Đơn hàng (Priority 1)
- **Đã hoàn thành 100%**:
  - Tạo helper dùng chung `src/lib/checkout.ts` (`calculateCheckoutTotals`) xử lý ngưỡng miễn phí vận chuyển (500.000đ) và phí ship chuẩn (30.000đ).
  - API `/api/orders` tính toán hoàn toàn ở phía server, không nhận tổng tiền từ client để chống giả mạo số tiền.
  - VietQR sinh mã theo đúng `totalAmount` chuẩn sau khi đã cộng phí ship.

### 2. Validate dữ liệu đầu vào API Order (Priority 2)
- **Đã hoàn thành 100%**:
  - Triển khai trong `src/lib/order-validation.ts` (`parseOrderItems`, `buildValidatedOrderItems`).
  - Chặn danh sách giỏ hàng rỗng, kiểm tra mã sản phẩm, số lượng là số nguyên dương.
  - Giới hạn tối đa 99 sản phẩm/món (`MAX_QUANTITY_PER_ITEM = 99`).
  - Kiểm tra trạng thái đang kinh doanh (`isActive = true`) và số lượng đặt không vượt quá tồn kho khả dụng (`stock`).

### 3. Quản lý tồn kho & Chống Race Condition (Priority 3)
- **Đã hoàn thành 100%**:
  - Triển khai trong `src/lib/inventory.ts` (`reserveOrderStock`, `releaseOrderStock`).
  - Sử dụng Prisma transaction và atomic update (`stock: { gte: quantity }`) để trừ tồn kho ngay khi tạo đơn, ngăn ngừa việc bán vượt tồn kho khi nhiều khách cùng đặt một lúc.
  - Tự động hoàn lại tồn kho khi đơn hàng bị hủy hoặc quá thời hạn thanh toán.

### 4. Gia cố Webhook thanh toán Casso / VietQR (Priority 4)
- **Đã hoàn thành 100%**:
  - Tách bộ phân tích mã đơn sang module độc lập `src/lib/payment-parser.ts` (`parseOrderCodeFromDescription`, `getTransactionAmount`, `getTransactionId`).
  - Đảm bảo tính **Idempotency**: Kiểm tra `bankTransId` đã tồn tại trong bảng `Transaction` để không cộng tiền/cập nhật đơn trùng lặp khi webhook gửi lại.
  - Kiểm tra số tiền chuyển phải lớn hơn hoặc bằng giá trị đơn hàng, từ chối giao dịch với các đơn đã hủy hoặc hết hạn.

### 5. Xử lý hết hạn đơn hàng & Tự động hóa Cron (Priority 6)
- **Đã hoàn thành 100%**:
  - Triển khai hàm `expireUnpaidOrders()` quét các đơn `PENDING` quá 15 phút, chuyển sang `EXPIRED`/`CANCELLED` và hoàn kho trong transaction.
  - Tạo endpoint cron chuyên dụng: `src/app/api/cron/expire-orders/route.ts` hỗ trợ kích hoạt định kỳ, có bảo vệ bằng Bearer token (`CRON_SECRET`).
  - Tạo cấu hình `vercel.json` định nghĩa lịch chạy Cron tự động 5 phút/lần (`*/5 * * * *`).

### 6. Gia cố Bảo mật Auth & OTP (Priority 7)
- **Đã hoàn thành 100%**:
  - Triển khai trong `src/lib/otp.ts`.
  - Tự động chuẩn hóa địa chỉ email (`normalizeEmail`).
  - Mã hóa OTP bằng bcrypt khi lưu vào database.
  - Giới hạn tối đa 5 lần nhập sai mã OTP (`MAX_OTP_ATTEMPTS = 5`), xóa các mã OTP cũ/hết hạn và áp dụng cooldown 60 giây giữa các lần yêu cầu gửi lại.

### 7. Quy tắc chuyển trạng thái Admin (Order Transitions) (Priority 8)
- **Đã hoàn thành 100%**:
  - Triển khai trong `src/lib/order-transitions.ts` (`validateOrderTransition`).
  - Chặn các chuyển đổi phi lý: không cho sửa đơn đã `CANCELLED`, không thể chuyển sang `SHIPPING` hoặc `COMPLETED` khi đơn chưa thanh toán (`PAID`).

### 8. Soft Delete sản phẩm (Priority 9)
- **Đã hoàn thành 100%**:
  - API `/api/products` (DELETE) chuyển sang cập nhật `isActive = false` thay vì xóa cứng khỏi cơ sở dữ liệu, đảm bảo tính toàn vẹn dữ liệu lịch sử cho các đơn hàng cũ.

### 9. Cải thiện Realtime Chat & Đánh dấu Đã đọc (Priority 10)
- **Đã hoàn thành 100%**:
  - Cập nhật `src/hooks/useChatMessages.ts`: Khi gửi tin nhắn, giao diện hiển thị lạc quan (optimistic), nếu API trả về lỗi thì tự động rollback tin nhắn tạm khỏi danh sách và hiển thị thông báo lỗi (toast).
  - Tự động tạo phòng chat giữa Admin và User kèm tin nhắn hệ thống khi khởi tạo đơn hàng.
  - Tạo API `POST /api/chat/messages/read` và tích hợp tự động đánh dấu tin nhắn đối phương là "Đã xem" khi người dùng truy cập phòng chat hoặc focus vào cửa sổ trình duyệt.

### 10. Cải thiện Giao diện & Trải nghiệm (UI/UX)
- **Trang chủ (`src/app/page.tsx`)**: Đã kết nối tham số URL (`searchParams`), lọc sản phẩm thực tế theo category và từ khóa, làm nổi bật chip danh mục đang chọn, thêm empty state khi không có kết quả.
- **Header (`src/components/layout/Header.tsx`)**: Chuẩn hóa toàn bộ icon sang `lucide-react`, bổ sung responsive mobile menu (hamburger toggle).
- **Trang thanh toán QR (`src/components/payment/QRPayment.tsx`)**: Thêm trạng thái fallback và thông báo cảnh báo rõ ràng khi thông tin tài khoản ngân hàng chưa được cấu hình.
- **Admin Dashboard**:
  - `AdminOrderManager`: Bổ sung thanh tìm kiếm nhanh theo mã đơn hàng, tên khách hàng và số điện thoại.
  - `AdminProductManager`: Bổ sung thanh tìm kiếm sản phẩm theo tên/mô tả và dropdown lọc nhanh theo danh mục.

### 11. Bổ sung Bộ Unit Tests
- Đã xây dựng bộ test tự động sử dụng Node.js Native Test Runner (`node:test` và `node:assert`), tương thích đa nền tảng (Windows & Linux):
  - `tests/checkout.test.ts`: Kiểm tra logic tính subtotal, phí ship 30k, miễn phí ship trên 500k.
  - `tests/coupon.test.ts`: Kiểm tra chiết khấu FIXED, PERCENTAGE kèm maxDiscount, FREE_SHIPPING và tính tổng đơn.
  - `tests/order-validation.test.ts`: Kiểm tra dữ liệu rỗng, số lượng vượt ngưỡng 99 món, sản phẩm ngừng bán hoặc hết tồn kho.
  - `tests/payment-parser.test.ts`: Kiểm tra regex bóc tách mã đơn `DHxxxxxx`, xử lý chữ hoa/thường, khoảng trắng và transaction ID.
  - `tests/order-transitions.test.ts`: Kiểm tra chặn cập nhật đơn đã hủy hoặc đơn chưa thanh toán.
  - `tests/otp.test.ts`: Kiểm tra chuẩn hóa email và sinh mã OTP 6 chữ số ngẫu nhiên.
  - Toàn bộ **31/31 tests** đều chạy thành công tuyệt đối qua lệnh `npm test`.

### 12. Phân hệ Khuyến mại & Mã giảm giá (Coupon / Voucher)
- **Đã hoàn thành 100%**:
  - Schema Prisma: Bổ sung 2 model `Coupon` và `CouponUsage` hỗ trợ các loại mã `FIXED`, `PERCENTAGE`, `FREE_SHIPPING`.
  - Helper & Validation (`src/lib/coupon.ts`): Kiểm tra thời hạn áp dụng, trạng thái kích hoạt, giới hạn số lần sử dụng tổng và theo từng tài khoản (`perUserLimit`), giá trị đơn tối thiểu (`minOrderAmount`).
  - API Routes:
    - `POST /api/coupons/validate`: Kiểm tra tính hợp lệ của mã giảm giá khi khách áp dụng tại giỏ hàng.
    - `GET, POST, DELETE /api/admin/coupons`: Quản lý danh sách voucher dành riêng cho Admin.
  - Tích hợp Checkout:
    - `src/components/checkout/CheckoutForm.tsx`: Thêm ô nhập mã voucher, áp dụng/hủy áp dụng mã với phản hồi trực quan.
    - `src/app/api/orders/route.ts`: Validate mã giảm giá từ server, tính lại tổng tiền chuẩn xác, tăng số lượt dùng trong transaction.
  - Dữ liệu mẫu (Seed): Thêm sẵn 3 mã ưu đãi trong `prisma/seed.ts` (`CHAOBAN`, `GIAM10`, `FREESHIP`).

### 13. Phân hệ Đánh giá (Reviews) & Yêu thích (Wishlist)
- **Đã hoàn thành 100%**:
  - Schema Prisma: Thêm model `Review` (rating 1-5 sao, nhận xét, hình ảnh) và `Wishlist` liên kết giữa `User` và `Product`.
  - API Reviews: `GET /api/products/[id]/reviews` và `POST /api/products/[id]/reviews` (chỉ cho phép đánh giá khi người dùng đã mua và thanh toán đơn hàng thành công).
  - API Wishlist: `GET /api/wishlist`, `POST /api/wishlist` (toggle yêu thích), `DELETE /api/wishlist`.

### 14. Phân hệ Thống kê & Báo cáo Admin (Analytics)
- **Đã hoàn thành 100%**:
  - API `GET /api/admin/analytics`: Thống kê tổng doanh thu thực tế (đơn đã thanh toán), số lượng đơn theo từng trạng thái, số khách hàng, số lượng sản phẩm sắp hết hàng (tồn kho <= 5), biểu đồ doanh thu 7 ngày gần nhất và top 5 sản phẩm bán chạy nhất.
  - Giao diện `AnalyticsDashboard` (`src/components/admin/AnalyticsDashboard.tsx`): Hiển thị thẻ KPI số liệu tài chính trực quan, cảnh báo tồn kho và thanh trạng thái đơn hàng trên trang chủ Admin.

### 15. Trang Chi tiết Sản phẩm, Đánh giá & Danh sách Yêu thích (Frontend UI)
- **Đã hoàn thành 100%**:
  - Trang chi tiết sản phẩm (`src/app/products/[id]/page.tsx` & `src/components/product/ProductDetailView.tsx`):
    - Đầy đủ hình ảnh, giá bán định dạng VND, badge phân loại và trạng thái kho hàng.
    - Bộ chọn số lượng (tối đa theo tồn kho), nút "Thêm vào giỏ" và "Mua ngay" chuyển thẳng tới Checkout.
    - Nút yêu thích (Heart) với animation lưu vào Wishlist.
    - Box cam kết chất lượng (Freeship từ 500k, Chính hãng 100%, Đổi trả 7 ngày).
  - Khung Đánh giá & Nhận xét (`src/components/product/ProductReviews.tsx`):
    - Hiển thị điểm số trung bình (Star rating 1-5 sao) và danh sách review kèm phản hồi từ người bán.
    - Form gửi đánh giá cho khách hàng đã mua và thanh toán đơn hàng.
  - Trang Danh sách Yêu thích (`src/app/wishlist/page.tsx` & `src/app/wishlist/wishlist-view.tsx`):
    - Hiển thị danh sách sản phẩm khách hàng đã thả tim, hỗ trợ thêm nhanh vào giỏ hàng hoặc xóa khỏi danh sách.
    - Bổ sung liên kết "Yêu thích" trên thanh điều hướng Header.

### 16. Trang Quản trị Voucher cho Admin (`/admin/coupons`)
- **Đã hoàn thành 100%**:
  - Trang quản lý (`src/app/admin/coupons/page.tsx` & `src/app/admin/coupons/coupon-manager.tsx`):
    - Bảng thống kê mã khuyến mại, loại chiết khấu, giá trị giảm, số lượt dùng thực tế/giới hạn, ngày hiệu lực.
    - Modal tạo mã mới với đầy đủ tùy chọn (Code, loại giảm FIXED/PERCENTAGE/FREE_SHIPPING, giá trị, giảm tối đa, đơn tối thiểu, số lượt dùng, thời gian bắt đầu & kết thúc).
    - Thao tác xóa voucher theo ID.
  - Bổ sung nút truy cập nhanh "Mã giảm giá (Coupon)" trên Dashboard Quản trị (`/admin`).

### 17. Tối ưu Chất lượng Code, Chuẩn hóa React 19 & Tương thích Môi trường
- **Đã hoàn thành 100%**:
  - **ESLint & React Compiler Rules**:
    - Khắc phục triệt để lỗi `react-hooks/set-state-in-effect` (chống cascading renders) bằng pattern ignore cleanup trong `useEffect`.
    - Chuẩn hóa toàn bộ mệnh đề `catch (err: any)` thành `catch (err: unknown)` an toàn kiểu dữ liệu theo tiêu chuẩn TypeScript strict.
    - Loại bỏ các hàm không thuần khiết (impure calls `Date.now()`) khỏi thân render khởi tạo state.
  - **Cross-Platform NPM Scripts**:
    - Cấu hình `npm run lint` và `npm test` sử dụng trực tiếp Node executable wrapper (`node ./node_modules/eslint/bin/eslint.js .` và `node --experimental-strip-types --test tests/**/*.test.ts`).
    - Hoạt động trơn tru trên cả môi trường mount ổ đĩa Linux không có quyền thực thi binary (`noexec`) và môi trường Windows.
  - **Kết quả nghiệm thu**:
    - `npm test`: **31/31 tests pass 100%**
    - `npm run lint`: **0 errors**

### 18. Bộ Dữ liệu Mẫu Toàn diện (Sample Seed Data)
- **Đã khởi tạo và đồng bộ 100% vào Database (`prisma/seed.ts`)**:
  - **4 Tài khoản người dùng**:
    - Admin: `admin@shop.com` / `admin123`
    - Khách hàng 1: `khachhang@gmail.com` / `user123` (Trần Thị Mai)
    - Khách hàng 2: `hoangnam@gmail.com` / `user123` (Hoàng Nam)
    - Khách hàng 3: `lethu@gmail.com` / `user123` (Lê Thu Trang)
  - **12 Sản phẩm thương mại phong phú**: Đủ 4 ngành hàng (`Thời trang`, `Công nghệ`, `Phụ kiện`, `Gia dụng & Đời sống`) kèm link ảnh thực tế Unsplash độ phân giải cao.
  - **4 Mã giảm giá thực tế**: `CHAOBAN` (giảm 20k), `GIAM10` (giảm 10%), `FREESHIP` (miễn phí vận chuyển), `VIP2026` (giảm 50k).
  - **Đơn hàng & Giao dịch ngân hàng đối soát**:
    - `DH100001`: Hoàn tất (`COMPLETED`), đã thanh toán (`PAID`), có bản ghi đối soát ngân hàng MBBank.
    - `DH100002`: Đang giao (`SHIPPING`), đã thanh toán (`PAID`), có bản ghi đối soát Vietcombank.
    - `DH100003`: Chờ thanh toán (`PENDING` / `UNPAID`) kèm mã VietQR còn hạn.
  - **Đánh giá & Phản hồi (Reviews)**: Nhận xét 5 sao thực tế từ khách hàng kèm phản hồi chăm sóc từ người bán.
  - **Danh sách yêu thích (Wishlist)**: Đã thêm sản phẩm mẫu vào tài khoản người dùng.
  - **Lịch sử Chat Realtime & Thông báo**: Hội thoại tư vấn đơn hàng và chuỗi thông báo thanh toán / đặt hàng.

### 19. Đăng nhập 1-Click Google OAuth (Ưu tiên 1)
- **Đã hoàn thành 100%**:
  - **Cấu hình NextAuth Google Provider**: Tích hợp Google Provider với `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`.
  - **Callback & Logic User (`src/lib/auth-helpers.ts`)**:
    - Tự động kiểm tra email từ Google OAuth trong cơ sở dữ liệu.
    - Nếu là khách hàng mới: Tự động khởi tạo bản ghi `User` với role `CUSTOMER`, kích hoạt `isVerified = true`.
    - Gán `id` và `role` chính xác vào JWT token và Session.
  - **Giao diện Người dùng**:
    - Thêm nút "Đăng nhập với Google" tại `/login` (`src/components/auth/LoginForm.tsx`) kèm biểu tượng Google chuẩn màu.
    - Thêm nút "Đăng ký nhanh với Google" tại `/register` (`src/components/auth/RegisterForm.tsx`).
  - **Kiểm thử tự động**: Viết test suite `tests/auth-google.test.ts` kiểm tra toàn bộ luồng callback của Google OAuth.

### 20. Giải pháp Cron Job 5 Phút Hoàn Toàn Miễn Phí (Ưu tiên 2)
- **Đã hoàn thành 100%**:
  - **Xác thực Endpoint Linh hoạt (`src/lib/cron-auth.ts` & `/api/cron/expire-orders`)**:
    - Hỗ trợ cả 2 hình thức: Header `Authorization: Bearer <CRON_SECRET>` VÀ Query param `?secret=<CRON_SECRET>`.
    - Cho phép tích hợp trực tiếp với bất kỳ webhook/cron provider nào bên ngoài.
  - **GitHub Actions Cron (`.github/workflows/expire-orders-cron.yml`)**:
    - Tự động chạy mỗi 5 phút (`*/5 * * * *`) hoàn toàn miễn phí, ping vào API của ứng dụng với cURL và ghi log chi tiết.
  - **Vercel Hobby Compliance (`vercel.json`)**:
    - Điều chỉnh lịch Vercel Cron sang 1 lần/ngày (`0 0 * * *`) để đáp ứng đúng giới hạn miễn phí của Vercel mà không bị lỗi triển khai.
  - **Tài liệu Hướng dẫn (`CRON_SETUP.md`)**:
    - Cung cấp cẩm nang chi tiết 3 giải pháp chạy Cron 5 phút miễn phí: Dùng cron-job.org, GitHub Actions, hoặc Upstash QStash.
  - **Kiểm thử tự động**: Test suite `tests/cron-auth.test.ts` (7 tests) kiểm tra toàn bộ các trường hợp xác thực token.

### 21. Tải lên Ảnh Sản phẩm & Lưu trữ Cloudinary / Local (Ưu tiên 3)
- **Đã hoàn thành 100%**:
  - **API Upload Ảnh (`/api/admin/upload` & `src/lib/upload-utils.ts`)**:
    - Giới hạn quyền Admin, validate định dạng ảnh (JPEG, PNG, WebP, GIF) và dung lượng tối đa 5MB.
    - Hỗ trợ 2 chế độ linh hoạt:
      1. Tải trực tiếp lên Cloudinary REST API khi có cấu hình `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_URL`.
      2. Tự động fallback lưu trữ cục bộ tại `/public/uploads/` khi chạy local dev hoặc chưa gắn key Cloudinary.
    - Tự động làm sạch tên file chống tấn công Path Traversal.
  - **Giao diện Quản trị Sản phẩm (`AdminProductManager.tsx`)**:
    - Thêm nút bấm tải ảnh trực quan và input chọn file từ máy tính/điện thoại.
    - Hiển thị hiệu ứng loading khi đang upload và xem trước ảnh (Preview) ngay lập tức.
  - **Kiểm thử tự động**: Test suite `tests/upload.test.ts` (11 tests) kiểm tra validate ảnh, signature Cloudinary và bảo mật tên file.

### 22. Hoàn thiện Nghiệp vụ Quản trị Admin & Đối soát VietQR (Mục tiêu nâng cao)
- **Đã hoàn thành 100%**:
  - **Đối soát Giao dịch VietQR & Webhook (`/admin/transactions` & `/api/admin/transactions`)**:
    - Xây dựng màn hình tra cứu danh sách toàn bộ giao dịch ngân hàng từ Casso Webhook, lọc theo trạng thái xác thực (`verified`) và tìm kiếm theo mã FT / mã đơn / người gửi.
    - Cung cấp tính năng **Đối soát thủ công / Khớp đơn** (`/api/admin/transactions/reconcile`), cho phép Admin xử lý các trường hợp khách chuyển khoản sai nội dung, chuyển tiền sau khi hết hạn hoặc webhook bị trễ. Hệ thống tự động xác nhận đơn sang `PAID`, tạo log giao dịch đối soát và bắn thông báo realtime cho khách hàng.
    - Module kiểm thử & logic: `src/lib/reconciliation.ts` và `tests/reconciliation.test.ts` (8 tests).
  - **Kiểm duyệt Đánh giá & Phản hồi Nhận xét (`/admin/reviews` & `/api/admin/reviews`)**:
    - Quản lý tập trung toàn bộ review từ khách hàng, lọc theo số sao (1-5 sao) và trạng thái hiển thị.
    - Cho phép Admin duyệt/ẩn bình luận (`isApproved: boolean`) để ngăn chặn spam, phản hồi trực tiếp bình luận của khách (`reply`) hiển thị công khai trên trang chi tiết sản phẩm, hoặc xóa đánh giá vi phạm.
    - Module kiểm thử & logic: `src/lib/review-moderation.ts` và `tests/review-moderation.test.ts` (5 tests).
  - **Quản lý Khách hàng & Thành viên (`/admin/customers` & `/api/admin/customers`)**:
    - Bảng thống kê khách hàng với các chỉ số: Ngày tham gia, trạng thái xác thực OTP email, tổng số đơn đã mua, tổng giá trị chi tiêu (LTV).
    - Hỗ trợ tìm kiếm theo tên, email, SĐT và xem nhanh lịch sử 3 đơn hàng gần nhất của từng khách hàng qua Modal chi tiết.
  - **Tinh gọn & An toàn cho Mã giảm giá (`/admin/coupons`)**:
    - Bổ sung nút chuyển đổi trạng thái Bật / Tắt kích hoạt (`isActive`) trực tiếp trên bảng coupon qua API `PATCH /api/admin/coupons`.
    - Cải tiến API `DELETE /api/admin/coupons`: Nếu voucher đã từng phát sinh lượt dùng trong đơn hàng (`Order` hoặc `CouponUsage`), hệ thống tự động chuyển sang chế độ Vô hiệu hóa (Tắt) thay vì xóa cứng, bảo toàn toàn vẹn dữ liệu và tránh vi phạm ràng buộc khóa ngoại (Foreign Key).
  - **Bảng điều khiển Trung tâm Quản trị (`/admin`)**:
    - Tích hợp đầy đủ các liên kết điều hướng nhanh: Đơn hàng, Đối soát giao dịch, Sản phẩm, Mã giảm giá, Đánh giá, Khách hàng, Vận chuyển GHN và Chat realtime.

### 23. Phân hệ Biến thể Sản phẩm Đa tầng (Product Variants)
- **Đã hoàn thành 100%**:
  - Model `ProductVariant` trong Prisma schema: Liên kết 1-nhiều với `Product`, hỗ trợ SKU riêng, kích thước (size), màu sắc (color), giá tiền và số lượng tồn kho độc lập theo từng biến thể.
  - Frontend UI (`src/components/product/ProductDetailView.tsx`): Cho phép khách hàng chọn size, màu sắc trực quan, hiển thị động mức giá và tồn kho khả dụng theo từng biến thể được chọn.
  - Cart Store (`src/stores/cart-store.ts` & `src/components/cart/CartItem.tsx`): Tách riêng các món hàng có cùng mã sản phẩm nhưng khác biến thể (variantId), kiểm soát tăng giảm số lượng theo đúng tồn kho của variant.
  - Kiểm thử tự động: `tests/cart-store.test.ts` (6 tests), `tests/inventory.test.ts` (7 tests), `tests/order-validation.test.ts` (14 tests).

### 24. Tích hợp Đơn vị Vận chuyển & Logistics GHN (Giao Hàng Nhanh)
- **Đã hoàn thành 100%**:
  - Model `Shipment` trong Prisma schema: Lưu thông tin vận đơn, đơn vị vận chuyển (`CarrierName.GHN`), mã tracking, tiền thu hộ COD, trạng thái giao vận (`ShipmentStatus`).
  - Dữ liệu địa chỉ Việt Nam (`src/lib/vietnam-locations.ts`): Danh mục 63 tỉnh/thành phố và quận huyện phục vụ lựa chọn địa chỉ giao hàng chuẩn xác.
  - Core Module (`src/lib/ghn.ts`):
    - Tự động tính cước phí giao hàng động theo trọng lượng gói hàng và tỉnh/thành nhận hàng (`calculateShippingFee`).
    - Tạo đơn vận chuyển sang đối tác GHN (`createGhnShipment`), hỗ trợ fallback mock tracking code khi chưa gắn API Token production.
    - Đồng bộ trạng thái giao hàng từ mã trạng thái GHN sang trạng thái đơn hàng của hệ thống (`mapGhnStatusToOrderStatus`).
  - API & Giao diện Quản trị:
    - `POST /api/shipping/fee`: Tính phí ship realtime theo địa chỉ và khối lượng giỏ hàng.
    - `GET, POST /api/admin/shipments`: Trang quản trị vận đơn `/admin/shipments`, hỗ trợ Admin tạo mã vận đơn GHN và theo dõi lộ trình.
    - `POST /api/webhooks/ghn`: Webhook tiếp nhận biến động lộ trình giao hàng từ GHN, tự động chuyển đơn sang `COMPLETED` khi đã giao thành công.
  - Kiểm thử tự động: `tests/ghn.test.ts` (10 tests).

### 25. Cổng thanh toán Dự phòng PayOS (PayOS Integration & Webhook)
- **Đã hoàn thành 100%**:
  - Core Module (`src/lib/payos.ts`):
    - Sinh mã chữ ký HMAC-SHA256 theo thuật toán sắp xếp alphabet của PayOS API.
    - Xác minh tính toàn vẹn chữ ký Webhook từ PayOS server (`verifyPayOsWebhookSignature`), chống giả mạo request.
    - Tạo liên kết thanh toán PayOS (`createPayOsPaymentLink`) với fallback checkout khi chưa gắn key.
  - API & Giao diện Thanh toán:
    - `POST /api/payment/payos/create-link`: Khởi tạo link thanh toán PayOS.
    - `POST /api/webhooks/payos`: Nhận callback xác nhận thanh toán tự động, cập nhật đơn hàng thành `PAID` và bắn thông báo realtime cho người mua.
    - Trang thanh toán PayOS `/payment/payos-checkout`: Giao diện khách hàng quét mã QR PayOS trực tuyến.
  - Kiểm thử tự động: `tests/payos.test.ts` (6 tests).

### 26. Hệ thống Ví nội bộ Shop (Shop Wallet) & Động cơ Hoàn tiền (Refund Engine)
- **Đã hoàn thành 100%**:
  - Model `UserWallet` & `WalletTransaction` trong Prisma: Lưu số dư ví và toàn bộ lịch sử biến động số dư (`REFUND`, `PURCHASE_PAYMENT`, `TOPUP`).
  - Core Engine (`src/lib/wallet.ts`):
    - `getOrCreateWallet`: Khởi tạo và truy vấn ví của thành viên.
    - `refundOrderToWallet`: Động cơ hoàn tiền 100% vào số dư ví của khách hàng khi đơn hàng đã thanh toán bị hủy, tự động chặn hoàn tiền trùng lặp (double-refund protection).
    - `payOrderWithWallet`: Thanh toán đơn hàng trực tiếp bằng số dư ví trong transaction nguyên tử, kiểm tra số dư khả dụng và cập nhật trạng thái đơn sang `PAID` tức thì.
  - API & Giao diện Người dùng:
    - `GET /api/wallet`: Lấy số dư và lịch sử giao dịch ví.
    - `POST /api/wallet/pay`: Thanh toán đơn hàng bằng ví.
    - Trang Ví của tôi `/wallet`: Giao diện trực quan kiểm tra số dư và sao kê các giao dịch hoàn tiền/chi tiêu.
  - Kiểm thử tự động: `tests/wallet.test.ts` (7 tests).

### 27. Hạ tầng Phân tán: Caching Redis & Giới hạn tần suất (Rate Limiting)
- **Đã hoàn thành 100%**:
  - Core Module (`src/lib/redis.ts`): Bộ nhớ đệm phân tán hỗ trợ Upstash Redis qua HTTP REST API, tự động fallback sang In-Memory cache tốc độ cao khi chạy dev/offline. Tích hợp caching danh mục sản phẩm (`getCachedProductList`, `invalidateProductCache`).
  - Core Module (`src/lib/rate-limit.ts`): Cơ chế Rate Limiting phân tán kiểm soát tần suất truy cập API theo Client IP (x-forwarded-for, x-real-ip), bảo vệ các API nhạy cảm như gửi OTP (`/api/auth/resend-otp`), đăng ký (`/api/auth/register`), chống tấn công DoS và Brute-force.
  - Kiểm thử tự động: `tests/redis.test.ts` (8 tests), `tests/rate-limit.test.ts` (5 tests).

### 28. Gia cố An ninh: Xác thực Magic Bytes Upload & Webhook Idempotency Chuyên sâu
- **Đã hoàn thành 100%**:
  - Kiểm tra Magic Bytes nhị phân (`src/lib/upload-utils.ts`): Đọc trực tiếp header nhị phân của file tải lên (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF...WEBP`, GIF `GIF87a/GIF89a`), ngăn chặn triệt để hình thức tấn công đổi đuôi file để upload mã thực thi nguy hiểm.
  - Bộ kiểm thử Webhook Idempotency & Replay Attack (`tests/webhook-idempotency.test.ts`): Gồm 23 kịch bản kiểm thử toàn diện bảo đảm tính bất biến tuyệt đối khi webhook ngân hàng gửi lặp, thanh toán thiếu/thừa tiền, hoặc thanh toán vào đơn hàng đã hủy/hết hạn.
  - Kiểm thử tự động: `tests/upload.test.ts` (14 tests), `tests/webhook-idempotency.test.ts` (23 tests).

### 29. Phân hệ Quên & Đặt lại mật khẩu an toàn (Password Reset Flow)
- **Đã hoàn thành 100%**:
  - **Prisma Data Model**: Sử dụng enum `OtpType { REGISTRATION, PASSWORD_RESET }` để phân tách không gian mã OTP.
  - **Core Security Engine** (`src/lib/password-reset.ts` & `src/lib/otp.ts`):
    - Sinh mã OTP 6 chữ số ngẫu nhiên, mã hóa bcrypt an toàn trước khi lưu cơ sở dữ liệu.
    - Thời gian sống (TTL) 5 phút, giới hạn tần suất yêu cầu lại (cooldown 60s).
    - Giới hạn tối đa 5 lần nhập sai mã OTP (`MAX_OTP_ATTEMPTS = 5`), tự động khóa mã OTP để chống tấn công brute-force.
    - Chặn sử dụng chéo loại OTP (mã REGISTRATION không thể verify PASSWORD_RESET) và chặn tái sử dụng mã (anti-replay).
  - **Email Template** (`src/emails/PasswordResetEmail.tsx`):
    - Giao diện chuẩn mực bằng `@react-email/components`, thông báo mã OTP và cảnh báo an toàn.
  - **API Endpoints**:
    - `POST /api/auth/forgot-password`: Kiểm tra email, rate limit 3 req/phút, kiểm tra trạng thái khóa tài khoản và gửi mã xác thực.
    - `POST /api/auth/reset-password`: Validate độ dài mật khẩu (>= 6 ký tự), rate limit 5 req/phút, xác thực OTP và băm mật khẩu mới bằng `bcryptjs`.
  - **Giao diện Người dùng**:
    - Form Đăng nhập (`LoginForm.tsx`): Bổ sung liên kết "Quên mật khẩu?" trực quan.
    - Trang Quên mật khẩu (`/forgot-password`): Giao diện 2 bước mượt mà (Bước 1 nhập email, Bước 2 nhập OTP 6 số + Mật khẩu mới kèm đồng hồ đếm ngược 60s).
  - **Kiểm thử tự động**: `tests/password-reset.test.ts` (22 tests, 5 suites pass 100%).

### 30. Quản trị Phân quyền & Điều hành Tài khoản (RBAC & User Access Control)
- **Đã hoàn thành 100%**:
  - **Prisma Data Model**:
    - Mở rộng vai trò người dùng: `enum Role { CUSTOMER, STAFF, ADMIN }`.
    - Bổ sung cờ kiểm soát an ninh `isBlocked Boolean @default(false)` trên model `User`.
  - **RBAC Security Engine** (`src/lib/admin-rbac.ts`):
    - Xử lý chuyển đổi vai trò linh hoạt: `CUSTOMER` <-> `STAFF` <-> `ADMIN`.
    - Thao tác khóa/mở khóa tài khoản tức thời (`isBlocked: true / false`).
    - Quy tắc an toàn bất biến:
      - Admin không thể tự khóa tài khoản của chính mình (`userId === adminId`).
      - Chặn tuyệt đối việc hạ quyền Admin duy nhất còn lại trong hệ thống (`adminCount <= 1`).
    - Cơ chế thực thi đăng nhập (Login Enforcement): Chặn toàn bộ các đăng nhập qua Credentials và Google OAuth nếu tài khoản có `isBlocked === true`.
  - **API Quản trị**:
    - `GET /api/admin/customers`: Hỗ trợ lọc theo Role (`ALL`, `CUSTOMER`, `STAFF`, `ADMIN`), trạng thái (`ALL`, `ACTIVE`, `BLOCKED`) và tìm kiếm từ khóa.
    - `PATCH /api/admin/customers`: Cập nhật Role, Khóa/Mở khóa tài khoản, kích hoạt xác thực email thủ công, được bảo vệ nghiêm ngặt bằng quyền `ADMIN`.
  - **Giao diện Quản trị**:
    - Nâng cấp `AdminCustomersView.tsx`: Tiêu đề "Quản lý Người dùng & Phân quyền Hệ thống", 4 thẻ KPI thống kê số lượng tài khoản theo từng nhóm, bộ lọc đa chiều Role/Trạng thái, badge màu sắc rõ ràng cho từng vai trò và trạng thái khóa/mở khóa.
    - Modal phân quyền chuyên biệt: Đổi vai trò, khóa/mở khóa có xác nhận an toàn, kích hoạt xác thực email thủ công.
    - Cập nhật `AdminDashboardView.tsx`: Card "Người dùng & Phân quyền" với icon `ShieldCheck`.
  - **Kiểm thử tự động**: `tests/rbac-user-management.test.ts` (26 tests, 5 suites pass 100%).

### 31. Kiểm thử tự động toàn hệ thống & Nghiệm thu
- **Tổng số Unit Tests**: **198/198 tests pass 100%** qua lệnh `npm test` (bao gồm 46 test suites, không có lỗi hay bỏ qua).
- **Next.js 16 Production Build**: Biên dịch thành công toàn bộ **42 routes** qua lệnh `npm run build`.
- **ESLint & TypeScript**: Đạt chuẩn nghiêm ngặt **0 errors, 0 warnings** qua lệnh `npm run lint`.
- **Database Schema**: Đồng bộ 100% với PostgreSQL qua Prisma ORM v6.4.1.

---

## III. GHI CHÚ TRIỂN KHAI CHO PRODUCTION

1. **Lập lịch Cron trên Vercel**: File `vercel.json` đã cấu hình gọi `/api/cron/expire-orders` mỗi 5 phút. Khi deploy lên Vercel, hãy thiết lập biến môi trường `CRON_SECRET` nếu muốn bảo vệ endpoint.
2. **Quyền chạy node_modules**: Trường hợp cài đặt dự án trên Linux trong môi trường ổ đĩa mount ngoại vi (FAT/NTFS), chạy `npm install` trực tiếp trên hệ điều hành Linux để đảm bảo binaries của native packages (như esbuild) tương thích đúng hệ điều hành.
3. **Cấu hình Đơn vị vận chuyển GHN & PayOS**: Cung cấp các biến môi trường `GHN_API_TOKEN`, `GHN_SHOP_ID`, `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` trong file `.env` khi kích hoạt môi trường thanh toán thực tế (hệ thống tự động chạy Mock/Fallback mode an toàn nếu chưa cấu hình).
