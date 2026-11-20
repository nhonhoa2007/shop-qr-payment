# Phân tích và thiết kế hệ thống Shop QR Payment

> Tài liệu này mô tả cấu trúc mã nguồn tại ngày 20/11/2026. Đối chiếu chi tiết luồng, route, controller và giới hạn UI ở [bản đồ luồng hiện tại](docs/architecture/PROJECT_FLOWS.md). Nếu tài liệu khác với mã nguồn, ưu tiên mã nguồn và cấu hình triển khai.

## 1. Mục tiêu và phạm vi

Shop QR Payment là ứng dụng thương mại điện tử phục vụ catalog, checkout, thanh toán chuyển khoản, vận chuyển, CSKH và nghiệp vụ quản trị. Hệ thống có hỗ trợ ví nội bộ, kiểm kê tồn kho, đổi trả/bảo hành, quản lý catalog điện tử và trợ lý tìm kiếm sản phẩm.

Tài liệu mô tả khả năng trong repository. Việc một luồng thật sự gửi email, nhận webhook, gọi GHN/AI hay cập nhật realtime phụ thuộc vào secret, biến môi trường, database và dịch vụ ngoài ở môi trường chạy.

## 2. Công nghệ và dữ liệu

| Khu vực | Công nghệ hiện tại |
| --- | --- |
| Web / API | Next.js 16 App Router, React 19, TypeScript 5 |
| Giao diện | Tailwind CSS 4, Zustand, Lucide, Sonner, Motion |
| Lưu trữ nghiệp vụ | PostgreSQL, Prisma ORM 6 |
| Xác thực | NextAuth Credentials/JWT, Argon2id, OTP email qua Resend |
| Realtime | Pusher |
| Cache và quota | Redis qua Upstash khi cấu hình; có fallback trong bộ nhớ cho một số luồng |
| Thanh toán | VietQR + SePay là đường webhook hiện tại; Casso còn endpoint tương thích cũ; ví Shop |
| Vận chuyển | GHN API và webhook |
| Lưu ảnh | Cloudflare R2 ưu tiên, Cloudinary/local theo nhánh cấu hình |
| Tác vụ thông báo | Telegram Bot với outbox bền vững |
| Assistant | Commerce resolver xác định và adapter AI HTTP tùy cấu hình |

Prisma hiện có **35 model** trong `prisma/schema.prisma`; danh sách vai trò từng model nằm trong [Prisma Model Registry](docs/architecture/prisma-model-registry.md). Tiền nghiệp vụ dùng `BigInt`; khi đi qua HTTP phải serialize thành chuỗi `MoneyVnd` để tránh mất chính xác. Tồn kho dùng sổ `InventoryMovement` và các projection trên product/variant.

## 3. Ranh giới kiến trúc

```text
src/
├── app/       Route page, Server Component và route handler của Next.js
├── client/    View, component, hook và Zustand store chạy phía trình duyệt
├── server/    Controller, service, database và infrastructure chạy phía server
├── shared/    DTO, type, validation, constant và tiện ích dùng chung
└── types/     Khai báo type mở rộng
```

`src/app` kết nối giao diện/API với `src/client` và `src/server`. Server Component có thể gọi service trực tiếp; Client Component giao tiếp qua HTTP hoặc Pusher. Controller chịu trách nhiệm kiểm tra request/quyền và điều phối; nghiệp vụ cùng transaction được đặt trong service. `npm run arch:check` kiểm tra quy tắc client không phụ thuộc server/Prisma và shared không phụ thuộc ngược vào hai tầng còn lại.

## 4. Các miền nghiệp vụ

### Catalog và trợ lý mua sắm

Catalog quản lý Brand, Category, Product, ProductVariant, thông số có nguồn, ảnh và dữ liệu demo. Có lọc/tìm kiếm, so sánh, điểm theo rubric và luật tương thích phụ kiện. Compatibility và scoring là nghiệp vụ dựa trên dữ liệu/rule; assistant chỉ gửi yêu cầu tới provider khi nhánh xử lý cần sinh câu trả lời. Khi thiếu cấu hình AI, code dùng provider giả lập. Dữ liệu catalog demo được đánh dấu tổng hợp; không coi là bằng chứng giá/thông số bán hàng.

### Giỏ, checkout và đơn hàng

Giỏ lưu ở Zustand. Khi đặt hàng, server xác thực lại sản phẩm, biến thể, giá, khả năng tương thích, mã giảm giá, địa chỉ/packing và phí giao. Giao dịch ghi Order, snapshot OrderItem, claim kho/coupon, PaymentRequest nếu cần thanh toán và thông báo outbox. Tiền được tính từ dữ liệu server, không tin tổng tiền do trình duyệt gửi.

Đơn chưa thanh toán có hạn nghiệp vụ 15 phút. `expireUnpaidOrders` giải phóng kho và coupon khi hết hạn; tác vụ có thể được kích hoạt bởi cron hoặc kiểm tra lười trong luồng đọc đơn. Lịch cron trong repository hiện chạy job hết hạn mỗi ngày lúc 00:00 UTC, nên lịch quét không đồng nghĩa với thời gian hết hạn.

### Thanh toán và ví

Order và wallet top-up dùng `PaymentRequest` bền vững, có mã thanh toán, số tiền, thời hạn và trạng thái. SePay là webhook hiện tại; xử lý xác thực payload, claim giao dịch, idempotency, xác nhận payment request và cập nhật `BankTransfer`/đơn/ví trong transaction. `/api/webhooks/payment` và Casso service là đường tương thích cũ; không nên mô tả Casso là tích hợp chính hiện tại.

Các giao dịch không đủ điều kiện tự áp dụng được lưu trạng thái chờ đối soát. Admin có API xem/đối soát giao dịch. Thanh toán ví dùng cập nhật có điều kiện để không chi vượt số dư. Hoàn tiền vào ví và các thao tác tài chính khác được ghi vào sổ ví/RefundCase theo nghiệp vụ tương ứng; API đánh dấu hoàn ngoài hệ thống không tự chuyển tiền qua ngân hàng.

### Vận chuyển và kho

GHN quote phí và tạo vận đơn qua service; webhook đồng bộ trạng thái giao. Fulfillment kiểm tra trạng thái thanh toán, địa chỉ, thiết bị serial/IMEI và các nhánh cần admin review. Kho hỗ trợ nhận hàng từ nhà cung cấp, điều chỉnh sổ kho, serial, quarantine và hoàn trả. Một số capability có API backend nhưng chưa có trang admin riêng; xem coverage page/API trong [PROJECT_FLOWS.md](docs/architecture/PROJECT_FLOWS.md).

### Tài khoản, vận hành và hậu mãi

NextAuth Credentials tạo JWT session. Đăng ký và đặt lại mật khẩu dùng OTP email; password và OTP được hash Argon2id. CUSTOMER có quyền khách hàng; STAFF cần permission module được cấp; ADMIN bypass các permission operator. Các nhóm STAFF hiện có trong `src/shared/constants/permissions.ts`, gồm orders, products, shipments, chat, reviews, inventory, warranties, knowledge, scoring và assistant.

Đổi trả, bảo hành, review, chat, thông báo và audit trail có controller/service cùng state/ownership checks. Dashboard quản trị và các trang admin không đồng nghĩa mọi API hỗ trợ dữ liệu đều có UI quản lý riêng.

## 5. Tích hợp, xác thực và tác vụ nền

| Luồng | Điểm vào | Ghi chú |
| --- | --- | --- |
| SePay | `POST /api/webhooks/sepay` | Webhook đang dùng; xác minh chữ ký và xử lý payment request |
| Casso tương thích | `POST /api/webhooks/payment` | Endpoint cũ, giữ để tiếp nhận luồng legacy |
| GHN | `POST /api/webhooks/ghn` | Đồng bộ trạng thái vận đơn |
| Telegram | `POST /api/webhooks/telegram` | Webhook bot; outbox được worker xử lý |
| Hết hạn đơn | `/api/cron/expire-orders` | Yêu cầu `CRON_SECRET`; GET/POST |
| Telegram outbox | `/api/cron/process-telegram-outbox` | Yêu cầu `CRON_SECRET`; cron hiện chạy mỗi phút |
| Dọn hội thoại | `/api/cron/purge-conversations` | Endpoint có trong code, chưa được khai báo trong `vercel.json` |

Cron hết hạn đơn và Telegram outbox chấp nhận Bearer header hoặc query secret; endpoint purge hội thoại chỉ nhận Bearer. Dùng header để tránh lưu secret trong URL/log. Chi tiết lịch được đối chiếu từ `vercel.json` trong [CRON_SETUP.md](docs/architecture/CRON_SETUP.md).

API có kiểm tra session, quyền STAFF/ADMIN hoặc quyền sở hữu theo từng miền. Endpoint webhook/cron xác thực riêng bằng secret/chữ ký. Các header bảo mật cơ bản nằm trong `next.config.ts`; không suy luận mức bảo vệ production từ cấu hình mã nguồn đơn lẻ.

## 6. Kiểm thử và lệnh dự án

Các lệnh chính được định nghĩa trong `package.json`:

```bash
npm run test
npm run test:integration
npm run lint
npm run arch:check
npm run build
npm run verify
```

Integration test cần database test riêng. Kết quả trong `docs/verification/` là báo cáo theo ngày/commit được ghi trên từng tài liệu, không phải số liệu kiểm thử mới nhất.

## 7. Tài liệu đối chiếu và giới hạn

- Luồng và route hiện tại: [docs/architecture/PROJECT_FLOWS.md](docs/architecture/PROJECT_FLOWS.md).
- Mô tả theo chức năng: [docs/HE-THONG-CHUC-NANG.md](docs/HE-THONG-CHUC-NANG.md).
- Schema thật: [prisma/schema.prisma](prisma/schema.prisma).
- Cấu hình lịch: [vercel.json](vercel.json).
- Tài liệu kế hoạch, sơ đồ UML tháng 10, báo cáo đánh giá và bản nháp học thuật là hồ sơ lịch sử. Chúng có thể chứa quyết định/số liệu cũ và cần đối chiếu trước khi dùng làm đặc tả hiện hành.

Tài liệu không khẳng định hệ thống đã được triển khai production, dữ liệu demo đã được xác minh thương mại, hoặc các dịch vụ ngoài đã được cấp secret và đang hoạt động.
