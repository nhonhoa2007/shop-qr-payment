# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Development Commands

### Core Workflow
- Start dev server: `npm run dev` (runs on http://localhost:3000)
- Production build: `npm run build`
- Production start: `npm run start`
- Lint: `npm run lint`

### Testing (Node Native Test Runner)
Tests use Node.js built-in test runner (`node:test` + `node:assert/strict`) with `--experimental-strip-types`. External databases or cloud services are not required (services provide mock clients and in-memory fallbacks).
- Run all test suites: `npm run test`
- Run a single test file: `node --experimental-strip-types --test tests/<filename>.test.ts`
  - Example: `node --experimental-strip-types --test tests/checkout.test.ts`
  - Example: `node --experimental-strip-types --test tests/inventory.test.ts`
  - Example: `node --experimental-strip-types --test tests/wallet.test.ts`
  - Example: `node --experimental-strip-types --test tests/order-transitions.test.ts`
  - Example: `node --experimental-strip-types --test tests/webhook-idempotency.test.ts`
  - Example: `node --experimental-strip-types --test tests/geolocation-checkout.test.ts`
- Run a specific test name pattern: `node --experimental-strip-types --test --test-name-pattern="<pattern>" tests/<filename>.test.ts`

### Database, Seed & Utility Scripts
- Push schema changes to database: `npx prisma db push`
- Generate Prisma Client: `npx prisma generate`
- Run database migrations: `npx prisma migrate dev`
- Seed initial data (Admin & Customer fixtures): `npm run seed`
- Database backup: `npm run db:backup`
- Database restore: `npm run db:restore`
- Fetch & compile GHN locations dataset: `npm run ghn:import`
- Trigger order expiration cron locally:
  `curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/expire-orders`

### Documentation
- Regenerate UML diagrams and specification: `npm run docs:uml` (outputs to `docs/uml/`)

### Architecture Verification
- Verify layer boundaries with dependency-cruiser: `npm run arch:check` (0 violations required)

---

## Architecture & Code Organization

The codebase follows a **Layered Clean Architecture** with strict boundaries and path aliases defined in `tsconfig.json`:

```
src/
├── client/   (@client/*)  -> Presentation layer (React 19, Tailwind v4, Zustand stores)
├── server/   (@server/*)  -> Application & Domain logic (Controllers, Services, Infrastructure)
├── shared/   (@shared/*)  -> Shared Kernel (DTOs, Domain Types, Enums, Utils, Constants)
├── app/                   -> Next.js 16 App Router (Thin routing facade & Server Components)
└── lib/                   -> Backward-compatibility re-export shims (forwarding to @server & @shared)
```

### Import Conventions
- **Always use path aliases for workspace imports** (`@client/*`, `@server/*`, `@shared/*`, `@/*`) — in app code, tests, and scripts alike.
- The Node.js test runner cannot resolve `tsconfig.json` paths on its own, so `npm run test` loads `tests/register-alias.mjs`, a resolve hook mapping the same aliases. Tests may therefore import any module by alias, exactly like application code does.
- Relative imports with an explicit `.ts` extension remain valid (used by `src/lib/*` shims); avoid adding new ones outside the shims.
- Boundaries are enforced, not just documented — `npm run arch:check` (dependency-cruiser, config in `.dependency-cruiser.cjs`) fails on: `@client` → `@server`, `@client` → `@prisma/client`, and any dependency from `@shared` back into `@client`/`@server`.

### Layer Responsibilities & Rules
1. **Presentation Layer (`@client/*`)**:
   - `src/client/views/`: Page-level composite views (`HomeView`, `ProductDetailView`, `CartView`, `AdminDashboardView`, etc.).
   - `src/client/components/`: Domain-grouped UI components (`admin/`, `auth/`, `cart/`, `chat/`, `home/`, `layout/`, `product/`, `wallet/`).
   - `src/client/stores/`: Client state management using Zustand with `persist` middleware (`cart-store.ts`, `wishlist-store.ts`).
   - **Zero Server Leakage Rule**: `@client` components must **never** import from `@server` or `@prisma/client`. Server database files enforce this with runtime guards (`if (typeof window !== 'undefined') throw ...`). Client communicates with the backend exclusively via HTTP API routes or Pusher WebSockets.

2. **Application & Domain Layer (`@server/*`)**:
   - `src/server/modules/`: Feature-sliced business domains (`orders/`, `inventory/`, `wallet/`, `payment/`, `shipping/`, `admin/`, `auth/`, `catalog/`, `chat/`, `notifications/`, `reviews/`, `wishlist/`).
     - Modules follow the pattern of `.service.ts` (business transactions), `.controller.ts` (HTTP handlers), or `.fsm.ts` (state machines).
   - `src/server/database/prisma.ts`: Singleton PrismaClient instance with logging configuration.
   - `src/server/infrastructure/`:
     - `redis.ts`: Hybrid Upstash REST Redis client with an automatic **in-memory Map fallback** for local offline development and unit tests.
     - `rate-limit.ts`: IP-based sliding window rate-limiter using Redis/Memory.
     - `pusher.ts`: Pusher Server WebSocket instance for broadcasting realtime order, chat, and notification events.
     - `resend.ts`: Resend API client for transactional OTP verification and password reset emails.

3. **Shared Kernel (`@shared/*`)**:
   - `src/shared/types/`: Domain models and DTO interfaces shared between client and server.
   - `src/shared/constants/`: Business constants (e.g., `FREE_SHIPPING_THRESHOLD = 500_000`, `STANDARD_SHIPPING_FEE = 30_000`, `ORDER_EXPIRATION_MINUTES = 15`, `MAX_QUANTITY_PER_ITEM = 99`, `vietnam-locations.ts`).
   - `src/shared/utils/`: Pure utilities (`formatVND`, `generateOrderCode`, date & countdown helpers).

4. **App Router Facade (`src/app/`)**:
   - Server Components fetch data directly using `@server/modules/*` services and pass props to `@client/views/*`.
   - Route handlers (`src/app/api/**/route.ts`) act as thin delegation proxies, e.g.:
     `export { POST } from '@/server/modules/orders/orders.controller';`
   - **Next.js 16 Note**: `searchParams` and `params` in Page components are asynchronous Promises (`await searchParams`).

---

## Critical Business Invariants & Concurrency Rules

1. **Atomic Stock Reservation (Race-Condition Prevention)**:
   - Implemented in `src/server/modules/inventory/inventory.service.ts` (`reserveOrderStock`).
   - Executes inside a Prisma `$transaction` using atomic compare-and-swap (CAS):
     `where: { id, stock: { gte: quantity }, isActive: true }`, `data: { stock: { decrement: quantity } }`.
   - If `updateMany` returns `count === 0`, stock is insufficient and the transaction rolls back immediately.
   - Handles both base `Product` and `ProductVariant` (decrements variant stock while keeping parent product stock synchronized: `Product.stock` = sum of variants).

2. **Order State Machine FSM (`src/server/modules/orders/orders.fsm.ts`)**:
   - Progression: `PENDING → CONFIRMED → PROCESSING → SHIPPING → COMPLETED`.
   - Payment states: `UNPAID → PAID → (REFUNDED | EXPIRED)`.
   - `CANCELLED` is a terminal state; orders in this state cannot be transitioned further.
   - Orders with `paymentStatus === 'EXPIRED'` cannot transition to `PAID` via standard updates.
   - Orders cannot transition to `SHIPPING` or `COMPLETED` unless `paymentStatus === 'PAID'` (except COD shipping flows handled by carrier webhook).
   - Order expiry: Unpaid orders expire after 15 minutes (`ORDER_EXPIRATION_MINUTES`). Cron/lazy checks transition them to `CANCELLED` + `EXPIRED`, releasing inventory and rolling back coupon usage.

3. **Payment & Webhook Idempotency**:
   - **VietQR / Casso Webhook (`/api/webhooks/payment`)**: Parses `DHxxxxxx` order codes and `NAPxxxxxx` wallet top-up codes from transaction description. Idempotency is guaranteed by the unique constraint on `bankTransId` in the `Transaction` table. Underpaid transfers are rejected without marking the order `PAID`.
   - **Wallet Topup (`src/server/modules/wallet/wallet-topup.service.ts`)**: Top-up sessions are cached with 24h TTL in Redis / in-memory store using unique `NAPxxxxx` codes and a static VietQR QR (`img.vietqr.io`). Processing uses a 4-layer concurrency guard (session state check -> Redis distributed lock `setNx` 15s -> existing transaction check -> CAS balance increment).

4. **Internal Wallet & Refund Engine (`src/server/modules/wallet/wallet.service.ts`)**:
   - **Wallet Payment**: Uses CAS decrement `where: { balance: { gte: totalAmount } }` inside a transaction.
   - **Order Refunds (`refundOrderToWallet`)**: Verifies order is in `PAID` status, uses CAS `updateMany({ where: { paymentStatus: 'PAID' } })` to ensure single execution (prevents double refund), atomically increments `UserWallet.balance`, records `REFUND` `WalletTransaction`, and releases reserved inventory.

5. **Shipping & GHN Carrier Lifecycle (`src/server/modules/shipping/`)**:
   - Moving order to `PROCESSING` automatically creates GHN shipment (`createGHNShipment`).
   - Webhook `/api/webhooks/ghn` (secured with `GHN_WEBHOOK_TOKEN`) synchronizes carrier events: `delivering → SHIPPING`, `delivered → COMPLETED` (for COD shipments, automatically reconciles `paymentStatus = PAID`), `cancel/return → CANCELLED + releaseOrderStock`.
   - Geolocation reverse pipeline: W3C Geolocation (with 20s timeout watchdog) -> `POST /api/shipping/geocode/reverse` -> Nominatim (OSM) / BigDataCloud fallback -> IP location (`ip-api.com`), fuzzy-matched against GHN administrative location dataset.

6. **Coupons & Verified Product Reviews**:
   - **Coupons**: Validates active state, expiry, `usageLimit`, `perUserLimit`, and `minOrderAmount`. Decrements limit on order placement; rolls back count on order cancellation or expiration.
   - **Reviews**: Verified purchaser rule enforced by `resolveReviewEligibility` (user must have a `COMPLETED` order containing the product). Database constraint `@@unique([productId, userId, orderId])` prevents duplicate reviews for the same order item.

7. **Realtime Topology (Pusher)**:
   - Channels:
     - `private-user-<userId>`: User-specific order status, payment notifications, and wallet events.
     - `private-admin-channel`: New orders, incoming payments, and `analytics-updated` dashboard triggers.
     - `private-chat-<roomId>`: Dedicated order-specific chat between buyer and admin staff.
   - Endpoint `/api/pusher/auth` validates session ownership and RBAC permissions before granting subscription tokens.

8. **Authentication, RBAC & Rate Limiting (`src/server/modules/auth/`, `src/server/modules/admin/`)**:
   - NextAuth.js JWT session strategy with `CUSTOMER`, `STAFF`, and `ADMIN` roles.
   - **Staff Permission Matrix**: `StaffPermission` model mapping granular operator privileges (`orders`, `products`, `shipments`, `chat`, `reviews`). Helper `requireOperatorPermission(permission)` and `resolveOperatorAccess()` enforce least-privilege access for STAFF while ADMIN automatically bypasses checks. Financial metrics, VietQR reconciliation, coupon creation, user role changes, and permanent deletions remain strictly restricted to ADMIN.
   - BCrypt password and OTP hashing (cost 12); OTP expiration (5 min) with 60-second cooldown and 5-attempt lockout.
   - Sliding-window rate limiters on sensitive endpoints: order creation (10/min), auth OTP (3-5/min), wallet topup (15/min).
