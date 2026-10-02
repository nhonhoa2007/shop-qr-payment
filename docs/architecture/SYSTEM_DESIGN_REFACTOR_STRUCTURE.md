# SYSTEM DESIGN: CHUẨN HÓA CẤU TRÚC THƯ MỤC DỰ ÁN (PROJECT STRUCTURE STANDARDIZATION)

**Dự án:** `shop-qr-payment`  
**Chỉ huy thiết kế:** Tech Lead & System Architect  
**Mục tiêu:** Xóa bỏ Technical Debt (Junk Drawer Antipattern trong `src/lib/`), tách biệt tường minh các phân khu Client / Server / Shared, thiết lập Path Aliases và đảm bảo 100% tests & build pass.

---

## 1. NGUYÊN TẮC THIẾT KẾ (ARCHITECTURAL INVARIANTS)

1. **Ranh giới Môi trường Tuyệt đối (Environment Boundary):**
   - `@client/*` (`src/client/`): Chỉ chứa mã nguồn chạy trên trình duyệt (UI, Components, Views, Hooks, Stores). Tuyệt đối **KHÔNG ĐƯỢC** import trực tiếp `@server/*` hoặc Prisma DB.
   - `@server/*` (`src/server/`): Chỉ chứa mã nguồn chạy trên Node.js server (Controllers, Services, Database, Infrastructure, Emails).
   - `@shared/*` (`src/shared/`): Chứa mã nguồn dùng chung an toàn (Pure Functions, Types/DTOs, Constants, Validations) không phụ thuộc vào Node.js hay Browser API.
2. **Thin Routing Layer:**
   - `src/app/`: Giữ nguyên vai trò adapter định tuyến cực mỏng, chỉ export views từ `@client/views` hoặc handlers từ `@server/modules`.
3. **Bảo toàn Khả năng Tương thích Ngược (Zero Breaking Changes):**
   - Bộ kiểm thử Node native test runner (`node --experimental-strip-types --test`) sử dụng relative import từ `tests/*.test.ts`. Các module trong `src/lib/` tiếp tục đóng vai trò Facade Re-export ổn định để không làm đứt gãy 240 ca test hiện có.

---

## 2. BẢN ĐỒ CẤU HÌNH PATH ALIASES (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@client/*": ["./src/client/*"],
      "@server/*": ["./src/server/*"],
      "@shared/*": ["./src/shared/*"]
    }
  }
}
```

---

## 3. CÁC HẠNG MỤC CẢI TIẾN TRỌNG TÂM

### A. Tái định vị `src/emails/` vào `src/server/emails/`
- Chuyển `OtpVerification.tsx` và `PasswordResetEmail.tsx` vào `src/server/emails/`.
- `src/emails/` giữ các file re-export bắc cầu để bảo toàn tương thích:
  ```typescript
  // src/emails/OtpVerification.tsx
  export { OtpVerificationEmail } from '@/server/emails/OtpVerification';
  ```

### B. Củng cố và Mở rộng Phân khu Dùng chung (`src/shared/`)
- `src/shared/types/index.ts`: Gom toàn bộ type definitions từ `src/types/index.ts` và các DTO dùng chung.
- `src/shared/constants/index.ts`: Hằng số toàn sàn (ngưỡng freeship, mã trạng thái đơn, cấu hình phân trang).
- `src/shared/utils/index.ts`: Pure utilities (`formatVND`, `formatDate`, `generateOrderCode`).
- `src/shared/validations/index.ts`: Validation helpers (`isValidPhoneNumber`, `isValidEmail`, `parseOrderItems`).
- `src/shared/errors/index.ts`: Định nghĩa `AppError`, `ValidationError`, `AuthError`.

### C. Chuẩn hóa Gọi trực tiếp trong `src/server/`
- Trong `src/server/modules/*`: Thay thế các import gián tiếp qua `src/lib/` bằng đường dẫn nội bộ trực tiếp:
  - `@/lib/prisma` $\rightarrow$ `@server/database/prisma`
  - `@/lib/pusher-server` $\rightarrow$ `@server/infrastructure/pusher`
  - `@/lib/rate-limit` $\rightarrow$ `@server/infrastructure/rate-limit`
  - `@/lib/redis` $\rightarrow$ `@server/infrastructure/redis`
  - `@/lib/inventory` $\rightarrow$ `@server/modules/inventory/inventory.service`
  - `@/lib/wallet` $\rightarrow$ `@server/modules/wallet/wallet.service`
  - `@/lib/ghn` $\rightarrow$ `@server/modules/shipping/ghn.service`

---

## 4. TIÊU CHÍ NGHIỆM THU (QUALITY GATES)
1. `npm test`: **240/240 tests PASS (100%)**.
2. `npm run lint`: **0 lỗi, 0 cảnh báo**.
3. `npm run build`: **Biên dịch Production thành công 100% (42 routes)**.
