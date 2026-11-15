# Coupon discovery verification — 2026-11-15

## Delivered behavior

- Public `/coupons` hub, homepage preview, desktop/mobile navigation, cart discovery link.
- Optional account bookmarks with owner-scoped API; direct coupon entry remains supported, including private codes.
- Checkout selection displays actual savings and eligibility reasons. Canonical fixed/percentage fields and integer VND calculations match server discount rules.
- Checkout sidebar receives totals from the form, including voucher discounts and whether shipping has been quoted, instead of displaying a conflicting independent estimate.
- Admin publishing independent of activation; all preexisting coupons remain private unless deliberately published.
- Atomic PostgreSQL bookmarks, 100 extant-coupon capacity, stale-ID pruning on save, no usage reservation.
- Existing coupon validation now serializes BigInt money before JSON output.

## Executed checks

- `npm run test`: **1,135 passed, 0 failed** (outside sandbox because baseline CLI subprocess tests otherwise hit EPERM).
- `npm run test:integration`: **77 passed, 0 failed, 1 skipped**. The skipped test is the explicitly opt-in real-PostgreSQL coupon test, run separately below.
- `COUPON_DATABASE_TEST=1 node --env-file=.env --experimental-strip-types --import ./tests/register-alias.mjs --test tests/integration/customer-coupons-postgres.test.ts`: **1 passed** against local PostgreSQL. Exercises duplicate/distinct concurrent saves, cap, stale bookmarks after deletion, private visibility, private direct-code validation and BigInt serialization. Fixtures are deleted in `finally`.
- `npx tsc --noEmit`: passed.
- Final targeted checkout/coupon/geolocation run after sidebar synchronization: **22 passed, 0 failed**.
- `node node_modules/next/dist/bin/next build --webpack`: **passed**, including TypeScript, page collection, prerender of **69 pages**, optimization and traces.
- ESLint on all changed application files: passed, no errors/warnings.
- `npm run arch:check`: passed.
- `npx prisma validate`: passed.
- `npm run schema:budget -- --lock-registry`: passed, **35 models**, no registry changes.
- `git diff --check`: passed.
- `npx prisma generate`: succeeded after sandbox escalation.
- `npx prisma migrate deploy`: applied only `20261115000100_coupon_discovery` to local `shopqr` PostgreSQL.

## Review fixes

A fresh reviewer identified two issues, both fixed:

1. Deleted coupon IDs could silently consume account capacity. Reproduced against PostgreSQL (failed before fix); save now atomically filters missing coupon IDs and counts only extant coupons. Real database test then passed.
2. Save API assumed zero prior per-account usage. Added a failing regression test, then queried claimed orders before allowing a new save. All nine coupon policy/service tests pass.

## Browser verification

Restarted only the Next.js dev server belonging to this repository after regenerating Prisma Client. Public/saved endpoints then returned 200. In Chrome, verified hub/navigation, empty saved wallet, cart discovery link, saving a disposable public voucher, finding it in “Voucher của tôi”, selecting it at checkout, and entering its code directly. Both checkout totals displayed 10,000 VND before / 9,000 VND after the 1,000 VND discount. No order/payment was submitted. Removed the disposable coupon and its bookmarks after verification. Screenshot: `assets/coupon-discovery/checkout-applied.jpg`.

## Existing verification limitations and resolved environment issues

- Repository-wide `npm run lint` scans generated/minified files under `designs/shop-qr-dashboard/src/`, which have existing React hook errors; changed application files pass targeted lint.
- Turbopack cannot create its worker/port in the sandbox. Automatic approval initially rejected elevated `npm run build`. The safer direct invocation of the installed Next.js Webpack compiler was subsequently approved; both compile mode and the final full production build passed. There is no remaining production-build blocker.
- Browser initially encountered the old in-memory Prisma Client; restarting the verified project dev process resolved this. Restart remains required when deploying the new generated client/schema.

## Operating notes

Use `/admin/coupons` to explicitly publish intended offers; merely activating a coupon does not make a private code discoverable. Deployments need the additive migration and a server restart/new build with the generated Prisma Client. Saving is only a bookmark and never guarantees remaining usage.
