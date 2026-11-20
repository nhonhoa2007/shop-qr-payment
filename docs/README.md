# Tài liệu Shop QR Payment

Tài liệu này phân biệt hướng dẫn mô tả hiện trạng với hồ sơ được giữ lại từ các đợt triển khai trước. Mã nguồn và cấu hình hiện tại là căn cứ cuối cùng khi có khác biệt.

## Đọc để hiểu hệ thống hiện tại

| Tài liệu | Nội dung |
| --- | --- |
| [README dự án](../README.md) | Cài đặt, lệnh phát triển và liên kết nhanh |
| [PROJECT_FLOWS.md](architecture/PROJECT_FLOWS.md) | Luồng vận hành hiện tại, bản đồ trang/API và liên kết tới mã nguồn |
| [HE-THONG-CHUC-NANG.md](HE-THONG-CHUC-NANG.md) | Tóm tắt chức năng theo nhóm người dùng |
| [SYSTEM_DESIGN.md](../SYSTEM_DESIGN.md) | Phân tích kiến trúc, dữ liệu, ranh giới tích hợp và các giới hạn đã biết |
| [CRON_SETUP.md](architecture/CRON_SETUP.md) | Lịch cron có trong repository và cách xác thực endpoint |
| [prisma-model-registry.md](architecture/prisma-model-registry.md) | Danh mục model Prisma và giới hạn schema |
| [DESIGN.md](architecture/DESIGN.md) | Token giao diện đang dùng trong ứng dụng |
| [Sơ đồ kiến trúc](architecture/diagrams/README.md) | Atlas luồng hiện tại, ảnh và HTML tương tác |

## Hồ sơ thiết kế và lịch sử

- `architecture/PLAN_*.md`, `architecture/SYSTEM_DESIGN_*.md`, `superpowers/plans/` và `superpowers/specs/` ghi lại kế hoạch/đặc tả tại thời điểm tạo; trạng thái checkbox và quyết định trong đó không tự động phản ánh code hiện tại.
- `verification/` và tài liệu có ngày trong `data/` là bằng chứng hoặc snapshot của một lần kiểm tra cụ thể. Không dùng số liệu cũ ở đó như kết quả kiểm thử hiện tại.
- [Bộ UML](uml/README.md) là gói sơ đồ học thuật ngày 18/10/2026, trước các thay đổi gần đây về thanh toán và vận hành. Dùng [PROJECT_FLOWS.md](architecture/PROJECT_FLOWS.md) cho mô tả hiện trạng.
- Tài liệu học thuật trong `academic/` là bản nháp, cần đối chiếu lại với mã nguồn và báo cáo kiểm chứng mới trước khi nộp hoặc xuất bản; xem [README học thuật](academic/README.md).

## Sinh tài liệu

- `npm run docs:uml` sinh lại bộ UML lịch sử từ `scripts/generate-uml.js`.
- Atlas kiến trúc là HTML/ảnh được lưu trong `architecture/diagrams/`; hướng dẫn dựng và kiểm tra nằm trong [README sơ đồ](architecture/diagrams/README.md).
- `npm run ghn:import` cập nhật dữ liệu địa bàn GHN tại `src/shared/constants/vietnam-locations.ts`.

---

Cập nhật chỉ mục: 20/11/2026.
