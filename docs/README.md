# 📚 Chỉ mục Tài liệu — Shop QR Payment

Toàn bộ tài liệu phân tích, thiết kế và vận hành của dự án. Xem thêm hướng dẫn cài đặt tại [README.md gốc](../README.md).

## Tài liệu chính

| Tài liệu | Nội dung | Dành cho |
| :--- | :--- | :--- |
| **[HE-THONG-CHUC-NANG.md](./HE-THONG-CHUC-NANG.md)** | 14+ luồng chức năng hoạt động ra sao & tại sao: catalog, checkout, GPS, VietQR, ví, FSM đơn hàng, GHN, chat, OTP, RBAC, dashboard… — đối chiếu trực tiếp với mã nguồn (đường dẫn file kèm theo) | Người bảo trì, người mới vào dự án |
| **[../SYSTEM_DESIGN.md](../SYSTEM_DESIGN.md)** | Phân tích & thiết kế hệ thống (v3.0): yêu cầu chức năng, kiến trúc 3 lớp, ERD, đặc tả API, 6 phân hệ mở rộng — **tất cả đã triển khai xong** | Đồ án / hồ sơ thiết kế |
| **[uml/README.md](./uml/README.md)** | Bộ **21 sơ đồ UML** chuẩn 2.5: use case, class/domain, sequence (VietQR, ví, hủy đơn, chat, GHN, OTP), activity (giữ kho, webhook, GPS), state machine (đơn hàng, vận đơn), component, deployment, package. Kèm [bảng xem trực tuyến](./uml/index.html) mở bằng trình duyệt | Thuyết trình, tài liệu đồ án |
| **[architecture/DESIGN.md](./architecture/DESIGN.md)** | Style reference UI: token màu (Shop Violet `#5433eb`), typography, radii — chuẩn cho mọi thiết kế giao diện | Thiết kế UI |

## Kiến trúc & hồ sơ triển khai (`docs/architecture/`)

Tất cả các đợt phát triển lớn dưới đây **đã hoàn thành** — tài liệu giữ làm hồ sơ thiết kế gốc và tham chiếu bảo trì:

| Tài liệu | Phạm vi |
| :--- | :--- |
| **[SYSTEM_DESIGN_REFACTOR_STRUCTURE.md](./architecture/SYSTEM_DESIGN_REFACTOR_STRUCTURE.md)** + [PLAN](./architecture/PLAN_REFACTOR_STRUCTURE.md) | Tái cấu trúc Layered Clean Architecture `@client` / `@server` / `@shared`, path aliases, shims `src/lib/` |
| **[SYSTEM_DESIGN_AUTH_ADMIN_RBAC.md](./architecture/SYSTEM_DESIGN_AUTH_ADMIN_RBAC.md)** + [PLAN](./architecture/PLAN_AUTH_ADMIN_RBAC.md) | Quên/đặt lại mật khẩu bằng OTP, RBAC CUSTOMER/STAFF/ADMIN, ma trận phân quyền STAFF |
| **[SYSTEM_DESIGN_ADMIN_REDESIGN.md](./architecture/SYSTEM_DESIGN_ADMIN_REDESIGN.md)** + [PLAN](./architecture/PLAN_ADMIN_REDESIGN.md) | Dashboard admin SaaS Bento Grid, AdminSidebar/AdminTopbar, analytics 21 metrics |
| **[CRON_SETUP.md](./architecture/CRON_SETUP.md)** | 3 phương án chạy cron hủy đơn quá hạn 5 phút/lần miễn phí (cron-job.org, GitHub Actions, Upstash QStash) |

## Tài nguyên sinh tự động

- `docs/uml/` — sinh lại bằng **`npm run docs:uml`** (script `scripts/generate-uml.js`): 21 file `.mmd` + `README.md` + `index.html`.
- `src/shared/constants/vietnam-locations.ts` — sinh lại bằng **`npm run ghn:import`** (dataset địa giới 63 tỉnh của GHN).

---
*Cập nhật lần cuối: 10/2026.*
