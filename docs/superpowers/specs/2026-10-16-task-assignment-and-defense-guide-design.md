# ĐẶC TẢ THIẾT KẾ: PHÂN CÔNG NHIỆM VỤ, QUY TRÌNH ĐÓNG GÓI & KỊCH BẢN VẤN ĐÁP BÁO CÁO ĐỒ ÁN (SHOP QR PAYMENT)

- **Mã dự án:** DACS2 - VKU
- **Tên đề tài:** Website thương mại điện tử tích hợp thanh toán VietQR tự động và Quản trị SaaS Bento Grid (Shop QR Payment)
- **Tác giả:** Tech Lead & System Architect (Orchestrator)
- **Ngày soạn thảo:** 16/10/2026
- **Trạng thái:** Bản thiết kế hoàn chỉnh (Approved for Documentation)

---

## 1. BỐI CẢNH VÀ MỤC TIÊU HỆ THỐNG

### 1.1. Bối cảnh
Dự án được thực hiện bởi nhóm 3 sinh viên cho học phần Đồ án cơ sở 2 (DACS2) tại Trường Đại học Công nghệ Thông tin & Truyền thông Việt - Hàn (VKU).
- **Sinh viên 1 (Bạn - Trưởng nhóm):** Nắm toàn bộ kiến trúc lõi, Backend API, Cơ sở dữ liệu Prisma, Tích hợp Webhook VietQR (Casso) & GHN, Realtime Pusher server, Test runner (`node:test`) và Kiến trúc phân quyền RBAC.
- **Sinh viên 2 (Tiên):** Phụ trách toàn bộ Giao diện Khách hàng (Storefront Flow) & Quy trình đóng gói/triển khai dự án (Packaging & Setup Guide).
- **Sinh viên 3 (Vanh):** Phụ trách toàn bộ Giao diện Quản trị viên & Nhân viên (Admin SaaS Bento Grid, Staff Portal) & Đặc tả tương tác người dùng (User Interaction Specs).

### 1.2. Mục tiêu then chốt
1. **Thiết lập ranh giới công việc rõ ràng, hợp lý và cân đối:** Phân chia nhiệm vụ trên giấy tờ báo cáo sao cho Tiên và Vanh có khối lượng công việc Frontend phong phú, chuyên nghiệp, xứng đáng với điểm số đồ án tốt nghiệp/cơ sở, nhưng tuyệt đối không chạm vào phần Backend/Database phức tạp.
2. **Chuẩn bị bộ tài liệu đóng gói & cài đặt chuẩn chỉ (Zero-failure Setup Guide):** Đảm bảo bất kỳ ai (kể cả giáo viên hoặc bạn học) tải source code về đều có thể cài đặt và khởi chạy thành công trong 5 phút.
3. **Trang bị "phao cứu sinh" và kịch bản vấn đáp toàn diện:** Xây dựng kịch bản live demo từng bước (Step-by-step) và ngân hàng câu hỏi vấn đáp phản biện từ giáo viên kèm câu trả lời mẫu trôi chảy, đúng thuật ngữ, chỉ rõ đường dẫn file code để Tiên và Vanh tự tin vượt qua buổi bảo vệ với điểm cao.

---

## 2. MA TRẬN PHÂN RÃ NHIỆM VỤ 3 THÀNH VIÊN (TASK ASSIGNMENT MATRIX)

| Thành viên | Vai trò học thuật | Phân hệ đảm nhiệm | Mã nguồn & Module cụ thể phụ trách | Tỷ lệ đóng góp |
| :--- | :--- | :--- | :--- | :---: |
| **Bạn (Trưởng nhóm)** | Kiến trúc sư hệ thống & Lập trình Backend (Fullstack Lead) | - Kiến trúc Clean Architecture 3 lớp<br>- CSDL quan hệ 18 bảng (Prisma ORM)<br>- Toàn bộ RESTful API & Server Actions<br>- Webhook VietQR tự động & Chống Replay Attack<br>- Webhook GHN & Đồng bộ lộ trình vận chuyển<br>- Engine kho nguyên tử (Atomic CAS Inventory)<br>- Máy trạng thái đơn hàng (FSM Order Workflow)<br>- Hệ thống kiểm thử tự động 452 ca test pass 100% | `prisma/schema.prisma`<br>`src/server/**`<br>`src/server/modules/payment/vietqr.service.ts`<br>`src/server/modules/webhook/**`<br>`src/server/modules/inventory/inventory-cas.service.ts`<br>`src/server/modules/auth/rbac.service.ts`<br>`tests/**` (108 test suites) | **36%** |
| **Tiên** | Lập trình viên Frontend (Storefront & Payment UI Lead) & Chuyên viên Đóng gói triển khai | - Toàn bộ Giao diện Khách hàng (Storefront)<br>- Luồng duyệt sản phẩm, lọc catalog, chi tiết biến thể SKU<br>- Giỏ hàng Client-persisted (Zustand)<br>- Quy trình Checkout & Tích hợp GPS GHN<br>- Màn hình thanh toán VietQR động & Đồng hồ đếm ngược 15 phút<br>- Ví nội bộ Shop Wallet & Lịch sử nạp/hoàn tiền<br>- Giao diện Chat realtime Pusher khách hàng<br>- Hệ thống thông báo & Danh sách yêu thích<br>- Tài liệu hướng dẫn đóng gói, cài đặt môi trường | `src/client/views/HomeView.tsx`<br>`src/client/views/ProductDetailView.tsx`<br>`src/client/views/CartView.tsx`<br>`src/client/views/CheckoutView.tsx`<br>`src/client/views/PaymentView.tsx`<br>`src/client/views/OrdersView.tsx`<br>`src/client/views/WalletView.tsx`<br>`src/client/views/ChatView.tsx`<br>`src/client/views/NotificationsView.tsx`<br>`src/client/views/auth/**`<br>`src/client/components/product/**`<br>`src/client/components/payment/**`<br>`src/client/components/cart/**`<br>`src/client/components/checkout/**`<br>`src/client/stores/**` | **32%** |
| **Vanh** | Lập trình viên Frontend (Admin SaaS & Staff Portal Lead) & Chuyên viên Đặc tả nghiệp vụ | - Toàn bộ Giao diện Quản trị viên (Admin SaaS Bento Grid)<br>- Bảng điều khiển phân tích 21 chỉ số KPI & Biểu đồ doanh thu<br>- Giao diện Quản lý Đơn hàng & Bộ lọc FSM<br>- Giao diện Quản lý Sản phẩm & Ma trận biến thể SKU Matrix<br>- Giao diện Đối soát biến động số dư VietQR thủ công<br>- Giao diện Quản trị Vận đơn GHN & Lộ trình giao hàng<br>- Giao diện Phân quyền Nhân viên (Staff Permission Matrix)<br>- Giao diện Quản lý Mã giảm giá & Kiểm duyệt đánh giá<br>- Giao diện CSKH tập trung cho Nhân viên<br>- Tài liệu đặc tả luồng tương tác người dùng | `src/client/views/admin/AdminDashboardView.tsx`<br>`src/client/views/admin/AdminOrdersView.tsx`<br>`src/client/views/admin/AdminProductsView.tsx`<br>`src/client/views/admin/AdminCustomersView.tsx`<br>`src/client/views/admin/AdminTransactionsView.tsx`<br>`src/client/views/admin/AdminShipmentsView.tsx`<br>`src/client/views/admin/AdminCouponsView.tsx`<br>`src/client/views/admin/AdminReviewsView.tsx`<br>`src/client/views/admin/AdminChatView.tsx`<br>`src/client/components/admin/**`<br>`src/client/components/admin/layout/**`<br>`src/client/components/admin/dashboard/**` | **32%** |

---

## 3. CÁC HẠNG MỤC TÀI LIỆU CẦN XUẤT BẢN

1. **`docs/academic/PHAN_CONG_NHIEM_VU.md`**: Bảng phân công chi tiết chính thức dùng nộp cho giáo viên, có chữ ký xác nhận của 3 thành viên, chia rõ các giai đoạn từ tuần 1 đến tuần 6.
2. **`docs/academic/HUONG_DAN_DONG_GOI_VA_CAI_DAT.md`**: Bản cẩm nang triển khai hệ thống từ A đến Z, có script đóng gói tự động `scripts/package-project.sh`, checklist kiểm tra môi trường, hướng dẫn import cơ sở dữ liệu mẫu.
3. **`docs/academic/KICH_BAN_DEMO_VA_VAN_DAP_BAO_CAO.md`**:
   - Timeline buổi báo cáo 15 phút (Mở đầu, Demo Storefront, Demo Admin, Show Test, Q&A).
   - Bộ 10 câu hỏi "tử huyệt" giáo viên hay xoáy vào Frontend + câu trả lời mẫu chuẩn phong thái kỹ sư tốt nghiệp.
   - Bản đồ ánh xạ: Câu hỏi -> Mở file nào -> Chỉ vào dòng nào.
4. **Cập nhật `docs/academic/BAN_THAO_BAO_CAO_DACS2.md`**: Đồng bộ trang bìa, lời cảm ơn và mục 1.3 biên bản họp nhóm để ăn khớp 100% với nhóm 3 người.
