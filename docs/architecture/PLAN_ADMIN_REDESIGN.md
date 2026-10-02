# PLAN: KẾ HOẠCH TRIỂN KHAI THIẾT KẾ LẠI GIAO DIỆN ADMIN (OPTION 1)

**Dự án:** `shop-qr-payment`  
**Chỉ huy điều phối:** Tech Lead & System Architect  
**Phân bổ nguồn lực:**
- `be-coder`: Nâng cấp Analytics Controller, cung cấp dữ liệu toàn diện cho Bento Dashboard.
- `fe-coder`: Triển khai Admin App Shell (Sidebar + Topbar) và Bento Grid Dashboard Widgets.
- `tester`: Nghiệm thu toàn diện kiểm thử, lint và build production.

---

## PHÂN RÃ NHIỆM VỤ CHI TIẾT

### GÓI 1: BACKEND ENHANCEMENT (`be-coder`)
- [ ] **Mục tiêu:** Bổ sung các chỉ số động cho `GET /api/admin/analytics`:
  - Doanh thu hôm nay vs hôm qua (`todayRevenue`, `todayRevenueGrowth`).
  - Đơn hàng chờ xử lý (`pendingOrdersCount`, `processingOrdersCount`).
  - Vận đơn GHN đang giao (`activeShipmentsCount`).
  - Giao dịch VietQR chưa khớp (`unmatchedTransactionsCount`) và tỷ lệ khớp tự động (`qrMatchRate`).
  - Cơ cấu thanh toán (`paymentMethodDistribution`: PayOS VietQR, Ví Shop, COD).
  - Danh sách 5 đơn hàng mới nhất (`recentOrders` kèm `itemsSummary`).
  - Cảnh báo việc cần xử lý ngay (`urgentActions`).
- [ ] **Files liên quan:**
  - `src/server/modules/admin/analytics.controller.ts`
  - `src/server/modules/admin/admin.service.ts`

---

### GÓI 2: FRONTEND APP SHELL & BENTO DASHBOARD (`fe-coder`)
- [ ] **Nhiệm vụ 2.1: Tách biệt RootLayout & Xây dựng Admin App Shell**
  - Cập nhật `src/app/layout.tsx` (hoặc tạo client layout wrapper) để ẩn Header/Footer của shop khách hàng khi truy cập các route `/admin/*`.
  - Tạo `src/client/components/admin/layout/AdminSidebar.tsx`:
    * Logo Shop Violet + Badge ADMIN.
    * Menu phân nhóm: Tổng quan, Bán hàng & Kho, Tài chính & Ưu đãi, Khách hàng & CSKH.
    * Đánh dấu Active link theo `usePathname()`.
    * Hỗ trợ nút thu gọn (Collapse/Expand) lưu vào `localStorage`.
    * Nút tắt "Xem Cửa hàng Khách" (`/`) và Avatar Profile Admin.
  - Tạo `src/client/components/admin/layout/AdminTopbar.tsx`:
    * Breadcrumbs tự động theo pathname hiện tại.
    * Thanh tìm kiếm toàn cục (Global search input).
    * Badge trạng thái Realtime (Pusher: Online/Offline).
    * Chuông thông báo (Notification Bell).
    * Nút hành động nhanh: "+ Tạo sản phẩm" dẫn tới `/admin/products`.
  - Tạo `src/client/components/admin/layout/AdminAppShell.tsx`:
    * Ghép nối Sidebar, Topbar và Content viewport dạng flex-1 overflow-auto.
  - Tạo `src/app/admin/layout.tsx`:
    * Bọc toàn bộ các trang `/admin/*` trong `AdminAppShell`.
    * Kiểm tra quyền Admin ở server-side (`getServerSession`).

- [ ] **Nhiệm vụ 2.2: Xây dựng Bento Grid Dashboard**
  - Tạo `src/client/components/admin/dashboard/AdminKpiStrip.tsx`:
    * 4 Thẻ KPI: Doanh thu hôm nay (kèm % tăng trưởng), Đơn hàng mới (badge chờ duyệt), Khớp VietQR tự động, Vận đơn GHN OpenAPI.
  - Tạo `src/client/components/admin/dashboard/AdminRevenueChart.tsx`:
    * Biểu đồ SVG Area Chart 7 ngày với hiệu ứng Gradient tím Shop Violet (`#5433eb`).
  - Tạo `src/client/components/admin/dashboard/AdminPaymentBreakdown.tsx`:
    * Thanh tiến trình hiển thị tỷ lệ doanh số theo 3 kênh: VietQR PayOS, Ví nội bộ, COD.
  - Tạo `src/client/components/admin/dashboard/AdminActionCenter.tsx`:
    * Hiển thị cảnh báo việc cần xử lý ngay (giao dịch lệch mã, sản phẩm sắp hết hàng).
  - Tạo `src/client/components/admin/dashboard/AdminRecentOrdersTable.tsx`:
    * Bảng đơn hàng mới nhất với tag trạng thái đầy đủ (PAID, PROCESSING, PENDING) và các nút bấm nhanh: "Đẩy GHN", "Xem".
  - Tái cấu trúc `src/client/views/admin/AdminDashboardView.tsx`:
    * Lắp ghép các widget thành bố cục Bento Grid đẹp mắt, chuẩn tỉ lệ và responsive.

---

### GÓI 3: TESTER & CHẤT LƯỢNG NGHIỆM THU (`tester`)
- [ ] **Kiểm tra chức năng:**
  - Chuyển hướng giữa tất cả các trang admin (`/admin`, `/admin/orders`, `/admin/shipments`, `/admin/transactions`, `/admin/products`, `/admin/customers`, `/admin/coupons`, `/admin/reviews`, `/admin/chat`) không bị vỡ giao diện, sidebar highlight đúng menu.
  - Ẩn hoàn toàn Header/Footer của shop khách khi ở trong `/admin/*`.
  - Nút quay lại shop hoạt động bình thường.
- [ ] **Xác minh kỹ thuật:**
  - `npm test`: 100% tests pass (207/207+).
  - `npm run lint`: 0 lỗi, 0 cảnh báo.
  - `npm run build`: Production build thành công không có lỗi type hay runtime.
