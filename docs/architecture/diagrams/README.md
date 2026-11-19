# Shop QR Payment — bản đồ toàn bộ chức năng

Mở [project-flows.html](project-flows.html) để xem atlas tương tác gồm 7 sơ đồ và bảng coverage. Atlas là file HTML tự chứa, có nút đổi sáng/tối, mục lục, mô tả theo luồng và đường dẫn đối chiếu tới mã nguồn.

[PROJECT_FLOWS.md](../PROJECT_FLOWS.md) là bản đọc Markdown, có ảnh minh họa, mô tả chi tiết và danh sách đầy đủ trang/API cùng controller.

## Các sơ đồ riêng

| Phần | HTML | PNG sáng | PNG tối |
| --- | --- | --- | --- |
| Kiến trúc tổng thể | [01-system-map.html](01-system-map.html) | [01-system-map.png](01-system-map.png) | [01-system-map-dark.png](01-system-map-dark.png) |
| Tài khoản, OTP, RBAC | [02-identity-access.html](02-identity-access.html) | [02-identity-access.png](02-identity-access.png) | [02-identity-access-dark.png](02-identity-access-dark.png) |
| Checkout và thanh toán | [03-order-lifecycle.html](03-order-lifecycle.html) | [03-order-lifecycle.png](03-order-lifecycle.png) | [03-order-lifecycle-dark.png](03-order-lifecycle-dark.png) |
| Ví, GHN và ngoại lệ | [04-wallet-shipping.html](04-wallet-shipping.html) | [04-wallet-shipping.png](04-wallet-shipping.png) | [04-wallet-shipping-dark.png](04-wallet-shipping-dark.png) |
| Kho, đổi trả, bảo hành | [05-inventory-aftersales.html](05-inventory-aftersales.html) | [05-inventory-aftersales.png](05-inventory-aftersales.png) | [05-inventory-aftersales-dark.png](05-inventory-aftersales-dark.png) |
| Chat, realtime, Telegram | [06-admin-realtime-telegram.html](06-admin-realtime-telegram.html) | [06-admin-realtime-telegram.png](06-admin-realtime-telegram.png) | [06-admin-realtime-telegram-dark.png](06-admin-realtime-telegram-dark.png) |
| AI và catalog intelligence | [07-ai-catalog-intelligence.html](07-ai-catalog-intelligence.html) | [07-ai-catalog-intelligence.png](07-ai-catalog-intelligence.png) | [07-ai-catalog-intelligence-dark.png](07-ai-catalog-intelligence-dark.png) |

## Nguồn và tái tạo

- Script dựng: [scripts/build-architecture-diagrams.py](../../../scripts/build-architecture-diagrams.py)
- Script render và kiểm tra: [scripts/render-architecture-diagrams.mjs](../../../scripts/render-architecture-diagrams.mjs)
- Ghi chú nội dung: [atlas-notes.html](atlas-notes.html)
- Kiểm tra render: [verification.json](verification.json)
- Chạy lại: `python3 scripts/build-architecture-diagrams.py`
- Render PNG: `node scripts/render-architecture-diagrams.mjs` (Playwright + Chromium). Có thể đặt `PLAYWRIGHT_MODULE` và `CHROMIUM_EXECUTABLE` để dùng runtime riêng; mặc định hỗ trợ runtime Codex cục bộ hoặc package Playwright đã cài.
- PNG được render từ HTML bằng Chromium/Playwright; HTML là nguồn hiển thị chính.

Các sơ đồ mô tả mã nguồn hiện tại. Chúng không khẳng định secret, biến môi trường, lịch triển khai hoặc dịch vụ ngoài đã được cấu hình trong môi trường production.

## Sơ đồ có sẵn trước bản atlas

- [Kiến trúc hệ thống](system-architecture.html) · [PNG sáng](system-architecture.png) · [PNG tối](system-architecture-dark.png)
- [Luồng đặt hàng VietQR](system-activity.html) · [PNG sáng](system-activity.png) · [PNG tối](system-activity-dark.png)

Các bản này được giữ lại để tham khảo. Bộ 01–07 mở rộng phạm vi sang tài khoản, ví, kho, hậu mãi, chat, Telegram và AI.
