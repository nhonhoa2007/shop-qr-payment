# Thiết Kế Kỹ Thuật: Thông Báo Đơn Hàng & Duyệt Đơn GHN Qua Telegram Bot

- **Ngày tạo:** 2026-10-10
- **Trạng thái:** Bản thảo đề xuất (Draft Proposal)
- **Tác giả:** Claude Code & Phùng Nhơn Hòa
- **Phạm vi:** Server Application & Domain Layer, Infrastructure, Webhook Facade

---

## 1. Tổng Quan & Mục Tiêu Nghiệp Vụ

### 1.1. Bối cảnh & Vấn đề
Hiện tại, khi có khách hàng đặt hàng hoặc thanh toán thành công qua mã QR (VietQR / Casso) hoặc Ví Shop, thông báo mới chỉ được gửi realtime qua Pusher tới Dashboard web admin (`private-admin-channel`). Người quản trị (Admin/Staff) buộc phải mở trình duyệt liên tục mới có thể nắm bắt và duyệt đơn vận chuyển.

### 1.2. Mục tiêu hệ thống
1. **Thông báo tức thời qua Telegram Bot:** Khi phát sinh đơn hàng mới (`PENDING`) và khi đơn hàng thanh toán thành công (`PAID`), bot tự động gửi tin nhắn định dạng HTML chuyên nghiệp vào nhóm/chat Telegram quản trị kèm link xem chi tiết trên Web.
2. **Duyệt đơn 1 chạm trên Telegram (Interactive Approval):** Với đơn hàng đã thanh toán (`PAID`), tin nhắn có nút bấm `🚚 Duyệt & Tạo vận đơn GHN`. Khi admin bấm nút, hệ thống tự động:
   - Chuyển trạng thái đơn sang `PROCESSING`.
   - Gọi GHN OpenAPI v2 khởi tạo vận đơn giao hàng.
   - Lưu thông tin `Shipment` vào cơ sở dữ liệu.
   - Cập nhật trực tiếp tin nhắn trên Telegram (gỡ nút duyệt, gắn mã vận đơn GHN và thông tin dự kiến giao).
3. **Bảo mật & Tính độc lập (Resilience & Non-blocking):**
   - Mọi hoạt động gửi tin nhắn Telegram được thực thi bất đồng bộ nền (`non-blocking`), không bao giờ làm gián đoạn luồng đặt hàng của khách hoặc xử lý webhook của ngân hàng.
   - Webhook tiếp nhận callback từ Telegram được bảo vệ bởi Secret Token và xác thực danh tính người bấm nút (Authorization).

---

## 2. Kiến Trúc Hệ Thống & Tuân Thủ Clean Architecture

Tuân thủ kiến trúc phân tầng Layered Clean Architecture của dự án:
- **Presentation / API Facade (`src/app/api/webhooks/telegram/route.ts`):** Thin proxy ủy quyền cho controller.
- **Application & Domain Layer (`src/server/modules/`):**
  - `src/server/modules/telegram/telegram-webhook.controller.ts`: Tiếp nhận, xác thực và điều phối sự kiện callback từ Telegram.
  - `src/server/modules/orders/order-fulfillment.service.ts`: Domain service dùng chung, đóng gói logic chuyển trạng thái đơn sang `PROCESSING` + khởi tạo vận đơn GHN + lưu `Shipment` DB + kích hoạt Pusher realtime.
- **Infrastructure Layer (`src/server/infrastructure/telegram.ts`):**
  - Client giao tiếp với Telegram Bot API (`sendMessage`, `editMessageText`, `answerCallbackQuery`).
  - Hàm escape chuỗi HTML an toàn tránh lỗi cú pháp Parse Mode của Telegram.
  - Fail-safe no-op khi thiếu biến môi trường cấu hình bot.

```
                              ┌─────────────────────────────────────────┐
                              │          Telegram Bot API               │
                              └───────▲─────────────────────────▲───────┘
                                      │                                 │
                            (1) Send Message            (4) Edit Message
                                      │                     Answer Popup
                                      │                                 │
┌───────────────────────────┐         │               ┌─────────────────┴───────────┐
│ orders.controller.ts      ├─────────┤               │ telegram-webhook.controller │
│ casso-webhook.controller  ├─────────┤               └─────────────▲───────────────┘
│ wallet-pay.controller     ├─────────┤                             │
└───────────────────────────┘         │                  (3) POST /api/webhooks/telegram
                                      ▼                             │
                       ┌────────────────────────────┐               │
                       │ infrastructure/telegram.ts │               │
                       └────────────────────────────┘               │
                                                                    ▼
                                                  ┌──────────────────────────────────┐
                                                  │ order-fulfillment.service.ts     │
                                                  │ • FSM status -> PROCESSING       │
                                                  │ • createGHNShipment (GHN API)    │
                                                  │ • prisma.shipment.create         │
                                                  └──────────────────────────────────┘
```

---

## 3. Cấu Hình & Biến Môi Trường (Environment Variables)

Bổ sung vào `.env.example` và tệp môi trường `.env`:

```env
# Telegram Bot Integration
TELEGRAM_BOT_TOKEN="your-bot-token-from-botfather"
TELEGRAM_CHAT_ID="your-telegram-chat-or-group-id"
TELEGRAM_WEBHOOK_SECRET="your-telegram-webhook-secret-token"
```

### Nguyên tắc xử lý biến môi trường:
- Nếu `TELEGRAM_BOT_TOKEN` hoặc `TELEGRAM_CHAT_ID` để trống (môi trường CI/CD hoặc dev chưa setup bot): các hàm gửi tin nhắn sẽ tự động ghi log debug và return an toàn (`no-op`), không ném lỗi làm chết ứng dụng.
- `TELEGRAM_WEBHOOK_SECRET`: Dùng để xác thực header `X-Telegram-Bot-Api-Secret-Token` theo chuẩn của Telegram Webhook.

---

## 4. Chi Tiết Các Thành Phần Triển Khai

### 4.1. Hạ tầng Telegram Client (`src/server/infrastructure/telegram.ts`)
- **`escapeHtml(text: string): string`**: Chuyển đổi an toàn các ký tự `&`, `<`, `>`, `"`.
- **`sendTelegramMessage(params)`**:
  - Gửi POST request tới `https://api.telegram.org/bot<TOKEN>/sendMessage`.
  - Hỗ trợ `parse_mode: 'HTML'` và `reply_markup` (Inline Keyboard Buttons).
- **`editTelegramMessage(params)`**:
  - Gửi POST request tới `https://api.telegram.org/bot<TOKEN>/editMessageText`.
  - Cập nhật lại nội dung và danh sách nút bấm của tin nhắn cũ khi đơn được duyệt.
- **`answerCallbackQuery(callbackQueryId, text, showAlert)`**:
  - Phản hồi ngay lập tức cho Telegram để tắt trạng thái loading trên client của người dùng và hiển thị pop-up thông báo.
- **`formatNewOrderMessage(order)`**: Định dạng tin nhắn HTML khi đơn vừa được tạo (`PENDING`).
- **`formatPaidOrderMessage(order)`**: Định dạng tin nhắn HTML khi đơn đã thanh toán (`PAID`).

### 4.2. Dịch vụ Thực thi Vận đơn Dùng chung (`src/server/modules/orders/order-fulfillment.service.ts`)
Tách logic xử lý đơn hàng từ `order-detail.controller.ts` thành service chuyên biệt:
```typescript
export interface ApproveAndFulfillResult {
  success: boolean;
  orderId: string;
  orderCode: string;
  trackingCode?: string;
  shippingFee?: number;
  carrier?: string;
  error?: string;
  isAlreadyProcessed?: boolean;
}

export async function approveAndFulfillOrder(orderId: string): Promise<ApproveAndFulfillResult>;
```
**Quy tắc nghiệp vụ:**
1. Kiểm tra đơn hàng có tồn tại và trạng thái thanh toán có phải là `PAID` hay không.
2. Kiểm tra Idempotency: Nếu đơn hàng đã có `Shipment` hoặc trạng thái đã là `PROCESSING`/`SHIPPING`/`COMPLETED`, trả về kết quả thành công với thông tin vận đơn hiện có (tránh gọi tạo trùng nhiều lần tới GHN).
3. Chuyển trạng thái đơn sang `PROCESSING` trong database.
4. Gọi `createGHNShipment(...)` để tạo vận đơn với GHN (có cơ chế mock an toàn khi chưa có token GHN).
5. Lưu bản ghi `Shipment` và `shippingLogs`.
6. Kích hoạt Pusher báo trạng thái tới người mua (`private-user-${userId}`) và admin (`private-admin-channel`).
7. Tạo bản ghi `Notification` trong DB cho khách hàng.

### 4.3. Telegram Webhook Controller (`src/server/modules/telegram/telegram-webhook.controller.ts`)
- Endpoint nhận: `POST /api/webhooks/telegram`.
- Xác thực:
  - So sánh `req.headers.get('x-telegram-bot-api-secret-token')` với `process.env.TELEGRAM_WEBHOOK_SECRET` bằng `crypto.timingSafeEqual`.
  - Xác thực người bấm: Kiểm tra `from.id` hoặc `chat.id` của callback query có trùng khớp với `process.env.TELEGRAM_CHAT_ID` hoặc danh sách chat hợp lệ.
- Xử lý payload callback:
  - Nếu callback data có định dạng `approve_order:<orderId>`:
    - Gọi `approveAndFulfillOrder(orderId)`.
    - Gọi `answerCallbackQuery` hiển thị pop-up thông báo kết quả.
    - Gọi `editTelegramMessage` cập nhật lại tin nhắn hiển thị mã vận đơn và tắt nút bấm.

### 4.4. Tích Hợp Điểm Gửi Thông Báo (Trigger Points)
1. **Khi khách tạo đơn mới (`POST /api/orders`)**:
   - Sau khi transaction tạo đơn thành công, gọi `void sendTelegramNewOrder(order)`.
2. **Khi khách quét QR thanh toán VietQR khớp lệnh (`casso-webhook.controller.ts`)**:
   - Sau khi transaction cập nhật `PAID` thành công, gọi `void sendTelegramOrderPaid(order)`.
3. **Khi khách thanh toán bằng Ví Shop thành công (`wallet-pay.controller.ts`)**:
   - Sau khi trừ ví và cập nhật `PAID` thành công, gọi `void sendTelegramOrderPaid(order)`.
4. **Refactor `order-detail.controller.ts`**:
   - Thay thế đoạn code tạo vận đơn thủ công bằng việc gọi `approveAndFulfillOrder(orderId)`.

---

## 5. Định Dạng Giao Diện Tin Nhắn Telegram (UI/UX Specification)

### 5.1. Tin nhắn khi có đơn mới (`PENDING`)
```html
🛒 <b>ĐƠN HÀNG MỚI #DH123456</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Khách hàng:</b> Nguyễn Văn A
📞 <b>SĐT:</b> 0901234567
📍 <b>Địa chỉ:</b> 123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh

📦 <b>Sản phẩm:</b>
• Áo thun Oversize (Đen / L) x 2 — 350.000đ
• Quần Jean Slimfit x 1 — 450.000đ

💰 <b>Tạm tính:</b> 800.000đ
🚚 <b>Phí vận chuyển:</b> 30.000đ
🎟️ <b>Giảm giá:</b> -50.000đ (SALE50)
💵 <b>TỔNG CỘNG:</b> 780.000đ
⏰ <i>Hạn thanh toán: 15 phút</i>
```
*Inline Keyboard:*
`[ 🔍 Xem chi tiết trên Web ]` ➔ URL: `${NEXTAUTH_URL}/admin/orders?search=DH123456`

### 5.2. Tin nhắn khi đơn đã thanh toán (`PAID`)
```html
💰 <b>ĐƠN HÀNG ĐÃ THANH TOÁN #DH123456</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Khách hàng:</b> Nguyễn Văn A
💵 <b>Số tiền nhận:</b> 780.000đ
💳 <b>Phương thức:</b> Chuyển khoản VietQR
⚡ <b>Trạng thái:</b> Đã xác nhận tiền về tài khoản
```
*Inline Keyboard:*
`[ 🚚 Duyệt & Tạo vận đơn GHN ]` (callback_data: `approve_order:<orderId>`)
`[ 🔍 Xem chi tiết trên Web ]` (url: `${NEXTAUTH_URL}/admin/orders?search=DH123456`)

### 5.3. Tin nhắn sau khi Admin bấm duyệt (Sửa nội dung tin nhắn ban đầu)
```html
💰 <b>ĐƠN HÀNG ĐÃ THANH TOÁN #DH123456</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Khách hàng:</b> Nguyễn Văn A
💵 <b>Số tiền nhận:</b> 780.000đ
💳 <b>Phương thức:</b> Chuyển khoản VietQR
⚡ <b>Trạng thái:</b> Đã xác nhận tiền về tài khoản
━━━━━━━━━━━━━━━━━━━━
✅ <b>ĐÃ DUYỆT & TẠO VẬN ĐƠN GHN</b>
📦 <b>Mã vận đơn:</b> <code>GY7B8C9D</code>
🚚 <b>Cước GHN:</b> 30.000đ
📅 <b>Dự kiến giao:</b> 15/10/2026
```
*Inline Keyboard mới (Đã gỡ nút Duyệt):*
`[ 🔍 Xem chi tiết trên Web ]`

---

## 6. Xử Lý Lỗi, Concurrency & Bảo Mật

1. **Idempotency & Race Condition (Chống duyệt trùng):**
   - Nếu hai nhân viên cùng bấm nút duyệt đơn hoặc bấm liên tiếp nhiều lần, hệ thống sử dụng trạng thái đơn và quan hệ `Shipment` để phát hiện. Lần bấm thứ hai sẽ nhận ngay thông tin vận đơn hiện có và Telegram vẫn cập nhật giao diện mà không sinh ra vận đơn thứ hai trên GHN.
2. **Timing Attack Protection:**
   - So sánh webhook secret token qua `crypto.timingSafeEqual`.
3. **Fail-safe Non-blocking Delivery:**
   - Mọi hàm gửi tin Telegram bọc trong block `try/catch` và không ném lỗi ra bên ngoài. Lỗi mạng chỉ ghi log hệ thống (`console.error('[Telegram] ...')`).
4. **HTML Injection Protection:**
   - Tên khách hàng, tên sản phẩm, địa chỉ, mã giảm giá đều được lọc qua hàm `escapeHtml` để loại bỏ nguy cơ làm hỏng định dạng parse HTML của Telegram.

---

## 7. Kế Hoạch Kiểm Thử (Testing Plan)

### 7.1. Unit & Integration Tests (`tests/telegram.test.ts`)
- **T1: HTML Escaping:** Kiểm tra việc escape các ký tự đặc biệt (`<script>`, `&amp;`, `"`).
- **T2: Format Message Output:** Kiểm tra thông điệp tạo đơn và thông điệp thanh toán sinh đúng cấu trúc HTML và tính toán số tiền chính xác.
- **T3: Webhook Secret Validation:** Kiểm tra từ chối 401 khi thiếu hoặc sai secret token, chấp thuận khi đúng token.
- **T4: Callback Authorization:** Kiểm tra từ chối khi sender ID không khớp cấu hình `TELEGRAM_CHAT_ID`.
- **T5: Order Fulfillment Idempotency:** Kiểm tra việc gọi `approveAndFulfillOrder` 2 lần liên tiếp không tạo ra 2 shipment.
- **T6: Graceful Degradation:** Kiểm tra các hàm gửi tin nhắn hoạt động không văng lỗi khi thiếu biến môi trường.

### 7.2. Regression & Architecture Checks
- Chạy toàn bộ test suites hiện có: `npm run test`.
- Kiểm tra tính toàn vẹn kiến trúc phân tầng: `npm run arch:check` (0 vi phạm Clean Architecture).
