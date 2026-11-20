# PLAN: KẾ HOẠCH TỐI ƯU HÓA CẤU TRÚC THƯ MỤC DỰ ÁN

> **Hồ sơ kế hoạch đã hoàn tất, nhưng chi tiết dưới đây là snapshot ban đầu.** Cấu trúc `@client/@server/@shared` và direct imports đã được áp dụng. Một số đề xuất cũ như shim `src/lib/`/`src/emails/` không còn trong code hiện tại; các checkbox không phải checklist công việc đang mở. Xem [tóm tắt cấu trúc hiện tại](SYSTEM_DESIGN_REFACTOR_STRUCTURE.md).

**Dự án:** `shop-qr-payment`  
**Chỉ huy điều phối:** Tech Lead & System Architect  

---

## 1. PHÂN RÃ CÔNG VIỆC

### GÓI 1: CẤU HÌNH & TÁI CẤU TRÚC SERVER + SHARED (`be-coder`)
- [x] Cập nhật `tsconfig.json` thêm các path aliases `@client/*`, `@server/*`, `@shared/*`.
- [x] Di chuyển `src/emails/*.tsx` vào `src/server/emails/*.tsx`, tạo bridge re-export tại `src/emails/`.
- [x] Mở rộng và chuẩn hóa `src/shared/`:
  - `src/shared/types/index.ts`
  - `src/shared/constants/index.ts`
  - `src/shared/utils/index.ts`
  - `src/shared/validations/index.ts`
  - `src/shared/errors/index.ts`
- [x] Chuẩn hóa các import trong `src/server/modules/*` để gọi trực tiếp `@server/database/prisma` và `@server/infrastructure/*` thay vì qua `src/lib/`.
- [x] Đảm bảo `src/lib/*` tiếp tục hoạt động như Facade ổn định cho `tests/*.test.ts`.

### GÓI 2: CHUẨN HÓA IMPORT PHÍA CLIENT & ROUTING (`fe-coder`)
- [ ] Cập nhật các import trong `src/client/views/*` và `src/client/components/*` sử dụng alias `@shared/*` và `@client/*`.
- [ ] Kiểm tra đảm bảo không có bất kỳ Client component nào import trực tiếp từ `@server/*`.

### GÓI 3: NGHIỆM THU CHẤT LƯỢNG (TECH LEAD & TESTER)
- [ ] Chạy `npm test`: 240/240 tests pass.
- [ ] Chạy `npm run lint`: 0 lỗi, 0 cảnh báo.
- [ ] Chạy `npm run build`: Build production Turbopack thành công.
