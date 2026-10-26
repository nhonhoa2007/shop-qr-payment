# BẢNG PHÂN CÔNG NHIỆM VỤ ĐỒ ÁN CƠ SỞ 2 (DACS2)

**TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN & TRUYỀN THÔNG VIỆT - HÀN (VKU)**  
**KHOA KHOA HỌC MÁY TÍNH**  
**Học kỳ I — Năm học 2026 - 2027**

---

- **Tên đề tài:** Website thương mại điện tử tích hợp thanh toán VietQR tự động và Quản trị SaaS Bento Grid (Shop QR Payment)
- **Giảng viên hướng dẫn:** `[Học hàm, Học vị & Họ tên Giảng viên hướng dẫn]`
- **Nhóm sinh viên thực hiện:**
  1. `[Họ và tên Trưởng nhóm - MSSV]` — **Nhóm trưởng (Tech Lead & Backend Architect)**
  2. `[Họ và tên Sinh viên Tiên - MSSV]` — **Thành viên (Frontend Storefront & Packaging Specialist)**
  3. `[Họ và tên Sinh viên Vanh - MSSV]` — **Thành viên (Frontend Admin Portal & UI/UX Specialist)**

---

## 1. TỔNG QUAN PHÂN CHIA TRÁCH NHIỆM

Nhằm tối ưu hóa năng lực của từng thành viên và bảo đảm tính chuyên môn hóa cao trong quy trình phát triển phần mềm chuẩn công nghiệp, nhóm đã thống nhất phân chia ranh giới công việc rõ ràng:
- **Trưởng nhóm:** Đảm nhận vai trò **Kiến trúc sư hệ thống & Lập trình viên Backend (Fullstack Lead)**, chịu trách nhiệm thiết kế hệ thống, xây dựng cơ sở dữ liệu quan hệ, toàn bộ hệ thống API nghiệp vụ, tích hợp các Webhook tài chính & logistics, xử lý tranh chấp kho nguyên tử và hệ thống kiểm thử tự động.
- **Sinh viên Tiên:** Đảm nhận vai trò **Lập trình viên Frontend Phân hệ Khách hàng (Storefront Lead) & Chuyên viên Đóng gói triển khai**, chịu trách nhiệm toàn bộ các giao diện người dùng mua sắm, giỏ hàng, luồng thanh toán VietQR động 15 phút, ví nội bộ, tương tác thời gian thực khách hàng và xây dựng tài liệu/script đóng gói cài đặt hệ thống.
- **Sinh viên Vanh:** Đảm nhận vai trò **Lập trình viên Frontend Phân hệ Quản trị (Admin Portal Lead) & Chuyên viên Đặc tả nghiệp vụ**, chịu trách nhiệm toàn bộ bảng điều khiển SaaS Bento Grid 21 chỉ số, các giao diện quản trị đơn hàng, sản phẩm biến thể, đối soát tài chính, vận đơn GHN, ma trận phân quyền nhân viên và tài liệu đặc tả luồng tương tác.

---

## 2. BẢNG MA TRẬN NHIỆM VỤ VÀ MINH CHỨNG MÃ NGUỒN CHI TIẾT

| STT | Thành viên | Vai trò & Trách nhiệm chính | Hạng mục công việc chi tiết | Minh chứng mã nguồn (Files / Directories) | Tỷ lệ đóng góp | Đánh giá hoàn thành |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: |
| **1** | **`[Trưởng nhóm]`** | **Tech Lead & Backend Architect** | - Thiết kế kiến trúc Clean Architecture 3 lớp.<br>- Thiết kế và chuẩn hóa 18 bảng CSDL quan hệ Prisma.<br>- Xây dựng toàn bộ RESTful API & Server Actions.<br>- Xây dựng Webhook VietQR (Casso) tự động khớp giao dịch chuyển khoản Napas 247.<br>- Tích hợp Webhook Giao Hàng Nhanh (GHN) tự động tạo vận đơn & đồng bộ lộ trình.<br>- Xây dựng Engine tồn kho nguyên tử chống race condition (Atomic CAS Inventory).<br>- Tích hợp dịch vụ WebSocket Realtime Pusher phía máy chủ.<br>- Viết và vận hành hệ thống kiểm thử tự động (452 test cases, 108 suites pass 100%). | `prisma/schema.prisma`<br>`src/server/**`<br>`src/server/modules/payment/vietqr.service.ts`<br>`src/server/modules/webhook/casso.service.ts`<br>`src/server/modules/shipping/ghn.service.ts`<br>`src/server/modules/inventory/inventory-cas.service.ts`<br>`src/server/modules/auth/rbac.service.ts`<br>`tests/**` | **36%** | **100%** (Xuất sắc) |
| **2** | **`[Tiên]`** | **Frontend Storefront & Packaging Lead** | - Xây dựng Giao diện Trang chủ & Hero Constellation trực quan.<br>- Xây dựng Giao diện Catalog sản phẩm, bộ lọc danh mục và tìm kiếm.<br>- Xây dựng Giao diện Chi tiết sản phẩm, chọn biến thể đa thuộc tính (Size, Màu).<br>- Xây dựng Giỏ hàng Client-persisted đồng bộ LocalStorage (Zustand store).<br>- Xây dựng Giao diện Thanh toán (Checkout) tích hợp API định vị GPS & địa chỉ GHN.<br>- Xây dựng Màn hình thanh toán VietQR động kèm đồng hồ đếm ngược 15 phút thời gian thực.<br>- Xây dựng Giao diện Quản lý Đơn hàng & Hủy đơn hàng của khách hàng.<br>- Xây dựng Giao diện Ví Shop Wallet (Nạp tiền, kiểm tra số dư, lịch sử biến động ví).<br>- Xây dựng Giao diện Chat trực tiếp với CSKH & Thông báo đẩy (Pusher client).<br>- Xây dựng Giao diện Đăng ký/Đăng nhập xác thực mã OTP qua Email.<br>- Soạn thảo tài liệu và script đóng gói, hướng dẫn cài đặt môi trường (`HUONG_DAN_DONG_GOI_VA_CAI_DAT.md`). | `src/client/views/HomeView.tsx`<br>`src/client/views/ProductDetailView.tsx`<br>`src/client/views/CartView.tsx`<br>`src/client/views/CheckoutView.tsx`<br>`src/client/views/PaymentView.tsx`<br>`src/client/views/OrdersView.tsx`<br>`src/client/views/WalletView.tsx`<br>`src/client/views/ChatView.tsx`<br>`src/client/views/NotificationsView.tsx`<br>`src/client/views/WishlistView.tsx`<br>`src/client/views/auth/**`<br>`src/client/components/product/**`<br>`src/client/components/payment/**`<br>`src/client/components/cart/**`<br>`src/client/components/checkout/**`<br>`src/client/components/wallet/**`<br>`src/client/components/chat/**`<br>`src/client/stores/cart-store.ts`<br>`src/client/stores/notification-store.ts` | **32%** | **100%** (Xuất sắc) |
| **3** | **`[Vanh]`** | **Frontend Admin Portal & UI/UX Lead** | - Xây dựng Khung ứng dụng Quản trị (Admin App Shell, Sidebar, Topbar phản hồi).<br>- Xây dựng Bảng điều khiển SaaS Bento Grid hiển thị 21 chỉ số KPI kinh doanh.<br>- Thiết kế các thẻ Bento Grid trực quan: Biểu đồ doanh thu 7 ngày (SVG Bar Chart), Biểu đồ cơ cấu thanh toán (Donut Chart), Thẻ đơn hàng thời gian thực.<br>- Xây dựng Giao diện Quản lý Đơn hàng: Lọc theo máy trạng thái FSM, xem chi tiết và chuyển trạng thái đơn.<br>- Xây dựng Giao diện Quản lý Sản phẩm & Ma trận biến thể SKU Matrix (kích thước, màu sắc, tồn kho, giá bán).<br>- Xây dựng Giao diện Quản trị Khách hàng & Ma trận phân quyền Nhân viên (Staff Permission Matrix: Phân bổ 5 nhóm quyền độc lập).<br>- Xây dựng Giao diện Đối soát biến động số dư VietQR & Khớp tiền thủ công khi ngân hàng trễ sao kê.<br>- Xây dựng Giao diện Quản lý Vận đơn GHN & Lộ trình giao hàng trực quan.<br>- Xây dựng Giao diện Quản lý Mã giảm giá (Coupons) & Kiểm duyệt Đánh giá (Reviews).<br>- Xây dựng Giao diện CSKH đa kênh tập trung cho Nhân viên hỗ trợ.<br>- Soạn thảo tài liệu đặc tả luồng tương tác giao diện và kịch bản demo (`KICH_BAN_DEMO_VA_VAN_DAP_BAO_CAO.md`). | `src/client/views/admin/AdminDashboardView.tsx`<br>`src/client/views/admin/AdminOrdersView.tsx`<br>`src/client/views/admin/AdminProductsView.tsx`<br>`src/client/views/admin/AdminCustomersView.tsx`<br>`src/client/views/admin/AdminTransactionsView.tsx`<br>`src/client/views/admin/AdminShipmentsView.tsx`<br>`src/client/views/admin/AdminCouponsView.tsx`<br>`src/client/views/admin/AdminReviewsView.tsx`<br>`src/client/views/admin/AdminChatView.tsx`<br>`src/client/components/admin/layout/**`<br>`src/client/components/admin/dashboard/**`<br>`src/client/components/admin/AnalyticsDashboard.tsx`<br>`src/client/components/admin/BankReviewPanel.tsx` | **32%** | **100%** (Xuất sắc) |

---

## 3. KẾ HOẠCH TRIỂN KHAI THEO TIẾN ĐỘ 6 TUẦN

| Giai đoạn | Nội dung công việc | Phụ trách chính | Phối hợp | Sản phẩm bàn giao |
| :---: | :--- | :--- | :--- | :--- |
| **Tuần 1** | - Khảo sát đề tài, phân tích yêu cầu nghiệp vụ.<br>- Thiết kế CSDL 18 bảng (Prisma) và vẽ sơ đồ ERD/UML.<br>- Khởi tạo layout Storefront & Admin Shell. | Trưởng nhóm | Tiên, Vanh | - Schema CSDL hoàn chỉnh.<br>- Khung dự án Next.js 16 + Tailwind CSS. |
| **Tuần 2** | - Xây dựng xác thực (NextAuth, OTP Email, RBAC).<br>- Dựng giao diện Đăng ký, Đăng nhập, Catalog, Chi tiết sản phẩm.<br>- Dựng giao diện Bảng điều khiển Bento Grid cơ bản. | Tiên (Storefront)<br>Vanh (Admin) | Trưởng nhóm (Auth APIs) | - Hoàn thiện các trang Auth & Product Listing.<br>- Khung Dashboard Admin. |
| **Tuần 3** | - Lập trình Engine giỏ hàng (Zustand) & Checkout GHN.<br>- Tích hợp sinh mã VietQR động & Webhook ngân hàng.<br>- Xây dựng giao diện Quản lý Đơn hàng & Quản lý Sản phẩm Admin. | Trưởng nhóm (APIs)<br>Tiên (Payment UI)<br>Vanh (Order/Product UI) | Cả nhóm | - Luồng mua hàng & thanh toán VietQR hoạt động.<br>- Quản lý đơn hàng & sản phẩm trên Admin. |
| **Tuần 4** | - Xây dựng phân hệ Ví Shop Wallet & hoàn tiền tự động.<br>- Xây dựng Ma trận phân quyền nhân viên (Staff Permissions).<br>- Tích hợp vận đơn GHN & Webhook cập nhật hành trình.<br>- Tích hợp chat thời gian thực Pusher WebSockets. | Trưởng nhóm (Wallet, Socket)<br>Tiên (Wallet UI, Chat UI)<br>Vanh (Staff Matrix UI, GHN UI) | Cả nhóm | - Khách hàng nạp ví, hủy đơn hoàn tiền.<br>- Phân quyền nhân viên hoạt động.<br>- Chat CSKH thời gian thực. |
| **Tuần 5** | - Viết toàn bộ hệ thống kiểm thử tự động (Unit & Integration tests).<br>- Tối ưu hóa UI/UX, responsive trên thiết bị di động.<br>- Kiểm thử luồng đối soát giao dịch VietQR thủ công. | Trưởng nhóm (Tests)<br>Tiên (UI polish)<br>Vanh (Audit UI) | Cả nhóm | - 452 test cases pass 100%.<br>- Giao diện chuẩn chỉ không lỗi linter. |
| **Tuần 6** | - Đóng gói dự án, xuất file nén mã nguồn & seed demo data.<br>- Soạn thảo tài liệu báo cáo học thuật VKU (Chương I - V).<br>- Tổng dợt kịch bản live demo và luyện tập vấn đáp bảo vệ. | Cả nhóm | Cả nhóm | - Bản báo cáo hoàn chỉnh (`.docx`, `.pdf`).<br>- Gói mã nguồn & tài liệu hướng dẫn chạy.<br>- Kịch bản demo sẵn sàng. |

---

## 4. XÁC NHẬN VÀ CAM KẾT CỦA CÁC THÀNH VIÊN

Các thành viên trong nhóm cam kết:
1. Nội dung phân công công việc trên là hoàn toàn chính xác, phản ánh trung thực quá trình tham gia và đóng góp của từng cá nhân vào đề tài.
2. Toàn bộ mã nguồn và tài liệu là kết quả lao động nghiêm túc của nhóm, tuân thủ đúng quy định liêm chính học thuật của nhà trường.
3. Từng thành viên nắm vững phần việc được phân công và sẵn sàng trả lời độc lập các câu hỏi vấn đáp phản biện từ Hội đồng chấm thi.

*Đà Nẵng, ngày 16 tháng 10 năm 2026*

| Trưởng nhóm | Thành viên 1 | Thành viên 2 |
| :---: | :---: | :---: |
| *(Ký và ghi rõ họ tên)*<br><br><br><br>**`[Họ và tên Trưởng nhóm]`** | *(Ký và ghi rõ họ tên)*<br><br><br><br>**`[Họ và tên Tiên]`** | *(Ký và ghi rõ họ tên)*<br><br><br><br>**`[Họ và tên Vanh]`** |
