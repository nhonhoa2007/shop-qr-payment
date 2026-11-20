# Cron và tác vụ nền

Tài liệu đối chiếu `vercel.json` và các route cron trong repository ngày 20/11/2026. Lịch trong file là cấu hình được commit, không xác nhận job đã được bật trên một môi trường triển khai cụ thể.

## Lịch hiện có

| Endpoint | Lịch trong `vercel.json` | Múi giờ | Tác dụng |
| --- | --- | --- | --- |
| `/api/cron/expire-orders` | `0 0 * * *` | UTC | Hết hạn đơn chưa thanh toán và giải phóng tài nguyên |
| `/api/cron/process-telegram-outbox` | `* * * * *` | UTC | Gửi/retry các thông báo Telegram đang chờ |
| `/api/cron/purge-conversations` | Chưa khai báo | — | Có endpoint dọn hội thoại hết hạn; hiện không có lịch tự gọi trong `vercel.json` |

Cron hết hạn chạy lúc 00:00 UTC (07:00 giờ Việt Nam) mỗi ngày. Hạn thanh toán của đơn là 15 phút (`ORDER_EXPIRATION_MINUTES`), nhưng lịch quét không chạy theo chu kỳ 15 phút. Luồng đọc danh sách đơn cũng gọi kiểm tra hết hạn lười; vì vậy cron hằng ngày không tương đương với việc mọi đơn sẽ được xử lý chính xác tại phút thứ 15.

## Xác thực

Thiết lập `CRON_SECRET` trong môi trường triển khai và gửi qua header:

```http
Authorization: Bearer <CRON_SECRET>
```

`expire-orders` và `process-telegram-outbox` dùng `verifyCronAuth`; helper này cũng chấp nhận query parameter `?secret=...` để tương thích. Endpoint purge hội thoại chỉ kiểm tra Bearer header. Dùng header để tránh đưa secret vào URL, lịch sử proxy hoặc access log.

## Kiểm tra thủ công

Chạy local sau khi đã cấu hình `.env` và ứng dụng:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/expire-orders

curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/process-telegram-outbox
```

Endpoint hết hạn và outbox hỗ trợ GET/POST. Cron purge hội thoại chỉ hỗ trợ POST:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/purge-conversations
```

Các endpoint trả `401` nếu secret thiếu/sai. Kiểm tra response JSON và log runtime; phản hồi thành công cho biết số bản ghi xử lý, không chứng minh dịch vụ ngoài (ví dụ Telegram) đã được cấu hình đúng nếu không có mục việc cần gửi.

## Thay đổi tần suất triển khai

Muốn quét đơn thường xuyên hơn thì cần thay lịch trong `vercel.json` và xác nhận lịch đó được hỗ trợ bởi hosting plan/runtime đang dùng. Không dùng các hướng dẫn cũ về cron-job.org, GitHub Actions hay QStash như cấu hình mặc định của project; repository hiện chỉ khai báo hai lịch ở trên. Khi thay đổi lịch, cập nhật tài liệu này cùng thay đổi cấu hình và xác minh sau deploy.

## Nguồn mã

- [Lịch commit](../../vercel.json)
- [Xác thực cron dùng chung](../../src/server/infrastructure/cron-auth.ts)
- [Xử lý hết hạn đơn](../../src/server/modules/orders/expire-orders.controller.ts)
- [Worker Telegram outbox](../../src/server/modules/telegram/telegram-outbox.controller.ts)
- [Endpoint purge hội thoại](../../src/server/modules/assistant/assistant.controller.ts)
- [Hằng số thời hạn đơn](../../src/shared/constants/index.ts)
