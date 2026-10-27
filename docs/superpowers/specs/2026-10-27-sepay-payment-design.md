# Thiết kế thanh toán SePay

## Mục tiêu

Thay luồng thanh toán mới từ Casso/payOS sang SePay cho cả đơn hàng và nạp Ví Shop, vẫn hiển thị VietQR trực tiếp trên web. Mọi yêu cầu thanh toán mới phải tồn tại qua lần khởi động lại server và webhook phải xử lý lũy đẳng.

## Phạm vi

- Đơn hàng mới tạo mã `DH...`, QR SePay/VietQR và một `PaymentRequest` trong cùng transaction.
- Nạp ví tạo mã `NAP...`, QR SePay/VietQR và một `PaymentRequest` trong PostgreSQL.
- SePay gửi một giao dịch tiền vào tới `POST /api/webhooks/sepay`.
- Client theo dõi `GET /api/payments/[code]` ngoài Pusher để tự đồng bộ nếu realtime bị gián đoạn.
- Endpoint Casso hiện tại được giữ tạm thời để đối soát giao dịch cũ, đặc biệt `NAP261027622`.

## Lựa chọn tích hợp

Dùng SePay Bank Webhook kết hợp QR động tại `https://vietqr.app/img`. Cách này phù hợp lựa chọn giữ QR trên web, giữ nguyên mã `DH...`/`NAP...`, không chuyển khách sang trang checkout của nhà cung cấp.

QR gồm số tài khoản, ngân hàng, số tiền và nội dung chuyển khoản. Biến `SEPAY_QR_MEMO_PREFIX` cho phép thêm `SEVQR` hoặc `TKP...` trước mã thanh toán khi ngân hàng yêu cầu.

## Dữ liệu

Thêm model `PaymentRequest` (model thứ 35, dưới trần thiết kế 37):

- `code` duy nhất: mã `DH...` hoặc `NAP...`.
- `kind`: `ORDER` hoặc `WALLET_TOPUP`.
- `status`: `PENDING`, `COMPLETED`, `EXPIRED`.
- `amount`, `qrUrl`, `expiresAt`, `completedAt`.
- `userId`, `orderId`, `idempotencyKey` tùy loại yêu cầu.
- `provider` mặc định `SEPAY` để dữ liệu có nguồn gốc rõ ràng.

`BankTransfer` tiếp tục là sổ nhận tiền và đối soát. `bankTransId` lưu `sepay:<id>` và `fingerprint` cũng dựa trên ID giao dịch SePay để chặn retry hoặc replay.

## Xác thực webhook

- Production bắt buộc `SEPAY_WEBHOOK_SECRET`.
- Đọc raw body bằng `Request.text()`.
- Kiểm tra `X-SePay-Timestamp` trong khoảng 5 phút.
- Tính HMAC-SHA256 trên chuỗi `{timestamp}.{raw_body}`.
- So sánh timing-safe với `X-SePay-Signature` dạng `sha256=<hex>`.
- Chỉ nhận `transferType = "in"`, amount nguyên dương và không vượt giới hạn nghiệp vụ.

## Đối soát

1. Chuẩn hóa payload SePay thành giao dịch ngân hàng nội bộ.
2. Tạo `BankTransfer` trước khi áp dụng tiền. Duplicate trả `{"success":true}` để SePay dừng retry.
3. Ưu tiên `payload.code`; nếu trống thì trích `DH...`/`NAP...` từ `content`.
4. Chỉ tự động áp dụng khi mã tồn tại, request còn `PENDING`, chưa hết hạn và số tiền khớp chính xác.
5. Sai tiền, mã không tồn tại, request đã hoàn tất/hết hạn, đơn đã hủy hoặc tiền đến muộn: giữ `PENDING_REVIEW` với lý do tiếng Việt.
6. Xác nhận đơn/cộng ví, cập nhật `PaymentRequest` và `BankTransfer` trong cùng Prisma transaction.
7. Pusher, notification và Telegram chạy sau khi transaction thành công.

## API và giao diện

- `POST /api/webhooks/sepay`: endpoint công khai do SePay gọi, phản hồi thành công đúng hợp đồng `{"success":true}`.
- `GET /api/payments/[code]`: trả trạng thái tối thiểu. Yêu cầu nạp ví chỉ chủ sở hữu đã đăng nhập được xem; trạng thái đơn hàng không trả dữ liệu khách hàng.
- Trang thanh toán và modal nạp ví poll endpoint trạng thái, đồng thời vẫn nghe Pusher.
- UI ghi rõ “SePay/VietQR” và nội dung chuyển khoản thực tế.

## Triển khai và vận hành

- Live webhook cần URL HTTPS công khai; localhost dùng SePay Test mode và tunnel.
- Dashboard SePay cấu hình hai tiền tố mã thanh toán `DH` và `NAP`, webhook chỉ tiền vào, xác thực HMAC-SHA256.
- Chưa restart tiến trình localhost đang giữ phiên Casso cũ. Đối soát `NAP261027622` trước khi chuyển live.

## Tài liệu nguồn

- https://developer.sepay.vn/vi/sepay-webhooks/tich-hop-webhook
- https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc
- https://developer.sepay.vn/vi/tien-ich-khac/tao-qr-code
- https://developer.sepay.vn/vi/tien-ich-khac/test-mode/mo-phong-giao-dich
