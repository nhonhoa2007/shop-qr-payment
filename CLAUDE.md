# Hướng dẫn làm việc trong repository

@AGENTS.md

## Lệnh phát triển

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run arch:check
npm run test
npm run test:integration
npm run verify
```

`npm run test` dùng Node.js test runner và `tests/register-alias.mjs`. Khi chạy một test riêng, giữ lại alias loader:

```bash
node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/<file>.test.ts
```

Integration test cần database PostgreSQL test riêng. Không chạy seed, migration, import catalog hoặc script backup/restore lên database không xác định.

## Cấu trúc mã nguồn

```text
src/
├── app/       Next.js pages, Server Components và route handlers
├── client/    Views, components, hooks, stores và browser infrastructure
├── server/    Domain modules, database, email và infrastructure
├── shared/    DTOs, types, validations, constants và tiện ích dùng chung
└── types/     Khai báo type mở rộng
```

Alias trong `tsconfig.json`: `@/*`, `@client/*`, `@server/*`, `@shared/*`. Dùng alias cho import xuyên miền; relative import phù hợp giữa các tệp trong cùng module. `src/lib/` không còn là lớp facade. Route handler ở `src/app/api` thường export controller từ `src/server/modules`; Server Component có thể gọi service trực tiếp.

Ranh giới được kiểm tra bằng `npm run arch:check`: `src/client` không phụ thuộc `src/server`/Prisma và `src/shared` không phụ thuộc ngược vào hai tầng. Trước khi sửa API Next.js, đọc hướng dẫn tương ứng tại `node_modules/next/dist/docs/` như yêu cầu trong `AGENTS.md`.

## Mô hình nghiệp vụ và quy tắc quan trọng

- PostgreSQL/Prisma là nguồn dữ liệu nghiệp vụ. Schema hiện có 35 model; xem `prisma/schema.prisma` và `docs/architecture/prisma-model-registry.md`.
- Tiền dùng `BigInt` ở database và serialize qua `MoneyVnd` khi trả API. Không chuyển tiền sang JavaScript `number` nếu có nguy cơ mất chính xác.
- Giá, tồn kho, coupon, phí giao và compatibility phải được xác nhận phía server khi đặt đơn.
- Kho dùng `InventoryMovement` làm ledger cùng projection tồn; nhập, giữ, giao, điều chỉnh và đổi trả cần đi qua service nghiệp vụ, không sửa trực tiếp số dư tùy tiện.
- Đơn hết hạn nghiệp vụ sau 15 phút. `vercel.json` hiện quét hết hạn mỗi ngày lúc 00:00 UTC, chạy Telegram outbox mỗi phút; kiểm tra lười cũng tồn tại trong luồng đọc đơn. Đừng mô tả lịch quét là mỗi 15 phút.
- Thanh toán hiện tại dùng PaymentRequest và webhook SePay (`/api/webhooks/sepay`). Casso (`/api/webhooks/payment`) là đường tương thích cũ. Ledger ngân hàng hiện dùng `BankTransfer`, không dùng model `Transaction` đã retired.
- Wallet, payment, fulfillment và hậu mãi có idempotency/state checks; duy trì transaction và CAS hiện có khi thay đổi luồng.
- NextAuth Credentials dùng JWT. Password/OTP hash bằng Argon2id. STAFF cần permission module; ADMIN có quyền operator đầy đủ và các route nhạy cảm có thể yêu cầu ADMIN riêng.
- AI assistant có commerce resolver xác định; provider HTTP chỉ chọn khi có `AI_API_BASE_URL` hoặc `AI_API_KEY`, nếu không dùng fake provider. `AI_PROVIDER` trong `.env.example` hiện không phải biến chọn provider trong resolver.
- Dữ liệu catalog demo là tổng hợp, không phải bằng chứng giá/thông số thương mại.

## Tích hợp ngoài

`.env.example` là danh sách cấu hình mẫu. GHN, SePay, Resend, Pusher, Redis/Upstash, Telegram, R2/Cloudinary và AI chỉ hoạt động khi môi trường triển khai có cấu hình hợp lệ. Không suy ra production readiness chỉ từ việc có module hoặc route.

## Tham khảo

- [README](README.md) — cài đặt và lệnh dự án
- [Luồng và API hiện tại](docs/architecture/PROJECT_FLOWS.md)
- [Phân tích kiến trúc](SYSTEM_DESIGN.md)
- [Thiết lập cron](docs/architecture/CRON_SETUP.md)
