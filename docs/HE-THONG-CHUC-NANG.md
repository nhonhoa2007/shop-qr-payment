# Hệ thống chức năng Shop QR Payment

> Bản tổng quan theo code/config ngày 20/11/2026. Luồng chi tiết và bảng route/API nằm trong [PROJECT_FLOWS.md](architecture/PROJECT_FLOWS.md); source code mới là căn cứ cuối cùng khi có khác biệt.

## Tổng quan

Shop QR Payment là ứng dụng mua sắm trực tuyến gồm storefront, chức năng khách hàng, trang quản trị và API. Các luồng dùng chung PostgreSQL/Prisma; Redis, email, Pusher, GHN, SePay, Telegram, lưu ảnh và AI hoạt động theo cấu hình môi trường.

```text
src/app       page, Server Component, route handler
src/client    view, component, hook, store
src/server    controller, service, database, infrastructure
src/shared    type, DTO, validation, hằng số, tiện ích
```

Các route handler thường kết nối tới controller/service trong `src/server/modules`. Server Component cũng có thể đọc service trực tiếp. Client không truy cập Prisma/database.

## Chức năng dành cho khách hàng

### Khám phá catalog

Trang chủ và trang sản phẩm hỗ trợ duyệt danh mục, tìm kiếm/lọc, chọn biến thể, xem thông số, ảnh, tồn kho và đánh giá đã duyệt. Catalog điện tử có thêm nguồn dữ liệu, điểm đánh giá theo rubric, so sánh sản phẩm và kiểm tra tương thích phụ kiện. Các nguồn/rubric/rule có phần quản trị qua API, nhưng không phải phần nào cũng có trang admin.

Trợ lý mua sắm có thể tìm/lọc sản phẩm và tạo so sánh bằng dữ liệu catalog. Những nhánh này không nhất thiết gọi LLM; khi cần sinh câu trả lời mới sử dụng provider AI đã cấu hình. Không cấu hình API AI thì code chọn fake provider. Catalog demo được đánh dấu dữ liệu tổng hợp, không dùng làm xác nhận giá/thông số thực tế.

### Giỏ hàng và checkout

Giỏ được lưu phía trình duyệt bằng Zustand. Khi checkout, server xác minh lại sản phẩm/biến thể, giá, tồn kho, coupon, compatibility, địa chỉ và phí giao. Tồn kho được giữ cùng với Order và snapshot OrderItem; payment request được tạo cho đơn cần thanh toán. Tổng tiền từ client không được dùng làm nguồn quyết định.

Checkout hỗ trợ địa chỉ chọn thủ công và định vị thiết bị với reverse geocoding. Địa chỉ cuối cùng phải khớp danh mục địa bàn GHN; trường hợp không khớp yêu cầu chọn lại thay vì tự đoán.

### Thanh toán và đơn hàng

Đơn có thể thanh toán bằng VietQR chuyển khoản hoặc ví Shop theo điều kiện của người dùng/đơn. PaymentRequest lưu mã, amount, hạn dùng và trạng thái; số tiền được đối soát từ dữ liệu server. Webhook SePay hiện là luồng thanh toán chính trong code. Casso còn endpoint tương thích cũ.

Giao dịch hợp lệ cập nhật BankTransfer và đơn trong transaction. Giao dịch thiếu/sai mã, sai số tiền, quá hạn hoặc chưa thể tự áp dụng có thể cần đối soát quản trị. Trạng thái đơn và trạng thái thanh toán là hai trường riêng. Khách có thể theo dõi đơn, thông báo và các mốc vận chuyển trên trang tài khoản.

Ví Shop hỗ trợ nạp tiền bằng mã chuyển khoản, thanh toán đơn đủ điều kiện và ghi lịch sử biến động. Hoàn tiền có service và sổ giao dịch riêng; trường hợp xử lý hoàn ngoài ngân hàng không đồng nghĩa ứng dụng tự gửi tiền qua ngân hàng.

### Hỗ trợ và hậu mãi

Khách đã đăng nhập có thể chat CSKH, nhận thông báo realtime, lưu wishlist/coupon và xem dữ liệu cá nhân. Đổi trả và bảo hành yêu cầu đúng quyền sở hữu đơn và trạng thái nghiệp vụ. Review yêu cầu đơn hoàn tất chứa sản phẩm; review chưa được duyệt không hiển thị công khai.

## Chức năng quản trị và nhân viên

- **Dashboard:** tổng hợp hoạt động và nhận tín hiệu cập nhật realtime; STAFF chỉ xem phạm vi dữ liệu vận hành được cho phép.
- **Đơn hàng và thanh toán:** tra cứu, xử lý trạng thái theo state machine và đối soát giao dịch khi có quyền.
- **Sản phẩm và ưu đãi:** quản lý catalog/biến thể, coupon và các phần dữ liệu quản trị hiện có.
- **Vận chuyển:** xem shipment và timeline GHN; một số quyết định fulfillment cần ADMIN review.
- **Kho:** điều chỉnh/đối soát, nhập từ supplier, theo dõi serialized unit và các trạng thái cách ly.
- **CSKH và hậu mãi:** chat, review, đổi trả, bảo hành, audit log.
- **Catalog intelligence:** có API quản lý nguồn dữ liệu, scoring và compatibility; không phải tất cả đều có page admin.

`ADMIN` có quyền operator đầy đủ. `STAFF` cần quyền module cụ thể từ danh sách `src/shared/constants/permissions.ts`: orders, products, shipments, chat, reviews, inventory, warranties, knowledge, scoring, assistant. Các thao tác tài chính hoặc quản trị nhạy cảm tiếp tục kiểm tra ADMIN riêng.

## Luồng nền và tích hợp

| Tích hợp / tác vụ | Hành vi hiện có |
| --- | --- |
| SePay | Nhận webhook chữ ký để xử lý payment request và ghi BankTransfer |
| Casso | Webhook legacy tại `/api/webhooks/payment` |
| GHN | Báo phí, tạo vận đơn, webhook cập nhật giao hàng |
| Pusher | Chat, payment/order notification và các sự kiện dashboard |
| Telegram | Outbox bền vững, retry qua worker và webhook callback |
| Email | Resend cho OTP tài khoản |
| Ảnh | Upload service ưu tiên R2, có nhánh Cloudinary/local |
| AI | HTTP provider tùy cấu hình; fake provider khi chưa cấu hình |
| Cron | Hết hạn đơn mỗi ngày theo `vercel.json`; Telegram outbox mỗi phút |

Đơn hết hạn sau 15 phút theo hạn nghiệp vụ. Job hết hạn hiện chạy theo lịch hằng ngày và có kiểm tra lười trong luồng đọc đơn; purge hội thoại có endpoint nhưng chưa được khai báo trong `vercel.json`. Xem [CRON_SETUP.md](architecture/CRON_SETUP.md) để biết giới hạn và xác thực.

## Tài liệu kỹ thuật liên quan

- [Bản đồ trang, API và luồng chi tiết](architecture/PROJECT_FLOWS.md)
- [Phân tích kiến trúc](../SYSTEM_DESIGN.md)
- [Schema Prisma](../prisma/schema.prisma)
- [Cấu hình môi trường](../.env.example)
- [Chỉ mục tài liệu và tài liệu lịch sử](README.md)
