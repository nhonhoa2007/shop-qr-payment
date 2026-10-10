# Telegram Order Notification & GHN 1-Touch Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng tính năng thông báo tức thời đơn hàng mới và đơn hàng thanh toán thành công qua Telegram Bot, kèm nút tương tác 1 chạm duyệt đơn và tạo vận đơn GHN tự động qua Telegram Webhook.

**Architecture:** Áp dụng Clean Architecture: Client hạ tầng Telegram (`src/server/infrastructure/telegram.ts`), tách dịch vụ nghiệp vụ dùng chung duyệt đơn và vận chuyển (`src/server/modules/orders/order-fulfillment.service.ts`), bộ điều khiển tiếp nhận webhook callback (`src/server/modules/telegram/telegram-webhook.controller.ts`), và tích hợp phi đồng bộ non-blocking tại các luồng tạo đơn và thanh toán.

**Tech Stack:** Next.js 16 App Router, Node.js Native Test Runner (`node:test`, `node:assert/strict`), Prisma ORM, Telegram Bot API (fetch), GHN OpenAPI v2, Pusher Server.

**Spec:** `docs/superpowers/specs/2026-10-10-telegram-order-notification-design.md`

## Global Constraints

- Không import `@server` hoặc `@prisma/client` từ `@client` (Clean Architecture Zero Server Leakage Rule, kiểm tra bằng `npm run arch:check`).
- Toàn bộ import nội bộ workspace phải dùng path aliases (`@server/*`, `@shared/*`, `@client/*`, `@/*`), không dùng relative import giữa các module.
- Mọi cuộc gọi Telegram Bot API từ luồng tạo đơn và thanh toán phải chạy nền phi đồng bộ (`void notify...` bọc trong `try/catch`), tuyệt đối không làm chậm hoặc ném lỗi gián đoạn request của người dùng.
- Mọi so sánh bí mật xác thực webhook (`X-Telegram-Bot-Api-Secret-Token`) phải dùng hàm thời gian cố định `crypto.timingSafeEqual`.
- Tên khách hàng, tên sản phẩm, mã đơn và ghi chú hiển thị trên Telegram phải luôn được lọc qua `escapeTelegramHtml`.

## Review Focus

1. **HTML special characters in product/customer names**: Tên khách hàng chứa `<Script>`, `&`, hoặc `"` không làm vỡ HTML Parse Mode của Telegram.
2. **Missing or invalid Telegram credentials**: Hệ thống chạy bình thường (no-op an toàn) khi `TELEGRAM_BOT_TOKEN` hoặc `TELEGRAM_CHAT_ID` chưa được thiết lập.
3. **Webhook spoofing / timing attack**: Request gửi tới `/api/webhooks/telegram` không có secret token hợp lệ bị từ chối ngay với HTTP 401.
4. **Unauthorized user clicking approval button**: Người lạ trong nhóm Telegram bấm nút duyệt đơn bị từ chối với pop-up cảnh báo không có quyền.
5. **Double-click / Concurrent approval**: Bấm nút duyệt đơn GHN nhiều lần liên tiếp không sinh ra nhiều vận đơn trùng lặp trên GHN hoặc trong bảng `Shipment`.

---

### Task 1: Telegram Infrastructure Client & Formatting Helpers

**Files:**
- Create: `src/server/infrastructure/telegram.ts`
- Modify: `.env.example:44-48`
- Test: `tests/telegram-infra.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export function escapeTelegramHtml(text: string): string;
  export function formatNewOrderMessage(order: {
    orderCode: string;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    subtotal: number;
    shippingFee: number;
    discountAmount: number;
    couponCode?: string | null;
    totalAmount: number;
    items: Array<{ name: string; quantity: number; price: number; variantTitle?: string | null }>;
  }): { text: string; replyMarkup: Record<string, unknown> };
  export function formatPaidOrderMessage(order: {
    id: string;
    orderCode: string;
    customerName: string;
    totalAmount: number;
    paymentMethod?: string;
  }): { text: string; replyMarkup: Record<string, unknown> };
  export function formatApprovedOrderMessage(order: {
    orderCode: string;
    customerName: string;
    totalAmount: number;
    trackingCode: string;
    shippingFee: number;
    expectedDeliveryTime?: Date | null;
  }): { text: string; replyMarkup: Record<string, unknown> };
  export async function sendTelegramMessage(params: {
    text: string;
    chatId?: string;
    replyMarkup?: Record<string, unknown>;
  }): Promise<{ ok: boolean; messageId?: number; description?: string }>;
  export async function editTelegramMessage(params: {
    chatId: string | number;
    messageId: number;
    text: string;
    replyMarkup?: Record<string, unknown>;
  }): Promise<{ ok: boolean; description?: string }>;
  export async function answerCallbackQuery(params: {
    callbackQueryId: string;
    text?: string;
    showAlert?: boolean;
  }): Promise<{ ok: boolean; description?: string }>;
  ```

- [ ] **Step 1: Write the failing tests in `tests/telegram-infra.test.ts`**

Kiểm tra:
1. `escapeTelegramHtml` escape chính xác `<`, `>`, `&`, `"`.
2. `formatNewOrderMessage` sinh đúng nội dung HTML và cấu trúc nút Inline Keyboard trỏ về URL web admin.
3. `formatPaidOrderMessage` sinh đúng nút callback `approve_order:<id>`.
4. `sendTelegramMessage` tự động no-op trả về `{ ok: false, description: 'Telegram credentials missing' }` khi không có `TELEGRAM_BOT_TOKEN`.
5. Mock `fetch` trả về thành công khi có token đầy đủ.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/telegram-infra.test.ts`
Expected: FAIL với lỗi "Cannot find module .../telegram.ts"

- [ ] **Step 3: Implement `src/server/infrastructure/telegram.ts` & update `.env.example`**

- Cài đặt các hàm escape, format tin nhắn HTML (kèm tính tiền VND và định dạng ngày).
- Cài đặt các hàm gọi Telegram Bot API qua native `fetch` với timeout watchdog 8000ms.
- Thêm biến `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET` vào `.env.example`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/telegram-infra.test.ts`
Expected: PASS toàn bộ các test case.

- [ ] **Step 5: Commit**

```bash
git add src/server/infrastructure/telegram.ts tests/telegram-infra.test.ts .env.example
git commit -m "feat(telegram): tạo client hạ tầng Telegram và helper định dạng tin nhắn"
```

---

### Task 2: Shared Order Fulfillment Service (DRY & Idempotent GHN Dispatch)

**Files:**
- Create: `src/server/modules/orders/order-fulfillment.service.ts`
- Modify: `src/server/modules/orders/order-detail.controller.ts:195-234`
- Test: `tests/order-fulfillment.test.ts`

**Interfaces:**
- Consumes:
  - `createGHNShipment` từ `@server/modules/shipping/ghn.service`
  - `prisma` từ `@server/database/prisma`
  - `pusherServer` từ `@server/infrastructure/pusher`
- Produces:
  ```typescript
  export interface ApproveAndFulfillResult {
    success: boolean;
    orderId: string;
    orderCode: string;
    trackingCode?: string;
    shippingFee?: number;
    carrier?: string;
    expectedDeliveryTime?: Date | null;
    error?: string;
    isAlreadyProcessed?: boolean;
  }
  export async function approveAndFulfillOrder(orderId: string): Promise<ApproveAndFulfillResult>;
  ```

- [ ] **Step 1: Write the failing tests in `tests/order-fulfillment.test.ts`**

Kiểm tra:
1. Từ chối khi đơn hàng không tồn tại.
2. Từ chối khi đơn hàng chưa thanh toán (`paymentStatus !== 'PAID'`).
3. Chuyển trạng thái đơn sang `PROCESSING`, gọi GHN tạo mã vận đơn và lưu `Shipment` khi đơn hợp lệ.
4. Idempotency: Khi gọi lần 2 với đơn đã có `Shipment`, trả về `isAlreadyProcessed: true` cùng mã vận đơn hiện tại, không gọi tạo mới.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/order-fulfillment.test.ts`
Expected: FAIL với lỗi "Cannot find module .../order-fulfillment.service.ts"

- [ ] **Step 3: Implement `src/server/modules/orders/order-fulfillment.service.ts` and refactor `order-detail.controller.ts`**

- Viết `approveAndFulfillOrder` đảm bảo kiểm tra logic FSM, tạo vận đơn, lưu shipment, bắn Pusher realtime và gửi thông báo in-app.
- Thay thế đoạn code tạo GHN shipment thủ công trong `order-detail.controller.ts` bằng việc gọi hàm `approveAndFulfillOrder(currentOrder.id)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/order-fulfillment.test.ts`
Expected: PASS toàn bộ các test case.

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/orders/order-fulfillment.service.ts src/server/modules/orders/order-detail.controller.ts tests/order-fulfillment.test.ts
git commit -m "feat(orders): tách dịch vụ duyệt đơn và tạo vận đơn GHN dùng chung idempotent"
```

---

### Task 3: Telegram Webhook Controller & Interactive Callback Handler

**Files:**
- Create: `src/server/modules/telegram/telegram-webhook.controller.ts`
- Create: `src/app/api/webhooks/telegram/route.ts`
- Test: `tests/telegram-webhook.test.ts`

**Interfaces:**
- Consumes:
  - `approveAndFulfillOrder` từ `@server/modules/orders/order-fulfillment.service`
  - `answerCallbackQuery`, `editTelegramMessage`, `formatApprovedOrderMessage` từ `@server/infrastructure/telegram`
- Produces:
  - `POST(req: Request): Promise<NextResponse>`

- [ ] **Step 1: Write the failing tests in `tests/telegram-webhook.test.ts`**

Kiểm tra:
1. Trả về HTTP 401 khi header `x-telegram-bot-api-secret-token` không khớp `TELEGRAM_WEBHOOK_SECRET`.
2. Bỏ qua an toàn với HTTP 200 cho các update không phải callback query hoặc không liên quan đến duyệt đơn.
3. Kiểm tra bảo mật người bấm: Trả về alert "Bạn không có quyền" khi `from.id` hoặc `chat.id` không khớp cấu hình `TELEGRAM_CHAT_ID`.
4. Khi callback query hợp lệ (`approve_order:<orderId>`): Gọi `approveAndFulfillOrder`, gọi `answerCallbackQuery` và gọi `editTelegramMessage` cập nhật tin nhắn.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/telegram-webhook.test.ts`
Expected: FAIL với lỗi "Cannot find module .../telegram-webhook.controller.ts"

- [ ] **Step 3: Implement `telegram-webhook.controller.ts` & `src/app/api/webhooks/telegram/route.ts`**

- Viết controller kiểm tra `timingSafeEqual`, bóc tách payload callback query từ Telegram.
- Gọi các hàm nghiệp vụ và cập nhật giao diện tin nhắn Telegram.
- Khai báo route facade `src/app/api/webhooks/telegram/route.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/telegram-webhook.test.ts`
Expected: PASS toàn bộ các test case.

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/telegram/telegram-webhook.controller.ts src/app/api/webhooks/telegram/route.ts tests/telegram-webhook.test.ts
git commit -m "feat(telegram): tạo webhook controller tiếp nhận và xử lý callback duyệt đơn"
```

---

### Task 4: Connect Triggers (Order Created, VietQR Paid, Wallet Paid) & Fail-Safe Integration

**Files:**
- Modify: `src/server/modules/orders/orders.controller.ts:205-215`
- Modify: `src/server/modules/payment/casso-webhook.controller.ts:172-192`
- Modify: `src/server/modules/wallet/wallet-pay.controller.ts:60-70`
- Test: `tests/telegram-integration.test.ts`

**Interfaces:**
- Consumes:
  - `sendTelegramMessage`, `formatNewOrderMessage`, `formatPaidOrderMessage` từ `@server/infrastructure/telegram`

- [ ] **Step 1: Write integration tests in `tests/telegram-integration.test.ts`**

Kiểm tra:
1. Hàm kích hoạt thông báo đơn mới được gọi với dữ liệu đơn hàng tương ứng khi đơn tạo thành công.
2. Hàm kích hoạt thông báo đơn đã thanh toán được gọi khi đơn thanh toán qua VietQR hoặc Ví Shop.
3. Nếu Telegram API ném lỗi mạng (ví dụ fetch rejected), request tạo đơn hoặc thanh toán vẫn hoàn tất thành công 200 mà không bị crash.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/telegram-integration.test.ts`
Expected: FAIL

- [ ] **Step 3: Wire telegram notifications in controllers**

- `orders.controller.ts`: Sau khi lưu đơn thành công, bọc gọi `formatNewOrderMessage` và `sendTelegramMessage` trong khối non-blocking `try/catch`.
- `casso-webhook.controller.ts`: Sau khi cập nhật đơn `PAID`, bọc gọi `formatPaidOrderMessage` và `sendTelegramMessage` trong khối non-blocking `try/catch`.
- `wallet-pay.controller.ts`: Sau khi trừ ví thành công, bọc gọi `formatPaidOrderMessage` và `sendTelegramMessage` trong khối non-blocking `try/catch`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/telegram-integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/orders/orders.controller.ts src/server/modules/payment/casso-webhook.controller.ts src/server/modules/wallet/wallet-pay.controller.ts tests/telegram-integration.test.ts
git commit -m "feat(orders): tích hợp bắn thông báo Telegram khi tạo đơn và thanh toán thành công"
```

---

### Task 5: Architecture Verification & Full Regression Testing

**Files:**
- Test: Toàn bộ test suites

- [ ] **Step 1: Run architectural check (dependency-cruiser)**

Run: `npm run arch:check`
Expected: 0 violations (đảm bảo không rò rỉ mã server sang client).

- [ ] **Step 2: Run all test suites**

Run: `npm run test`
Expected: 100% test suites passed (bao gồm cả các test checkout, inventory, wallet, order-transitions, webhook-idempotency hiện có).

- [ ] **Step 3: Run project build check**

Run: `npm run build`
Expected: Next.js build thành công không có lỗi type hoặc compile.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: xác minh thành công toàn bộ test suites và Clean Architecture cho Telegram Bot"
```
