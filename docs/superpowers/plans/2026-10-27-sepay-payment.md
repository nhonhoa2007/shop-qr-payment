# SePay Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dùng SePay để tạo VietQR, lưu yêu cầu thanh toán bền vững và tự động đối soát đơn hàng/nạp ví qua webhook an toàn.

**Architecture:** `PaymentRequest` là nguồn trạng thái cho mọi mã `DH...`/`NAP...`; `BankTransfer` là sổ webhook và hàng đợi đối soát. SePay controller xác thực raw-body HMAC rồi gọi các dịch vụ áp dụng tiền trong Prisma transaction.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 6/PostgreSQL, Node crypto, React 19.

**Spec:** `docs/superpowers/specs/2026-10-27-sepay-payment-design.md`

## Global Constraints

- Giữ QR trên web; không chuyển khách sang hosted checkout.
- Giữ endpoint Casso cũ để xử lý giao dịch cũ.
- Không restart hoặc sửa database của tiến trình localhost hiện tại.
- Production dùng HMAC-SHA256 và HTTPS công khai.
- Tiền sai, mã sai hoặc đến muộn chỉ vào đối soát, không tự áp dụng.
- Không chạy integration test trên database dùng chung; cần database test tách biệt.

## Review Focus

- Raw body có Unicode/khoảng trắng vẫn xác thực đúng; test HMAC dùng chính raw string.
- Timestamp cũ hơn 5 phút bị từ chối; test ranh giới replay.
- Hai webhook cùng `id` chỉ cộng tiền một lần; test duplicate ledger.
- `payload.code` trống vẫn tìm mã trong `content`; test cả `DH` và `NAP`.
- Sai số tiền hoặc hết hạn không đổi trạng thái yêu cầu; test review reason và trạng thái giữ nguyên.

---

### Task 1: Hợp đồng SePay và QR

**Files:**
- Create: `tests/sepay-contract.test.ts`
- Create: `src/server/modules/payment/sepay.service.ts`
- Modify: `src/server/modules/payment/vietqr.service.ts`

**Interfaces:**
- Produces: `verifySePayWebhook(rawBody, headers, secret, now?)`, `parseSePayPayload(value)`, `generateSePayQrUrl(params)`.

- [ ] Viết test thất bại cho URL VietQR, payload, HMAC hợp lệ, chữ ký sai và timestamp cũ.
- [ ] Chạy test và xác nhận fail vì module/chức năng chưa có.
- [ ] Cài đặt tối thiểu bằng Web `Headers`, `Request.text()` compatible data và `node:crypto`.
- [ ] Chạy test đến khi pass rồi commit.

### Task 2: PaymentRequest bền vững

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261027000100_add_payment_requests/migration.sql`
- Modify: `docs/architecture/prisma-model-registry.md`
- Modify: `tests/prisma-model-budget.test.ts`
- Create: `tests/payment-request.test.ts`
- Create: `src/server/modules/payment/payment-request.service.ts`

**Interfaces:**
- Consumes: `generateSePayQrUrl` từ Task 1.
- Produces: create/find/complete/expire functions cho `PaymentRequest` với client Prisma được truyền vào.

- [ ] Viết test thất bại cho idempotent create, truy vấn mã và mapping trạng thái.
- [ ] Thêm model thứ 35, migration và registry; generate Prisma client.
- [ ] Cài service tối thiểu và chạy test/schema budget đến khi pass.
- [ ] Commit.

### Task 3: Đơn hàng và nạp ví tạo request SePay

**Files:**
- Modify: `src/server/modules/orders/orders.controller.ts`
- Modify: `src/server/modules/wallet/wallet-topup.service.ts`
- Modify: `src/server/modules/wallet/wallet-topup.controller.ts`
- Modify: `src/shared/types/index.ts`
- Modify/Test: `tests/checkout.test.ts`, `tests/wallet-topup.test.ts`, `tests/wallet-topup-ui.test.ts`

**Interfaces:**
- Consumes: PaymentRequest service và QR service.
- Produces: đơn hàng/request trong cùng transaction; topup request PostgreSQL với idempotency key.

- [ ] Viết/đổi test để fail nếu request không được lưu và QR không dùng SePay.
- [ ] Tạo request đơn hàng trong transaction hiện có.
- [ ] Đổi topup session sang database source; giữ cache chỉ để đọc phiên Casso cũ.
- [ ] Chạy test liên quan đến khi pass rồi commit.

### Task 4: Webhook SePay và áp dụng tiền nguyên tử

**Files:**
- Create: `tests/sepay-webhook.test.ts`
- Create: `src/server/modules/payment/sepay-webhook.controller.ts`
- Create: `src/app/api/webhooks/sepay/route.ts`
- Rename/Modify: `src/server/modules/payment/casso-order-payment.service.ts` thành dịch vụ bank payment dùng chung (giữ re-export tương thích nếu cần).
- Modify: `src/server/modules/wallet/wallet-topup.service.ts`

**Interfaces:**
- Consumes: verifier/parser Task 1, request store Task 2.
- Produces: `POST /api/webhooks/sepay` với response `{"success":true}` và ledger idempotent.

- [ ] Viết test fail cho unauthorized, valid order, valid topup, duplicate, sai tiền và đến muộn.
- [ ] Cài controller với dependencies tách được để unit test không chạm database thật.
- [ ] Cập nhật request/ledger/order/wallet trong cùng transaction.
- [ ] Chạy test đến khi pass rồi commit.

### Task 5: Status polling và hướng dẫn vận hành

**Files:**
- Create: `tests/sepay-status-ui.test.ts`
- Create: `src/server/modules/payment/payment-status.controller.ts`
- Create: `src/app/api/payments/[code]/route.ts`
- Modify: `src/client/components/payment/QRPayment.tsx`
- Modify: `src/client/components/wallet/WalletTopupModal.tsx`
- Modify: `.env.example`, `README.md`

**Interfaces:**
- Consumes: PaymentRequest store.
- Produces: GET status có kiểm soát quyền và client polling fallback.

- [ ] Viết test fail cho response tối thiểu, quyền topup và UI polling.
- [ ] Cài endpoint và polling; cập nhật nội dung UI sang SePay/VietQR.
- [ ] Ghi biến môi trường, URL webhook, HMAC, tiền tố `DH`/`NAP`, Test mode/tunnel.
- [ ] Chạy unit test, lint, architecture check, build và schema budget.
- [ ] Ghi rõ integration test chưa chạy nếu không có database test tách biệt; commit.
