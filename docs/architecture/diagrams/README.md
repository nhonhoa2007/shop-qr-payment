# Sơ đồ Shop QR Payment

| Sơ đồ | HTML tự chứa | PNG sáng | PNG tối |
| --- | --- | --- | --- |
| Kiến trúc hệ thống | [system-architecture.html](system-architecture.html) | [system-architecture.png](system-architecture.png) | [system-architecture-dark.png](system-architecture-dark.png) |
| Luồng hoạt động đặt hàng | [system-activity.html](system-activity.html) | [system-activity.png](system-activity.png) | [system-activity-dark.png](system-activity-dark.png) |

Các sơ đồ được tạo bằng skill [stack-diagram](https://github.com/caru-ini/stack-diagram). HTML chứa sẵn font và biểu tượng, mở được khi không có mạng. File `*.draft.html` và [generate_stack_diagrams.py](generate_stack_diagrams.py) là nguồn chỉnh sửa.

Sơ đồ kiến trúc mô tả các thành phần ứng dụng và tích hợp có trong mã nguồn, không khẳng định môi trường triển khai cụ thể. Luồng hoạt động tập trung vào đơn hàng thanh toán bằng VietQR qua SePay; thanh toán ví và hoàn trả là các luồng riêng. Nhánh `PENDING_REVIEW` dành cho webhook hợp lệ nhưng giao dịch không thể tự khớp; chữ ký không hợp lệ bị từ chối trước bước này.

## Mã nguồn đối chiếu

- Tạo đơn, giữ kho, tạo QR: `src/server/modules/orders/orders.controller.ts`
- Đối soát SePay: `src/server/modules/payment/sepay-webhook.controller.ts`
- Ghi nhận thanh toán: `src/server/modules/payment/bank-order-payment.service.ts`
- Duyệt và tạo vận đơn: `src/server/modules/orders/order-fulfillment.service.ts`
- Cập nhật vận chuyển: `src/server/modules/shipping/ghn-webhook.controller.ts`
- Cron: `vercel.json`, `src/app/api/cron/expire-orders/route.ts`
- Các tích hợp khác: `src/server/infrastructure/`, `src/server/modules/upload/upload.service.ts`

## Tái tạo

Cần cài skill vào `~/.codex/skills/stack-diagram`, Python 3.9+, Playwright và Chromium. Chạy `python3 generate_stack_diagrams.py`, rồi `scripts/build.py` và `scripts/render_png.py` theo hướng dẫn của skill. Biểu tượng được tải từ svgl, gilbarbara, Lucide, [SePay](https://sepay.vn/brand-assets.html) và [GHN](https://ghn.vn/); file nguồn biểu tượng được nhúng vào HTML và không lưu riêng trong repo.
