# Thiết kế tái cấu trúc project — hồ sơ đã hoàn tất

> Tài liệu này ghi lại đề xuất tại thời điểm tái cấu trúc và đã lỗi thời ở một số chi tiết triển khai. Dùng [SYSTEM_DESIGN.md](../../SYSTEM_DESIGN.md) và [PROJECT_FLOWS.md](PROJECT_FLOWS.md) để xem cấu trúc hiện tại.

## Kết quả hiện tại

Ứng dụng đã tách mã nguồn theo `src/app`, `src/client`, `src/server`, `src/shared` và `src/types`. Alias `@/*`, `@client/*`, `@server/*`, `@shared/*` được cấu hình trong `tsconfig.json`. Dependency-cruiser kiểm tra ranh giới import qua `npm run arch:check`.

Client không được phụ thuộc vào `src/server` hoặc Prisma; shared không được phụ thuộc ngược vào client/server. `src/app` là lớp tích hợp của Next.js, nhưng Server Component có thể gọi service server trực tiếp, nên không phải mọi page đều là facade chỉ export một view.

## Những chi tiết trong đề xuất cũ không còn đúng

- `src/lib/` không còn tồn tại như lớp facade/re-export trong kiến trúc hiện tại.
- `src/emails/` không còn là lớp bridge đang dùng; email nằm dưới `src/server/emails/`.
- Bộ test dùng `tests/register-alias.mjs` để nạp alias khi chạy Node test runner.
- Kết quả test/build cần xem từ lần chạy mới hoặc báo cáo có ngày cụ thể; con số 240 tests trong kế hoạch không phải baseline hiện hành.

## Liên kết tham chiếu

- [Kế hoạch tái cấu trúc gốc](PLAN_REFACTOR_STRUCTURE.md)
- [Cấu hình alias](../../tsconfig.json)
- [Quy tắc dependency-cruiser](../../.dependency-cruiser.cjs)
- [Script kiểm tra kiến trúc](../../package.json)
