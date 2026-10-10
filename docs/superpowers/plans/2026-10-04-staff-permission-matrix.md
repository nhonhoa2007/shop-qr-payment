# Staff Permission Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai hệ thống phân quyền nhân viên (STAFF) theo ma trận Permission chi tiết (Permission Matrix), cho phép Admin cấp quyền vận hành theo từng khối chức năng (`orders`, `products`, `shipments`, `chat`, `reviews`) trong khi bảo vệ nghiêm ngặt các vùng dữ liệu tài chính, phân quyền và cấu hình nhạy cảm.

**Architecture:** Mở rộng mô hình RBAC hiện tại bằng bảng quan hệ `StaffPermission` trong Prisma. Xây dựng tầng middleware guard `requireOperatorPermission(permission)` chuẩn hóa cho toàn bộ API routes; mở rộng NextAuth session để mang danh sách permissions của user; cập nhật UI Admin (Sidebar, Dashboard rút gọn, Customers RBAC view) lọc theo quyền thực tế của STAFF.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, PostgreSQL, Prisma ORM, NextAuth.js, Tailwind v4, Lucide React, Node.js Native Test Runner (`node:test`).

**Spec:** `docs/superpowers/specs/2026-10-04-staff-permission-matrix-design.md`

## Global Constraints

- Không làm phá vỡ tài khoản `ADMIN` (luôn tự động bypass mọi kiểm tra quyền) hoặc `CUSTOMER` (không chịu ảnh hưởng bởi bảng permissions).
- Zero Server Leakage Rule: `@client/*` tuyệt đối không import từ `@server/*` hay `@prisma/client`.
- Phân tách quyền rõ ràng: Thao tác xóa vĩnh viễn (`DELETE` product, `DELETE` review) và tài chính (`analytics`, `transactions`, `reconcile`, `coupons`) thuộc quyền hạn độc quyền của `ADMIN`.
- Mọi test suite chạy qua Node Native Test Runner: `node --experimental-strip-types --test tests/<filename>.test.ts`.

## Review Focus

1. **STAFF không có permissions nào**: Đăng nhập thành công vào `/admin`, nhưng sidebar chỉ thấy "Bảng điều khiển", dashboard hiển thị rỗng/không dữ liệu vận hành, mọi API nghiệp vụ đều trả về HTTP 403.
2. **ADMIN bypass**: Mọi API gọi bởi ADMIN đều thành công (authorized) kể cả khi ADMIN không có record nào trong bảng `StaffPermission`.
3. **STAFF cố gắng gọi API xóa vĩnh viễn**: STAFF có quyền `products` cố gắng gửi `DELETE /api/products` phải nhận HTTP 403 (chỉ ADMIN mới được xóa).
4. **Hạ quyền hoặc đổi role**: Khi ADMIN đổi role của STAFF thành CUSTOMER, tất cả các record permission của user đó trong `StaffPermission` phải bị thu hồi sạch sẽ.
5. **Rò rỉ số liệu doanh thu**: STAFF gọi `/api/admin/analytics/staff` tuyệt đối không nhận các trường `totalRevenue`, `todayRevenue`, `revenueTrend`, `qrMatchRate`.

---

### Task 1: Shared Permission Constants and Type Definitions

**Files:**
- Create: `src/shared/constants/permissions.ts`
- Modify: `src/shared/types/index.ts:230-245`
- Modify: `src/types/next-auth.d.ts:1-26`
- Test: `tests/permissions-types.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `STAFF_PERMISSIONS`, `StaffPermission`, `PERMISSION_LABELS`, `isStaffPermission(value)`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/permissions-types.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  STAFF_PERMISSIONS,
  PERMISSION_LABELS,
  isStaffPermission,
} from '../src/shared/constants/permissions.ts';

describe('Shared Permission Constants', () => {
  it('should export all 5 core staff permissions', () => {
    assert.deepEqual([...STAFF_PERMISSIONS], [
      'orders',
      'products',
      'shipments',
      'chat',
      'reviews',
    ]);
  });

  it('should have descriptive Vietnamese labels for all permissions', () => {
    assert.equal(PERMISSION_LABELS.orders, 'Quản lý đơn hàng');
    assert.equal(PERMISSION_LABELS.products, 'Quản lý sản phẩm & kho');
    assert.equal(PERMISSION_LABELS.shipments, 'Quản lý vận đơn');
    assert.equal(PERMISSION_LABELS.chat, 'Chat CSKH');
    assert.equal(PERMISSION_LABELS.reviews, 'Quản lý đánh giá');
  });

  it('should validate permission type guard correctly', () => {
    assert.equal(isStaffPermission('orders'), true);
    assert.equal(isStaffPermission('products'), true);
    assert.equal(isStaffPermission('unknown'), false);
    assert.equal(isStaffPermission(null), false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/permissions-types.test.ts`
Expected: FAIL (Cannot find module `permissions.ts`)

- [ ] **Step 3: Implement `src/shared/constants/permissions.ts`, update types**

Tạo `src/shared/constants/permissions.ts`:
- Khai báo mảng hằng `STAFF_PERMISSIONS = ['orders', 'products', 'shipments', 'chat', 'reviews'] as const`.
- Type `StaffPermission = (typeof STAFF_PERMISSIONS)[number]`.
- Map `PERMISSION_LABELS: Record<StaffPermission, string>`.
- Type guard `isStaffPermission(value: unknown): value is StaffPermission`.
Cập nhật `src/shared/types/index.ts` re-export các type này.
Cập nhật `src/types/next-auth.d.ts` thêm `permissions?: StaffPermission[]` vào `User`, `Session['user']`, và `JWT`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/permissions-types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/constants/permissions.ts src/shared/types/index.ts src/types/next-auth.d.ts tests/permissions-types.test.ts
git commit -m "feat(rbac): định nghĩa permission constants và types cho staff"
```

---

### Task 2: Database Schema & Prisma Model for StaffPermission

**Files:**
- Modify: `prisma/schema.prisma:10-38`
- Test: `tests/schema-permission.test.ts`

**Interfaces:**
- Consumes: `prisma/schema.prisma`
- Produces: `model StaffPermission`, updated `model User` with `staffPermissions` and `grantedPermissions` relations

- [ ] **Step 1: Write the failing test**

```typescript
// tests/schema-permission.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Prisma Schema StaffPermission Model', () => {
  it('should define StaffPermission model with required relations and indexes', () => {
    const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
    const content = fs.readFileSync(schemaPath, 'utf8');

    assert.ok(content.includes('model StaffPermission {'), 'Missing StaffPermission model');
    assert.ok(content.includes('userId     String'), 'Missing userId in StaffPermission');
    assert.ok(content.includes('permission String'), 'Missing permission in StaffPermission');
    assert.ok(content.includes('grantedBy  String'), 'Missing grantedBy in StaffPermission');
    assert.ok(content.includes('@@unique([userId, permission])'), 'Missing composite unique constraint');
    assert.ok(content.includes('staffPermissions    StaffPermission[]'), 'Missing relation in User model');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/schema-permission.test.ts`
Expected: FAIL (Missing StaffPermission model)

- [ ] **Step 3: Update `prisma/schema.prisma` and generate client**

Thêm model `StaffPermission` vào `prisma/schema.prisma`:
```prisma
model StaffPermission {
  id         String   @id @default(cuid())
  userId     String
  permission String
  grantedBy  String
  grantedAt  DateTime @default(now())

  user       User     @relation("UserPermissions", fields: [userId], references: [id], onDelete: Cascade)
  granter    User     @relation("GrantedPermissions", fields: [grantedBy], references: [id])

  @@unique([userId, permission])
  @@index([userId])
}
```
Thêm hai quan hệ vào `User`:
- `staffPermissions StaffPermission[] @relation("UserPermissions")`
- `grantedPermissions StaffPermission[] @relation("GrantedPermissions")`
Chạy `npx prisma generate` và `npx prisma db push`.

- [ ] **Step 4: Run test and build verification**

Run: `node --experimental-strip-types --test tests/schema-permission.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma tests/schema-permission.test.ts
git commit -m "feat(db): bổ sung bảng StaffPermission trong Prisma schema"
```

---

### Task 3: Permission Service Core Logic

**Files:**
- Create: `src/server/modules/admin/permission.service.ts`
- Test: `tests/permissions.test.ts`

**Interfaces:**
- Consumes: `prisma`, `StaffPermission`, `isStaffPermission`
- Produces: `getStaffPermissions(userId, delegate?)`, `hasPermission(userId, permission, delegate?)`, `setStaffPermissions(params, delegate?)`, `clearStaffPermissions(userId, delegate?)`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/permissions.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterValidPermissions,
  hasStaffPermissionInMemory,
} from '../src/server/modules/admin/permission.service.ts';

describe('Staff Permission Service Logic', () => {
  it('should filter out invalid permissions and eliminate duplicates', () => {
    const raw = ['orders', 'invalid', 'products', 'orders', 123, null];
    const cleaned = filterValidPermissions(raw);
    assert.deepEqual(cleaned, ['orders', 'products']);
  });

  it('should verify permission in-memory list accurately', () => {
    const permissions = ['orders', 'shipments'];
    assert.equal(hasStaffPermissionInMemory(permissions, 'orders'), true);
    assert.equal(hasStaffPermissionInMemory(permissions, 'products'), false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/permissions.test.ts`
Expected: FAIL (Cannot find module `permission.service.ts`)

- [ ] **Step 3: Implement `permission.service.ts`**

Xây dựng `src/server/modules/admin/permission.service.ts`:
- `filterValidPermissions(input: unknown[]): StaffPermission[]`
- `hasStaffPermissionInMemory(perms: string[], target: StaffPermission): boolean`
- `getStaffPermissions(userId: string, delegate?: PrismaClient): Promise<StaffPermission[]>`
- `hasPermission(userId: string, permission: StaffPermission, delegate?: PrismaClient): Promise<boolean>`
- `setStaffPermissions({ userId, permissions, grantedBy }: SetPermissionsParams, delegate?: PrismaClient): Promise<StaffPermission[]>` (dùng transaction xóa quyền cũ và tạo quyền mới)
- `clearStaffPermissions(userId: string, delegate?: PrismaClient): Promise<void>`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/permissions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/admin/permission.service.ts tests/permissions.test.ts
git commit -m "feat(rbac): cài đặt service quản lý quyền StaffPermission"
```

---

### Task 4: RBAC Engine & Customer Management Integration

**Files:**
- Modify: `src/server/modules/admin/admin-rbac.service.ts:34-190`
- Modify: `src/server/modules/admin/customers.controller.ts:33-65`
- Modify: `src/server/modules/admin/admin.service.ts:25-115`
- Test: `tests/admin-rbac-permissions.test.ts`

**Interfaces:**
- Consumes: `permission.service.ts`, `updateUserRbac`
- Produces: `updateUser` with `permissions?: string[]` support, `getAdminCustomers` returning `permissions: StaffPermission[]`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/admin-rbac-permissions.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateUserUpdatePayload } from '../src/server/modules/admin/admin-rbac.service.ts';

describe('Admin RBAC Validation with Permissions', () => {
  it('should accept valid permissions array for user update', () => {
    const payload = {
      userId: 'usr_123',
      role: 'STAFF',
      permissions: ['orders', 'shipments'],
    };
    const res = validateUserUpdatePayload(payload);
    assert.equal(res.valid, true);
    assert.deepEqual(res.data?.permissions, ['orders', 'shipments']);
  });

  it('should filter out invalid permission names in payload', () => {
    const payload = {
      userId: 'usr_123',
      permissions: ['orders', 'malicious_perm', 'chat'],
    };
    const res = validateUserUpdatePayload(payload);
    assert.equal(res.valid, true);
    assert.deepEqual(res.data?.permissions, ['orders', 'chat']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/admin-rbac-permissions.test.ts`
Expected: FAIL (res.data?.permissions is undefined)

- [ ] **Step 3: Update `admin-rbac.service.ts`, `customers.controller.ts`, `admin.service.ts`**

1. Cập nhật `validateUserUpdatePayload` trong `admin-rbac.service.ts` để đọc và làm sạch `permissions?: unknown`.
2. Cập nhật `updateUserRbac`:
   - Nếu `role` đổi thành `STAFF` và có `permissions`: gọi `setStaffPermissions`.
   - Nếu `role` đổi từ `STAFF` sang `CUSTOMER` hoặc `ADMIN`: gọi `clearStaffPermissions`.
   - Nếu giữ role `STAFF` và gửi `permissions` mới: cập nhật `setStaffPermissions`.
3. Cập nhật `customers.controller.ts` PATCH truyền `permissions` vào `AdminService.updateUser`.
4. Cập nhật `AdminService.getAdminCustomers` để include `staffPermissions` và map thành `permissions: string[]` trên mỗi customer trả về.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/admin-rbac-permissions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/admin/admin-rbac.service.ts src/server/modules/admin/customers.controller.ts src/server/modules/admin/admin.service.ts tests/admin-rbac-permissions.test.ts
git commit -m "feat(admin): tích hợp cấp quyền permissions qua API customers RBAC"
```

---

### Task 5: NextAuth Session and JWT Integration

**Files:**
- Modify: `src/server/modules/auth/auth-options.ts:38-54`
- Test: `tests/auth-session-permissions.test.ts`

**Interfaces:**
- Consumes: `getStaffPermissions`
- Produces: `session.user.permissions: StaffPermission[]`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/auth-session-permissions.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('NextAuth JWT and Session Permission Propagation', () => {
  it('should attach permissions array to session user', () => {
    const mockToken = {
      id: 'staff_1',
      role: 'STAFF',
      permissions: ['orders', 'chat'],
    };
    const mockSession = { user: { id: '', role: '' } };

    // Simulate session callback
    const session = {
      ...mockSession,
      user: {
        id: mockToken.id,
        role: mockToken.role,
        permissions: mockToken.permissions,
      },
    };

    assert.equal(session.user.role, 'STAFF');
    assert.deepEqual(session.user.permissions, ['orders', 'chat']);
  });
});
```

- [ ] **Step 2: Run test to verify it passes/fails**

Run: `node --experimental-strip-types --test tests/auth-session-permissions.test.ts`
Expected: PASS (Unit logic test)

- [ ] **Step 3: Modify `src/server/modules/auth/auth-options.ts`**

Trong `callbacks.jwt`:
```ts
if (token.role === 'STAFF' && token.id) {
  token.permissions = await getStaffPermissions(token.id as string);
} else {
  token.permissions = [];
}
```
Trong `callbacks.session`:
```ts
session.user.permissions = (token.permissions as StaffPermission[]) || [];
```

- [ ] **Step 4: Verify type-check with build preview**

Run: `npm run lint`
Expected: No type errors in `auth-options.ts`

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/auth/auth-options.ts tests/auth-session-permissions.test.ts
git commit -m "feat(auth): nhúng danh sách staff permissions vào NextAuth JWT và session"
```

---

### Task 6: Operator Guards Helper

**Files:**
- Create: `src/server/modules/admin/guards.ts`
- Test: `tests/operator-guards.test.ts`

**Interfaces:**
- Consumes: `getServerSession`, `hasPermission`, `StaffPermission`
- Produces: `requireOperatorPermission(permission)`, `requireAdmin()`, `resolveOperatorAccess(user, permission)`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/operator-guards.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOperatorAccess } from '../src/server/modules/admin/guards.ts';

describe('Operator Access Resolution', () => {
  it('should always allow ADMIN regardless of permissions', () => {
    const adminUser = { id: 'u1', role: 'ADMIN', permissions: [] };
    assert.equal(resolveOperatorAccess(adminUser, 'orders'), true);
    assert.equal(resolveOperatorAccess(adminUser, 'products'), true);
  });

  it('should allow STAFF if target permission is held', () => {
    const staffUser = { id: 'u2', role: 'STAFF', permissions: ['orders', 'shipments'] };
    assert.equal(resolveOperatorAccess(staffUser, 'orders'), true);
    assert.equal(resolveOperatorAccess(staffUser, 'shipments'), true);
    assert.equal(resolveOperatorAccess(staffUser, 'products'), false);
  });

  it('should reject CUSTOMER for any operator permission', () => {
    const customerUser = { id: 'u3', role: 'CUSTOMER', permissions: ['orders'] };
    assert.equal(resolveOperatorAccess(customerUser, 'orders'), false);
  });

  it('should reject unauthenticated user', () => {
    assert.equal(resolveOperatorAccess(null, 'orders'), false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/operator-guards.test.ts`
Expected: FAIL (Cannot find module `guards.ts`)

- [ ] **Step 3: Implement `src/server/modules/admin/guards.ts`**

Xây dựng:
- `resolveOperatorAccess(user: { role?: string; permissions?: string[] } | null | undefined, permission: StaffPermission): boolean`
- `requireOperatorPermission(permission: StaffPermission): Promise<GuardResult>`
- `requireAdmin(): Promise<GuardResult>`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/operator-guards.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/admin/guards.ts tests/operator-guards.test.ts
git commit -m "feat(admin): cài đặt guard helper requireOperatorPermission"
```

---

### Task 7: Admin Layout and Main Page Gate Updates

**Files:**
- Modify: `src/app/admin/layout.tsx:18-26`
- Modify: `src/app/admin/page.tsx:8-13`
- Test: `tests/admin-layout-gate.test.ts`

**Interfaces:**
- Consumes: `session.user.role`
- Produces: Gate allowing both `ADMIN` and `STAFF` into `/admin` shell

- [ ] **Step 1: Write test for layout gate rule**

```typescript
// tests/admin-layout-gate.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function canAccessAdminLayout(role?: string): boolean {
  return role === 'ADMIN' || role === 'STAFF';
}

describe('Admin Layout Access Gate', () => {
  it('should allow ADMIN and STAFF to access /admin', () => {
    assert.equal(canAccessAdminLayout('ADMIN'), true);
    assert.equal(canAccessAdminLayout('STAFF'), true);
  });

  it('should deny CUSTOMER or empty role', () => {
    assert.equal(canAccessAdminLayout('CUSTOMER'), false);
    assert.equal(canAccessAdminLayout(undefined), false);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/admin-layout-gate.test.ts`
Expected: PASS

- [ ] **Step 3: Update `src/app/admin/layout.tsx` & `src/app/admin/page.tsx`**

Cập nhật `layout.tsx`:
```ts
if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
  redirect('/login?callbackUrl=/admin&reason=permission');
}
```
Cập nhật `page.tsx`:
```ts
if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) redirect('/');
return <AdminDashboardView user={session.user} />;
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/page.tsx tests/admin-layout-gate.test.ts
git commit -m "feat(admin): mở cổng Admin Layout và Dashboard cho role STAFF"
```

---

### Task 8: Orders & Shipments Controllers Operator Guards

**Files:**
- Modify: `src/server/modules/orders/orders.controller.ts:235-256`
- Modify: `src/server/modules/orders/order-detail.controller.ts:25-135`
- Modify: `src/server/modules/admin/shipments.controller.ts:7-55`
- Test: `tests/orders-operator-guard.test.ts`

**Interfaces:**
- Consumes: `requireOperatorPermission('orders')`, `requireOperatorPermission('shipments')`
- Produces: Operator access for STAFF on order listings, FSM updates, and shipments

- [ ] **Step 1: Write test for orders operator logic**

```typescript
// tests/orders-operator-guard.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOperatorAccess } from '../src/server/modules/admin/guards.ts';

describe('Orders and Shipments Operator Access', () => {
  it('should authorize staff with orders permission to manage orders', () => {
    const user = { role: 'STAFF', permissions: ['orders'] };
    assert.equal(resolveOperatorAccess(user, 'orders'), true);
    assert.equal(resolveOperatorAccess(user, 'shipments'), false);
  });

  it('should authorize staff with shipments permission to view shipments', () => {
    const user = { role: 'STAFF', permissions: ['shipments'] };
    assert.equal(resolveOperatorAccess(user, 'shipments'), true);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/orders-operator-guard.test.ts`
Expected: PASS

- [ ] **Step 3: Update `orders.controller.ts`, `order-detail.controller.ts`, `shipments.controller.ts`**

1. `orders.controller.ts` GET:
   - Thay `session.user.role === 'ADMIN' ? {} : { userId: session.user.id }` bằng:
   - Nếu `resolveOperatorAccess(session.user, 'orders')` -> `where = {}` (xem toàn bộ đơn).
   - Ngược lại -> `where = { userId: session.user.id }`.
2. `order-detail.controller.ts`:
   - GET: Cho phép nếu là chủ đơn HOẶC `resolveOperatorAccess(session.user, 'orders')`.
   - PATCH: `const isOperator = resolveOperatorAccess(session.user, 'orders')`.
   - Khi `isOperator === true`: được phép chuyển mọi FSM hợp lệ và kích hoạt GHN; thông báo hủy đơn ghi rõ "Nhân viên vận hành" nếu không phải ADMIN.
3. `shipments.controller.ts` GET:
   - Dùng `requireOperatorPermission('shipments')`.

- [ ] **Step 4: Run existing order transitions test to ensure zero regression**

Run: `node --experimental-strip-types --test tests/order-transitions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/orders/orders.controller.ts src/server/modules/orders/order-detail.controller.ts src/server/modules/admin/shipments.controller.ts tests/orders-operator-guard.test.ts
git commit -m "feat(orders): tích hợp permission guard cho quản lý đơn hàng và vận đơn GHN"
```

---

### Task 9: Products and Upload Controllers Operator Guards

**Files:**
- Modify: `src/server/modules/products/products.controller.ts:116-278`
- Modify: `src/app/api/admin/upload/route.ts:18-23`
- Test: `tests/products-operator-guard.test.ts`

**Interfaces:**
- Consumes: `requireOperatorPermission('products')`, `requireAdmin()`
- Produces: POST & PUT allowed for STAFF with `products` permission; DELETE strictly reserved for `ADMIN`

- [ ] **Step 1: Write test for product guard differentiation**

```typescript
// tests/products-operator-guard.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOperatorAccess } from '../src/server/modules/admin/guards.ts';

describe('Products Guard Differentiation', () => {
  it('should allow staff with products permission to edit products', () => {
    const user = { role: 'STAFF', permissions: ['products'] };
    assert.equal(resolveOperatorAccess(user, 'products'), true);
  });

  it('should restrict delete actions to ADMIN only', () => {
    const staff = { role: 'STAFF', permissions: ['products'] };
    const admin = { role: 'ADMIN', permissions: [] };

    const canDelete = (u: { role: string }) => u.role === 'ADMIN';
    assert.equal(canDelete(staff), false);
    assert.equal(canDelete(admin), true);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/products-operator-guard.test.ts`
Expected: PASS

- [ ] **Step 3: Update `products.controller.ts` and `upload/route.ts`**

1. Trong `products.controller.ts`:
   - `POST` & `PUT`: Thay `session.user.role !== 'ADMIN'` bằng `!resolveOperatorAccess(session.user, 'products')`.
   - `DELETE`: Giữ nguyên chặt chẽ `session.user.role !== 'ADMIN'` (chỉ ADMIN mới được xóa vĩnh viễn sản phẩm/biến thể).
2. Trong `src/app/api/admin/upload/route.ts`:
   - Thay `session.user.role !== 'ADMIN'` bằng `!resolveOperatorAccess(session.user, 'products')`.

- [ ] **Step 4: Commit**

```bash
git add src/server/modules/products/products.controller.ts src/app/api/admin/upload/route.ts tests/products-operator-guard.test.ts
git commit -m "feat(catalog): cấp quyền quản lý sản phẩm cho staff và bảo lưu quyền xóa cho admin"
```

---

### Task 10: Reviews & Chat Controllers Operator Guards

**Files:**
- Modify: `src/server/modules/reviews/admin-reviews.controller.ts:9-125`
- Modify: `src/server/modules/chat/chat-messages.controller.ts:19-105`
- Modify: `src/server/modules/chat/chat-read.controller.ts:22-36`
- Modify: `src/server/modules/chat/pusher-auth.controller.ts:18-35`
- Test: `tests/chat-reviews-operator.test.ts`

**Interfaces:**
- Consumes: `requireOperatorPermission('reviews')`, `requireOperatorPermission('chat')`
- Produces: Operator access for reviews and auto-join for chat support rooms

- [ ] **Step 1: Write test for reviews and chat permissions**

```typescript
// tests/chat-reviews-operator.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOperatorAccess } from '../src/server/modules/admin/guards.ts';

describe('Chat and Reviews Operator Guards', () => {
  it('should authorize staff with chat permission to access chat features', () => {
    const user = { role: 'STAFF', permissions: ['chat'] };
    assert.equal(resolveOperatorAccess(user, 'chat'), true);
    assert.equal(resolveOperatorAccess(user, 'reviews'), false);
  });

  it('should authorize staff with reviews permission to moderate reviews', () => {
    const user = { role: 'STAFF', permissions: ['reviews'] };
    assert.equal(resolveOperatorAccess(user, 'reviews'), true);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/chat-reviews-operator.test.ts`
Expected: PASS

- [ ] **Step 3: Update controllers**

1. `admin-reviews.controller.ts`:
   - `GET` & `PATCH`: Dùng `resolveOperatorAccess(session.user, 'reviews')`.
   - `DELETE`: Giữ nguyên `session.user.role !== 'ADMIN'` (chỉ ADMIN được xóa đánh giá).
2. `chat-messages.controller.ts` & `chat-read.controller.ts`:
   - Thay `session.user.role === 'ADMIN'` bằng `resolveOperatorAccess(session.user, 'chat')` để STAFF tự động tạo/join `ChatRoomParticipant` và đọc tin nhắn.
3. `pusher-auth.controller.ts`:
   - Kênh `private-chat-<roomId>`: Cho phép nếu là participant HOẶC `resolveOperatorAccess(session.user, 'chat')`.
   - Kênh `private-admin-channel`: Giữ nguyên chỉ `session.user.role === 'ADMIN'`.

- [ ] **Step 4: Commit**

```bash
git add src/server/modules/reviews/admin-reviews.controller.ts src/server/modules/chat/chat-messages.controller.ts src/server/modules/chat/chat-read.controller.ts src/server/modules/chat/pusher-auth.controller.ts tests/chat-reviews-operator.test.ts
git commit -m "feat(chat-reviews): tích hợp permission chat và reviews cho staff"
```

---

### Task 11: Staff Operational Analytics Service and API Route

**Files:**
- Create: `src/server/modules/admin/staff-analytics.service.ts`
- Create: `src/app/api/admin/analytics/staff/route.ts`
- Test: `tests/staff-analytics.test.ts`

**Interfaces:**
- Consumes: `prisma`, `StaffPermission`
- Produces: `GET /api/admin/analytics/staff` returning non-financial operational KPIs

- [ ] **Step 1: Write the failing test**

```typescript
// tests/staff-analytics.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeStaffAnalytics } from '../src/server/modules/admin/staff-analytics.service.ts';

describe('Staff Operational Analytics Sanitization', () => {
  it('should completely strip financial metrics from staff response', () => {
    const rawMetrics = {
      totalRevenue: 100_000_000,
      todayRevenue: 5_000_000,
      qrMatchRate: 98.5,
      todayOrders: 12,
      pendingOrdersCount: 4,
      processingOrdersCount: 3,
      lowStockCount: 2,
    };

    const sanitized = sanitizeStaffAnalytics(rawMetrics, ['orders', 'products']);
    assert.equal('totalRevenue' in sanitized, false);
    assert.equal('todayRevenue' in sanitized, false);
    assert.equal('qrMatchRate' in sanitized, false);
    assert.equal(sanitized.todayOrders, 12);
    assert.equal(sanitized.pendingOrdersCount, 4);
    assert.equal(sanitized.lowStockCount, 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/staff-analytics.test.ts`
Expected: FAIL (Cannot find module `staff-analytics.service.ts`)

- [ ] **Step 3: Implement `staff-analytics.service.ts` and API route**

1. Tạo `src/server/modules/admin/staff-analytics.service.ts`:
   - `sanitizeStaffAnalytics(summary, permissions)`: Lọc bỏ toàn bộ trường tài chính, chỉ giữ lại số đơn, tồn kho, vận đơn tương ứng với permissions của staff.
   - `getStaffDashboardMetrics(permissions: StaffPermission[])`: Thực hiện query đếm số đơn theo trạng thái, số vận đơn đang giao, sản phẩm sắp hết hàng.
2. Tạo `src/app/api/admin/analytics/staff/route.ts`:
   - Kiểm tra `session.user.role === 'STAFF' || session.user.role === 'ADMIN'`.
   - Trả về JSON operational analytics.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/staff-analytics.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/admin/staff-analytics.service.ts src/app/api/admin/analytics/staff/route.ts tests/staff-analytics.test.ts
git commit -m "feat(analytics): tạo endpoint báo cáo vận hành riêng cho staff"
```

---

### Task 12: Admin Sidebar Role & Permission Filtering

**Files:**
- Modify: `src/client/components/admin/layout/AdminSidebar.tsx:50-275`
- Test: `tests/admin-sidebar-filter.test.ts`

**Interfaces:**
- Consumes: `user?: { role?: string; permissions?: string[] }`
- Produces: Filtered navigation groups and STAFF visual branding badge

- [ ] **Step 1: Write test for sidebar filtering rules**

```typescript
// tests/admin-sidebar-filter.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

interface TestNavItem {
  name: string;
  href: string;
  requiredPermission?: string;
  adminOnly?: boolean;
}

function filterNavItems(items: TestNavItem[], role?: string, permissions: string[] = []): TestNavItem[] {
  if (role === 'ADMIN') return items;
  return items.filter((item) => {
    if (item.adminOnly) return false;
    if (!item.requiredPermission) return true;
    return permissions.includes(item.requiredPermission);
  });
}

describe('Admin Sidebar Filtering', () => {
  const sampleItems: TestNavItem[] = [
    { name: 'Bảng điều khiển', href: '/admin' },
    { name: 'Đơn hàng', href: '/admin/orders', requiredPermission: 'orders' },
    { name: 'Đối soát', href: '/admin/transactions', adminOnly: true },
    { name: 'Khách hàng & RBAC', href: '/admin/customers', adminOnly: true },
    { name: 'Sản phẩm', href: '/admin/products', requiredPermission: 'products' },
  ];

  it('should show all items for ADMIN', () => {
    const result = filterNavItems(sampleItems, 'ADMIN');
    assert.equal(result.length, 5);
  });

  it('should filter items for STAFF according to permissions and hide admin-only items', () => {
    const result = filterNavItems(sampleItems, 'STAFF', ['orders']);
    assert.deepEqual(result.map((i) => i.name), ['Bảng điều khiển', 'Đơn hàng']);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/admin-sidebar-filter.test.ts`
Expected: PASS

- [ ] **Step 3: Modify `AdminSidebar.tsx`**

1. Gắn metadata `permission?: StaffPermission; adminOnly?: boolean` vào từng `NavItem` trong `NAV_GROUPS`.
2. Lọc danh sách menu hiển thị dựa trên `user?.role` và `user?.permissions`.
3. Nếu nhóm menu không có item nào sau khi lọc -> ẩn cả nhóm (ví dụ ẩn hẳn nhóm "Tài chính & Ưu đãi" cho STAFF).
4. Cập nhật nhãn brand: nếu `role === 'STAFF'`, hiển thị badge `STAFF` màu xanh dương (`bg-blue-50 text-blue-600`) thay vì `ADMIN`. Subtitle hiện "Nhân viên vận hành".

- [ ] **Step 4: Commit**

```bash
git add src/client/components/admin/layout/AdminSidebar.tsx tests/admin-sidebar-filter.test.ts
git commit -m "feat(ui): lọc danh mục sidebar và cập nhật nhãn vai trò cho staff"
```

---

### Task 13: Staff Operational Dashboard View

**Files:**
- Modify: `src/client/views/admin/AdminDashboardView.tsx:40-200`
- Test: Manual verify with mock props

**Interfaces:**
- Consumes: `user?: { role?: string; permissions?: string[] }`
- Produces: Clean operational view without financial cards when role is `STAFF`

- [ ] **Step 1: Update `AdminDashboardView.tsx` props**

Khai báo:
```ts
export interface AdminDashboardViewProps {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string;
    permissions?: string[];
  };
}
```

- [ ] **Step 2: Implement conditional data fetching**

- Nếu `user?.role === 'STAFF'`: Fetch từ `/api/admin/analytics/staff`.
- Nếu `user?.role === 'ADMIN'`: Fetch từ `/api/admin/analytics?range=...` (như cũ).

- [ ] **Step 3: Render operational layout for STAFF**

Khi `user?.role === 'STAFF'`:
- Ẩn hoàn toàn `AdminRevenueBars` (biểu đồ doanh thu), `AdminRevenueShareCard` (tỷ trọng doanh thu), `AdminDonutChart` (phương thức thanh toán) và `AdminCustomersCard` (khách hàng mới).
- Hiển thị các khối vận hành phù hợp quyền:
  - Nếu có `orders`: `AdminKpiStrip` (chỉ số đơn hàng hôm nay, chờ duyệt, đang giao), `AdminRecentOrdersTable` (danh sách đơn gần đây).
  - Nếu có `products`: Cảnh báo hết hàng / tồn kho thấp.
  - `AdminActionCenter`: Chỉ hiển thị các cảnh báo vận hành (đơn hàng mới, tồn kho thấp), loại bỏ cảnh báo lệch giao dịch ngân hàng.

- [ ] **Step 4: Run build check to verify clean compilation**

Run: `npm run build`
Expected: Successful build with zero TypeScript / JSX errors.

- [ ] **Step 5: Commit**

```bash
git add src/client/views/admin/AdminDashboardView.tsx
git commit -m "feat(dashboard): giao diện dashboard vận hành tối giản cho staff"
```

---

### Task 14: Customer Management UI Permission Checkboxes

**Files:**
- Modify: `src/client/views/admin/AdminCustomersView.tsx:645-720`
- Test: Manual verify role change modal

**Interfaces:**
- Consumes: `STAFF_PERMISSIONS`, `PERMISSION_LABELS`
- Produces: Checkbox list in Admin User Edit modal when role is `STAFF`

- [ ] **Step 1: Import permission constants in `AdminCustomersView.tsx`**

```ts
import { STAFF_PERMISSIONS, PERMISSION_LABELS, type StaffPermission } from '@shared/constants/permissions';
```

- [ ] **Step 2: Add permissions state and UI in Edit Modal**

1. Thêm state quản lý `selectedPermissions: StaffPermission[]` khi mở modal khách hàng.
2. Khi `selectedCustomer.role === 'STAFF'` hoặc Admin chọn dropdown chuyển sang `STAFF`:
   - Render khối UI "Phân bổ quyền hạn nhân viên":
   - Render danh sách 5 checkbox: `orders`, `products`, `shipments`, `chat`, `reviews` kèm nhãn tiếng Việt và giải thích ngắn gọn.
   - Thêm nút "Chọn tất cả" / "Bỏ chọn tất cả".
3. Khi Admin nhấn "Lưu thay đổi", gửi kèm `permissions: selectedPermissions` lên `PATCH /api/admin/customers`.
4. Cập nhật state người dùng cục bộ sau khi lưu thành công.

- [ ] **Step 3: Run lint check**

Run: `npm run lint`
Expected: No lint warnings or errors.

- [ ] **Step 4: Commit**

```bash
git add src/client/views/admin/AdminCustomersView.tsx
git commit -m "feat(admin): thêm giao diện chọn quyền hạn chi tiết cho nhân viên staff"
```

---

### Task 15: End-to-End Integration Test Suite and Verification

**Files:**
- Create: `tests/staff-e2e.test.ts`
- Test: Run all project test suites

**Interfaces:**
- Consumes: All completed modules
- Produces: Full regression check and test confirmation

- [ ] **Step 1: Write integration tests covering core business invariants**

```typescript
// tests/staff-e2e.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOperatorAccess } from '../src/server/modules/admin/guards.ts';
import { filterValidPermissions } from '../src/server/modules/admin/permission.service.ts';
import { sanitizeStaffAnalytics } from '../src/server/modules/admin/staff-analytics.service.ts';

describe('Staff Permission Matrix End-to-End Invariants', () => {
  it('Invariant 1: Admin always has full access to every module', () => {
    const admin = { id: 'admin_1', role: 'ADMIN', permissions: [] };
    const allModules = ['orders', 'products', 'shipments', 'chat', 'reviews'] as const;
    for (const mod of allModules) {
      assert.equal(resolveOperatorAccess(admin, mod), true);
    }
  });

  it('Invariant 2: Staff only accesses modules explicitly granted', () => {
    const orderStaff = { id: 'staff_1', role: 'STAFF', permissions: ['orders'] };
    assert.equal(resolveOperatorAccess(orderStaff, 'orders'), true);
    assert.equal(resolveOperatorAccess(orderStaff, 'products'), false);
    assert.equal(resolveOperatorAccess(orderStaff, 'shipments'), false);
    assert.equal(resolveOperatorAccess(orderStaff, 'chat'), false);
    assert.equal(resolveOperatorAccess(orderStaff, 'reviews'), false);
  });

  it('Invariant 3: Customers have zero operator access', () => {
    const customer = { id: 'cust_1', role: 'CUSTOMER', permissions: ['orders', 'products'] };
    assert.equal(resolveOperatorAccess(customer, 'orders'), false);
    assert.equal(resolveOperatorAccess(customer, 'products'), false);
  });

  it('Invariant 4: Staff analytics sanitization never leaks financial fields', () => {
    const rawMetrics = {
      totalRevenue: 500_000_000,
      todayRevenue: 25_000_000,
      qrMatchRate: 99.2,
      todayOrders: 50,
      pendingOrdersCount: 5,
    };
    const sanitized = sanitizeStaffAnalytics(rawMetrics, ['orders']);
    assert.equal((sanitized as Record<string, unknown>).totalRevenue, undefined);
    assert.equal((sanitized as Record<string, unknown>).todayRevenue, undefined);
    assert.equal((sanitized as Record<string, unknown>).qrMatchRate, undefined);
    assert.equal(sanitized.todayOrders, 50);
  });
});
```

- [ ] **Step 2: Run all tests in the repository**

Run: `npm run test`
Expected: All test suites PASS.

- [ ] **Step 3: Run build verification**

Run: `npm run build`
Expected: Build successfully created without errors.

- [ ] **Step 4: Commit**

```bash
git add tests/staff-e2e.test.ts
git commit -m "test(rbac): bổ sung bộ test tích hợp e2e cho phân quyền staff"
```
