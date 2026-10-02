# SYSTEM DESIGN: THIẾT KẾ LẠI GIAO DIỆN ADMIN (OPTION 1: MODERN SAAS WORKSPACE)

**Dự án:** `shop-qr-payment`  
**Phiên bản thiết kế:** v1.0.0  
**Tác giả:** Tech Lead & System Architect  
**Quy chuẩn áp dụng:** `DESIGN.md` (Light Theme, Canvas Mist `#f2f4f5`, Shop Violet `#5433eb`, Ink Black `#000000`, Pill Radii `24px - 28px`).

---

## 1. MỤC TIÊU KIẾN TRÚC & TRẢI NGHIỆM (OBJECTIVES)

1. **Phân tách hoàn toàn App Shell:**
   - Phân hệ Admin (`/admin/*`) phải có layout độc lập (`AdminAppShell`), loại bỏ hoàn toàn `Header` (tìm kiếm sản phẩm, giỏ hàng) và `Footer` của trang mua sắm khách hàng.
2. **Hệ thống điều hướng chuyên nghiệp (Navigation Ergonomics):**
   - Xây dựng **Collapsible Admin Sidebar** cố định bên trái (260px) cho phép chuyển đổi tức thì giữa tất cả các phân hệ: Bảng điều khiển, Đơn hàng, Vận đơn GHN, Đối soát VietQR, Sản phẩm & Biến thể, Khách hàng & RBAC, Mã giảm giá, Đánh giá, Tin nhắn CSKH.
   - Xây dựng **Admin Topbar** tích hợp Breadcrumbs tự động, tìm kiếm toàn sàn, trạng thái kết nối Pusher Realtime, và nút tắt thao tác nhanh.
3. **Bento Grid Dashboard chuẩn SaaS:**
   - Thay thế các card danh mục cũ bằng hệ thống Bento Grid:
     - 4 thẻ KPI chỉ số kinh doanh chính (Doanh thu, Đơn mới, Tỷ lệ khớp VietQR, Vận đơn GHN).
     - Biểu đồ Doanh thu 7 ngày (SVG Area Chart kèm Gradient chuyển tiếp mượt mà).
     - Biểu đồ cơ cấu thanh toán (VietQR PayOS, Ví nội bộ, COD).
     - Hộp việc cần làm ngay (Action Center: giao dịch lệch cú pháp, cảnh báo tồn kho).
     - Bảng đơn hàng thời gian thực mới nhất có hành động nhanh 1-Click (Duyệt đơn, Đẩy GHN, Xem chi tiết).

---

## 2. KIẾN TRÚC THÀNH PHẦN (COMPONENT ARCHITECTURE)

```
src/
├── app/
│   ├── layout.tsx                               # RootLayout (Hỗ trợ ẩn Header/Footer khi pathname là /admin/*)
│   └── admin/
│       ├── layout.tsx                           # AdminLayout (Bọc tất cả trang /admin/* trong AdminAppShell)
│       └── page.tsx                             # Admin Page (Render AdminDashboardView)
├── client/
│   ├── components/
│   │   └── admin/
│   │       ├── layout/
│   │       │   ├── AdminAppShell.tsx            # Khung tổng thể Sidebar + Topbar + Content
│   │       │   ├── AdminSidebar.tsx             # Sidebar điều hướng phân nhóm, hỗ trợ thu gọn
│   │       │   └── AdminTopbar.tsx              # Topbar: Breadcrumbs, Global Search, Realtime status
│   │       └── dashboard/
│   │           ├── AdminKpiStrip.tsx            # 4 Thẻ KPI Bento số liệu động
│   │           ├── AdminRevenueChart.tsx        # Biểu đồ SVG Area 7 ngày
│   │           ├── AdminPaymentBreakdown.tsx    # Thanh tỷ lệ kênh thanh toán
│   │           ├── AdminActionCenter.tsx        # Cảnh báo việc cần xử lý ngay
│   │           └── AdminRecentOrdersTable.tsx   # Bảng đơn hàng mới nhất có quick action
│   └── views/
│       └── admin/
│           └── AdminDashboardView.tsx           # View lắp ghép các Bento widgets
└── server/
    └── modules/
        └── admin/
            ├── analytics.controller.ts          # Nâng cấp API trả thêm số liệu vận hành
            └── admin.service.ts                 # Service tổng hợp KPI thời gian thực
```

---

## 3. THIẾT KẾ HỢP ĐỒNG DỮ LIỆU API (API CONTRACTS)

### Endpoint: `GET /api/admin/analytics`
Bổ sung các trường dữ liệu thời gian thực phục vụ Bento Dashboard:

```typescript
export interface AdminAnalyticsResponse {
  summary: {
    totalRevenue: number;           // Doanh thu thực tế (đã thanh toán)
    todayRevenue: number;           // Doanh thu riêng hôm nay
    todayRevenueGrowth: number;     // % tăng trưởng so với hôm qua (+14.2%)
    totalOrders: number;            // Tổng số đơn
    todayOrders: number;            // Số đơn hôm nay
    pendingOrdersCount: number;     // Số đơn chờ duyệt (PENDING/UNPAID)
    processingOrdersCount: number;  // Số đơn đang xử lý kho
    lowStockCount: number;          // Số sản phẩm tồn kho <= 5
    totalCustomers: number;         // Tổng khách hàng đăng ký
    qrMatchRate: number;            // Tỷ lệ khớp tự động VietQR (vd: 98.8%)
    unmatchedTransactionsCount: number; // Giao dịch chuyển khoản chưa khớp
    activeShipmentsCount: number;   // Vận đơn GHN đang trên đường giao
  };
  ordersByStatus: Record<string, number>;
  revenueTrend: Array<{
    date: string;                   // 'YYYY-MM-DD'
    label: string;                  // 'T2', 'T3', ...
    revenue: number;                // Doanh số ngày
  }>;
  paymentMethodDistribution: {
    payosQrPercentage: number;      // Tỷ lệ VietQR (vd: 68%)
    walletPercentage: number;       // Tỷ lệ Ví shop (vd: 22%)
    codPercentage: number;          // Tỷ lệ COD (vd: 10%)
  };
  urgentActions: Array<{
    id: string;
    type: 'TRANSACTION_MISMATCH' | 'LOW_STOCK' | 'NEW_ORDER' | 'SHIPMENT_ISSUE';
    title: string;
    description: string;
    link: string;
  }>;
  recentOrders: Array<{
    id: string;
    orderCode: string;
    customerName: string;
    customerPhone: string;
    itemsSummary: string;
    totalAmount: number;
    paymentStatus: string;
    status: string;
    createdAt: string;
  }>;
  topProducts: Array<{
    productId: string;
    name: string;
    price: number;
    image: string | null;
    category: string | null;
    totalSold: number;
  }>;
}
```

---

## 4. QUY CHUẨN DESIGN TOKENS (MAPPING TỪ DESIGN.MD)

| Thành phần UI | Token / Màu sắc | Giá trị CSS |
| :--- | :--- | :--- |
| **Nền Canvas Admin** | Canvas Mist | `bg-[#f3f4f6]` |
| **Bề mặt Card Bento** | Pure White | `bg-white rounded-[24px] border border-slate-200/80 shadow-sm` |
| **Màu nhấn thương hiệu** | Shop Violet | `#5433eb` (Hover: `#4628cb`, Wash: `#f0edfe`) |
| **Tiêu đề & Chỉ số KPI** | Ink Black | `text-slate-900 font-extrabold tracking-tight` |
| **Phụ đề & Nhãn phụ** | Muted Gray | `text-slate-500 text-xs` |
| **Nút bấm / Badge** | Pill Shape | `rounded-full px-3 py-1 text-xs font-bold` |

---

## 5. BẢO MẬT & INVARIANTS (SECURITY INVARIANTS)

1. **Role Guard:** Tất cả các route `/admin/*` và API `/api/admin/*` bắt buộc kiểm tra `session.user.role === 'ADMIN'`. Người dùng không có quyền lập tức bị chuyển hướng về `/`.
2. **Fail-Closed Realtime Status:** Khi Pusher server mất kết nối hoặc client offline, hiển thị trạng thái Offline rõ ràng trên Topbar để tránh quản trị viên hiểu nhầm dữ liệu là tức thì.
3. **Safe Navigation State:** Lưu trạng thái đóng/mở của Sidebar vào `localStorage` (`admin_sidebar_collapsed`) để bảo toàn thói quen sử dụng của người dùng.
