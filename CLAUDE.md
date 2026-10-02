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
Tests use Node.js built-in test runner (`node:test` + `node:assert/strict`) with `--experimental-strip-types`. External databases or cloud services are not required for tests (services provide mock clients and in-memory fallbacks).
- Run all test suites: `npm run test`
- Run a single test file: `node --experimental-strip-types --test tests/<filename>.test.ts`
  - Example: `node --experimental-strip-types --test tests/checkout.test.ts`
  - Example: `node --experimental-strip-types --test tests/inventory.test.ts`
  - Example: `node --experimental-strip-types --test tests/wallet.test.ts`
  - Example: `node --experimental-strip-types --test tests/order-transitions.test.ts`
- Run a specific test name pattern: `node --experimental-strip-types --test --test-name-pattern="<pattern>" tests/<filename>.test.ts`

### Database & Prisma
- Push schema changes to database: `npx prisma db push`
- Generate Prisma Client: `npx prisma generate`
- Run database migrations: `npx prisma migrate dev`
- Seed initial data (Admin & Customer fixtures): `npm run seed`
- Database backup: `npm run db:backup`
- Database restore: `npm run db:restore`

### Documentation
- Regenerate UML diagrams and specification: `npm run docs:uml` (outputs to `docs/uml/`)

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
     - `pusher.ts`: Pusher Server WebSocket instance for broadcasting realtime order and chat events.
     - `resend.ts`: Resend API client for transactional OTP verification and password reset emails.

3. **Shared Kernel (`@shared/*`)**:
   - `src/shared/types/`: Domain models and DTO interfaces shared between client and server.
   - `src/shared/constants/`: Business constants (e.g., `FREE_SHIPPING_THRESHOLD = 500_000`, `STANDARD_SHIPPING_FEE = 30_000`, `ORDER_EXPIRATION_MINUTES = 15`, `MAX_QUANTITY_PER_ITEM = 99`).
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
   - Handles both base `Product` and `ProductVariant` (decrements variant stock while keeping parent product stock synchronized).

2. **Order State Machine FSM (`src/server/modules/orders/orders.fsm.ts`)**:
   - `CANCELLED` is a terminal state; orders in this state cannot be transitioned further.
   - Orders with `paymentStatus === 'EXPIRED'` cannot transition to `PAID` via standard updates (requires explicit reconciliation).
   - Orders cannot transition to `SHIPPING` or `COMPLETED` unless `paymentStatus === 'PAID'`.

3. **Payment & Webhook Idempotency**:
   - **VietQR / Casso Webhook (`/api/webhooks/payment`)**: Parses `DHxxxxxx` order codes from transaction description. Idempotency is guaranteed by the unique constraint on `bankTransId` in the `Transaction` table.
   - **PayOS Integration (`src/server/modules/payment/payos.service.ts`)**: Verifies HMAC-SHA256 signatures over alphabetically sorted payload keys. Mock payment links are strictly disallowed in production (`NODE_ENV === 'production'`).
   - **Wallet Topup (`src/server/modules/wallet/wallet-topup.service.ts`)**: Sessions are cached with 24h TTL in Redis / in-memory store using unique `NAPxxxxx` codes. Duplicate webhook hits are safely ignored.

4. **Internal Wallet & Refund Engine (`src/server/modules/wallet/wallet.service.ts`)**:
   - Order refunds (`refundOrderToWallet`) verify the order is in `PAID` status, use CAS to transition to `REFUNDED` and `CANCELLED`, atomically increment `UserWallet.balance`, create a `WalletTransaction`, and release reserved inventory.

5. **Authentication & Access Control (`src/server/modules/auth/`)**:
   - NextAuth.js JWT session strategy supporting `CUSTOMER`, `STAFF`, and `ADMIN` roles.
   - Admin routes (`/admin/*`) are protected in `src/app/admin/layout.tsx`.
   - Passwords and OTP codes are hashed using BCrypt; OTP verification implements rate limiting and 5-minute expiration.
