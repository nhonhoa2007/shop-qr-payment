# Thiết kế hệ thống phân quyền STAFF theo Permission Matrix chi tiết

> Ngày: 2026-10-04 · Nhánh: `feature/admin-saas-workspace`

---

## 1. Mục tiêu

Tách biệt vai trò STAFF thành các nhóm quyền hạn theo chuyên môn (permission-based RBAC), cho phép một tài khoản STAFF chỉ truy cập đúng những khu vực nghiệp vụ được Admin giao. Hệ thống phải:

- Hỗ trợ **gán nhiều permission** cho 1 tài khoản STAFF (thay vì hardcode 1 role = 1 bộ quyền cố định).
- ADMIN giữ toàn quyền (bypass mọi permission check).
- Không thay đổi trải nghiệm CUSTOMER — họ không liên quan tới hệ thống permission.
- Tận dụng cấu trúc Prisma/code hiện tại, tối thiểu breaking changes.

---

## 2. Mô hình Permission

### 2.1. Định nghĩa Permissions

Mỗi permission đại diện cho 1 nhóm chức năng cụ thể trong panel quản trị:

| Permission Key | Tên hiển thị | Mô tả phạm vi |
|---|---|---|
| `orders` | Quản lý đơn hàng | Xem tất cả đơn, chuyển trạng thái FSM (CONFIRMED→PROCESSING→SHIPPING→COMPLETED, hủy/hoàn tiền) |
| `products` | Quản lý sản phẩm & kho | Thêm/sửa sản phẩm, cập nhật tồn kho, quản lý biến thể, upload ảnh. **Không** xóa vĩnh viễn (ADMIN-only). |
| `shipments` | Quản lý vận đơn | Xem/theo dõi vận đơn GHN, tracking |
| `chat` | Chat CSKH | Trực chat realtime, join phòng chat đơn hàng, nhắn tin, đánh dấu đã đọc |
| `reviews` | Quản lý đánh giá | Xem, duyệt/ẩn, phản hồi đánh giá sản phẩm. **Không** xóa vĩnh viễn (ADMIN-only). |

### 2.2. Permissions dành riêng cho ADMIN (không gán cho STAFF)

| Khu vực | Lý do bảo vệ |
|---|---|
| Dashboard tài chính (doanh thu, revenue trend, tỷ lệ khớp QR) | Dữ liệu tài chính nhạy cảm |
| Giao dịch VietQR & Đối soát ngân hàng | Truy cập chi tiết banking |
| Mã giảm giá (Coupons CRUD) | Ảnh hưởng chính sách giá |
| Quản lý tài khoản & RBAC (thay đổi role, block/unblock user) | An ninh nhân sự |
| Xóa vĩnh viễn sản phẩm/đánh giá | Hành vi phá hủy không thể hoàn tác |

### 2.3. Dashboard cho STAFF

STAFF có permission bất kỳ sẽ thấy trang `/admin` với **dashboard vận hành rút gọn**: chỉ hiển thị số liệu phù hợp quyền đang có. Ví dụ: STAFF có permission `orders` + `shipments` thấy số đơn chờ xử lý, đơn đang giao, cảnh báo tồn kho thấp — nhưng **không** thấy tổng doanh thu, revenue chart, tỷ lệ khớp QR, biểu đồ khách hàng mới.

---

## 3. Thay đổi Database (Prisma Schema)

### 3.1. Thêm bảng `StaffPermission`

```prisma
model StaffPermission {
  id         String   @id @default(cuid())
  userId     String
  permission String   // 'orders' | 'products' | 'shipments' | 'chat' | 'reviews'
  grantedBy  String   // Admin userId who granted
  grantedAt  DateTime @default(now())

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  granter    User     @relation("GrantedPermissions", fields: [grantedBy], references: [id])

  @@unique([userId, permission])
  @@index([userId])
}
```

### 3.2. Cập nhật model User

```prisma
model User {
  // ... các field hiện tại giữ nguyên ...
  staffPermissions    StaffPermission[]
  grantedPermissions  StaffPermission[]  @relation("GrantedPermissions")
}
```

### 3.3. Enum Role — giữ nguyên

```prisma
enum Role {
  CUSTOMER
  STAFF
  ADMIN
}
```

Không thêm enum cho Permission — dùng string + validation ở tầng application để dễ mở rộng sau này mà không cần migration mới.

---

## 4. Tầng Server — Permission Service & Guards

### 4.1. Permission Constants (`@shared/constants/permissions.ts`)

```ts
export const STAFF_PERMISSIONS = ['orders', 'products', 'shipments', 'chat', 'reviews'] as const;
export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<StaffPermission, string> = {
  orders: 'Quản lý đơn hàng',
  products: 'Quản lý sản phẩm & kho',
  shipments: 'Quản lý vận đơn',
  chat: 'Chat CSKH',
  reviews: 'Quản lý đánh giá',
};
```

### 4.2. Permission Service (`@server/modules/admin/permission.service.ts`)

```ts
// Lấy danh sách permissions của 1 STAFF user
async function getStaffPermissions(userId: string): Promise<StaffPermission[]>

// Kiểm tra STAFF có permission cụ thể
async function hasPermission(userId: string, permission: StaffPermission): Promise<boolean>

// Gán/Thu hồi permissions (chỉ ADMIN gọi)
async function setPermissions(userId: string, permissions: StaffPermission[], grantedBy: string): Promise<void>
```

### 4.3. Guard Helper — Thay thế hardcode `role !== 'ADMIN'`

Tạo hàm `requireOperatorPermission` tái sử dụng thay vì copy-paste guard:

```ts
// @server/modules/admin/guards.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { hasPermission } from './permission.service';
import type { StaffPermission } from '@shared/constants/permissions';

interface GuardResult {
  authorized: true;
  session: { user: { id: string; role: string; name?: string } };
} | {
  authorized: false;
  response: NextResponse;
}

export async function requireOperatorPermission(
  permission: StaffPermission
): Promise<GuardResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { authorized: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  // ADMIN bypass — toàn quyền
  if (session.user.role === 'ADMIN') {
    return { authorized: true, session };
  }

  // STAFF — kiểm tra permission cụ thể
  if (session.user.role === 'STAFF') {
    const allowed = await hasPermission(session.user.id, permission);
    if (allowed) {
      return { authorized: true, session };
    }
  }

  return { authorized: false, response: NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 }) };
}

// Guard ADMIN-only (giữ nguyên cho khu vực nhạy cảm)
export async function requireAdmin(): Promise<GuardResult> { ... }
```

---

## 5. Ma trận áp dụng Guard theo Controller

### 5.1. Controllers chuyển sang `requireOperatorPermission`

| Controller | Method | Guard mới | Ghi chú |
|---|---|---|---|
| `orders.controller.ts` | GET | `requireOperatorPermission('orders')` | STAFF thấy tất cả đơn (không lọc userId) |
| `order-detail.controller.ts` | GET | `requireOperatorPermission('orders')` hoặc chủ đơn | Giữ logic chủ đơn cho CUSTOMER |
| `order-detail.controller.ts` | PATCH | `requireOperatorPermission('orders')` hoặc chủ đơn hủy | STAFF chuyển FSM như ADMIN; CUSTOMER chỉ hủy đơn mình |
| `products.controller.ts` | GET | Public (giữ nguyên) | Catalog công khai |
| `products.controller.ts` | POST | `requireOperatorPermission('products')` | Tạo sản phẩm |
| `products.controller.ts` | PUT | `requireOperatorPermission('products')` | Sửa sản phẩm |
| `products.controller.ts` | DELETE | `requireAdmin()` | **Chỉ ADMIN** xóa vĩnh viễn |
| `admin/upload/route.ts` | POST | `requireOperatorPermission('products')` | STAFF upload ảnh khi quản lý sản phẩm |
| `shipments.controller.ts` | GET | `requireOperatorPermission('shipments')` | Xem vận đơn |
| `admin-reviews.controller.ts` | GET | `requireOperatorPermission('reviews')` | Xem đánh giá |
| `admin-reviews.controller.ts` | PATCH | `requireOperatorPermission('reviews')` | Duyệt/phản hồi đánh giá |
| `admin-reviews.controller.ts` | DELETE | `requireAdmin()` | **Chỉ ADMIN** xóa đánh giá |
| `chat-messages.controller.ts` | GET/POST | `requireOperatorPermission('chat')` | STAFF auto-join phòng chat như ADMIN |
| `chat-read.controller.ts` | POST | `requireOperatorPermission('chat')` | Đánh dấu đã đọc |
| `pusher-auth.controller.ts` | POST | `requireOperatorPermission('chat')` cho kênh chat; `requireAdmin()` cho admin-channel | Giữ private-admin-channel chỉ ADMIN |

### 5.2. Controllers giữ nguyên `requireAdmin()` (ADMIN-only)

| Controller | Lý do |
|---|---|
| `analytics.controller.ts` | Dữ liệu tài chính nhạy cảm — STAFF xem dashboard rút gọn qua endpoint riêng |
| `transactions.controller.ts` | Chi tiết giao dịch banking |
| `reconcile.controller.ts` | Đối soát tiền tệ |
| `coupons.controller.ts` (GET/POST/PUT/DELETE) | Chính sách giá |
| `customers.controller.ts` (GET/PATCH) | Quản lý nhân sự & RBAC |

---

## 6. Dashboard rút gọn cho STAFF

### 6.1. Endpoint mới: `GET /api/admin/analytics/staff`

Trả về subset dữ liệu analytics dựa trên permissions hiện tại của STAFF:

```ts
interface StaffDashboardResponse {
  // Luôn hiển thị
  todayOrders: number;          // nếu có permission 'orders'
  pendingOrdersCount: number;   // nếu có permission 'orders'
  processingOrdersCount: number;// nếu có permission 'orders'
  ordersByStatus: Record<string, number>; // nếu có permission 'orders'

  // Nếu có permission 'shipments'
  activeShipmentsCount: number;
  deliveredShipmentsCount: number;

  // Nếu có permission 'products'
  lowStockCount: number;

  // Nếu có permission 'orders'
  recentOrders: RecentOrderDto[];

  // Thông tin cảnh báo vận hành (không chứa tài chính)
  urgentActions: UrgentAction[]; // Lọc bỏ TRANSACTION_MISMATCH

  // KHÔNG trả về:
  // totalRevenue, todayRevenue, todayRevenueGrowth, periodRevenue
  // revenueTrend, newCustomersTrend, paymentMethodDistribution
  // qrMatchRate, unmatchedTransactionsCount, totalTransactions
  // topProducts (chứa thông tin doanh số)
}
```

### 6.2. Dashboard UI

Trang `/admin` (AdminDashboardView) nhận `user.role`:
- Nếu `ADMIN` → render dashboard đầy đủ (hiện tại, không đổi).
- Nếu `STAFF` → gọi endpoint staff, render Bento Grid rút gọn chỉ gồm các card phù hợp permissions.

---

## 7. Admin Layout & Sidebar

### 7.1. `src/app/admin/layout.tsx`

Mở gate cho STAFF:

```ts
if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
  redirect('/login?callbackUrl=/admin&reason=permission');
}
```

### 7.2. `AdminSidebar.tsx` — Lọc menu theo permissions

Truyền `user.role` và `permissions: StaffPermission[]` vào Sidebar. Logic lọc:

| Menu item | Hiển thị khi |
|---|---|
| Bảng điều khiển | Luôn hiển thị (dashboard rút gọn cho STAFF) |
| Đơn hàng | `role === 'ADMIN'` hoặc có permission `orders` |
| Vận đơn GHN | `role === 'ADMIN'` hoặc có permission `shipments` |
| Sản phẩm & Biến thể | `role === 'ADMIN'` hoặc có permission `products` |
| Đối soát VietQR | `role === 'ADMIN'` only |
| Mã giảm giá | `role === 'ADMIN'` only |
| Khách hàng & RBAC | `role === 'ADMIN'` only |
| Tin nhắn trực tuyến | `role === 'ADMIN'` hoặc có permission `chat` |
| Đánh giá sản phẩm | `role === 'ADMIN'` hoặc có permission `reviews` |

Nhóm nav "Tài chính & Ưu đãi" hoàn toàn ẩn khi STAFF không có permission nào liên quan.

### 7.3. Sidebar branding

STAFF thấy badge `STAFF` (màu blue) thay vì `ADMIN` (purple). Subtitle hiển thị "Nhân viên vận hành" thay vì "Super Admin".

---

## 8. Giao diện quản lý Permission cho ADMIN

### 8.1. Mở rộng trang Khách hàng & RBAC (`AdminCustomersView`)

Khi Admin thay đổi role user thành STAFF, hiển thị thêm khu vực chọn permissions:

- Checkbox grid với 5 permission options.
- Mỗi checkbox có label tiếng Việt và mô tả ngắn.
- Lưu qua API `PATCH /api/admin/customers` (mở rộng body để nhận `permissions: string[]`).

### 8.2. API mở rộng

`PATCH /api/admin/customers`:
```json
{
  "userId": "...",
  "role": "STAFF",
  "permissions": ["orders", "products", "shipments"]
}
```

Logic:
- Nếu `role` đổi thành `STAFF` và có `permissions` → gán permissions.
- Nếu `role` đổi thành `STAFF` mà không gửi `permissions` → giữ permissions hiện tại.
- Nếu `role` đổi từ `STAFF` sang `CUSTOMER` hoặc `ADMIN` → xóa toàn bộ permissions (cascade).

---

## 9. Truyền permissions xuống Client

### 9.1. NextAuth session mở rộng

Mở rộng JWT callback để include `permissions` khi `role === 'STAFF'`:

```ts
// auth-options.ts → callbacks.jwt
if (token.role === 'STAFF') {
  token.permissions = await getStaffPermissions(token.id);
}

// callbacks.session
session.user.permissions = token.permissions ?? [];
```

### 9.2. Type mở rộng

```ts
// next-auth.d.ts
declare module 'next-auth' {
  interface User {
    role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
    permissions?: string[];
  }
  interface Session {
    user: {
      id: string;
      role: string;
      permissions?: string[];
    } & DefaultSession['user'];
  }
}
```

---

## 10. Cập nhật Order Detail cho STAFF operator

Trong `order-detail.controller.ts`, khi STAFF có permission `orders`:
- **Xem đơn**: Được xem mọi đơn (không giới hạn `userId`).
- **Chuyển trạng thái**: Có quyền tương đương ADMIN (FSM transitions, tạo vận đơn GHN khi chuyển PROCESSING, hủy + hoàn tiền).
- **Refund message**: Thay "Quản trị viên" bằng "Nhân viên" khi STAFF hủy đơn đã thanh toán.

Logic sửa:
```ts
const isOperator = session.user.role === 'ADMIN' || session.user.role === 'STAFF';
// Thay mọi chỗ dùng `isAdmin` bằng `isOperator`
// Giữ `isAdmin` riêng cho message text ("Quản trị viên" vs "Nhân viên")
```

---

## 11. Pusher Channel Access

| Channel | ADMIN | STAFF (có permission) | CUSTOMER |
|---|---|---|---|
| `private-admin-channel` | ✅ | ❌ | ❌ |
| `private-chat-<roomId>` | ✅ | ✅ (`chat`) | ✅ (chủ đơn) |
| `private-user-<userId>` | ❌ | ❌ | ✅ (chủ tài khoản) |

STAFF **không** nhận events trên `private-admin-channel` (analytics-updated, new-order broadcasts). Nếu cần thông báo đơn mới cho STAFF, cân nhắc tạo kênh `private-staff-channel` trong tương lai — **ngoài phạm vi spec này**.

---

## 12. Testing

### 12.1. Unit tests mới

- `tests/permissions.test.ts`:
  - Test `requireOperatorPermission` với ADMIN (bypass), STAFF có permission, STAFF không có permission, CUSTOMER.
  - Test `setPermissions` gán/thu hồi.
  - Test cascade: đổi role STAFF→CUSTOMER xóa hết permissions.
  - Test edge case: STAFF không có permission nào → chỉ thấy dashboard trống.

### 12.2. Cập nhật tests hiện tại

- `tests/order-transitions.test.ts`: Thêm case STAFF operator chuyển trạng thái.
- `tests/webhook-idempotency.test.ts`: Không ảnh hưởng (webhook không qua guard).

---

## 13. Migration path

1. Thêm bảng `StaffPermission` qua `prisma migrate dev`.
2. Tạo `permission.service.ts` và `guards.ts`.
3. Cập nhật `auth-options.ts` (JWT callback).
4. Cập nhật `admin/layout.tsx` (mở gate cho STAFF).
5. Sửa từng controller theo ma trận (Section 5).
6. Sửa `AdminSidebar.tsx` (lọc menu).
7. Tạo Staff Dashboard endpoint + UI.
8. Mở rộng `AdminCustomersView` (permission assignment UI).
9. Viết tests.
10. Cập nhật seed script cho demo data.

---

## 14. Ngoài phạm vi (Out of scope)

- Audit log (ghi lại ai làm gì) — tính năng riêng.
- Kênh Pusher `private-staff-channel` — cần brainstorm riêng.
- Permission `coupons` cho STAFF — ý chủ shop quyết định.
- Phân quyền chi tiết hơn (read-only vs read-write trong 1 permission) — YAGNI.
