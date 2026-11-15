# Coupon creation and product image crash fixes

## Confirmed causes

- `POST /api/admin/coupons` rejected `FREE_SHIPPING` with `discountValue: 0` because it required a positive discount for every type. The user confirmed this exact input.
- The development log recorded `next/image` throwing for uploaded images on `shop-qr-payment.media.nhonhoadev.id.vn`. The uploader's `R2_PUBLIC_DOMAIN` used this host, but `next.config.ts` only allowed the older `media.nhonhoadev.id.vn` host.

## Changes

- Accept zero for free shipping, normalize its discount value to zero, and populate canonical fixed/percentage discount fields for other coupon types.
- Validate discount amounts, limits, dates and flags with actionable Vietnamese errors. Set appropriate defaults and browser validation in the coupon form.
- Allow the exact upload hostname in Next image configuration, retaining the existing image hosts.

## Verification

- Reproduced failures before applying fixes: zero-value free shipping returned 400; the real Next image loader threw for the uploaded image host.
- The four new regression tests pass. Coupon calculation, customer coupon and upload tests also pass in the focused run.
- `tsc --noEmit`, ESLint on all five changed/new code files, `arch:check` and `git diff --check` pass.
- Independent review found no actionable issues in the five code/test files.
- Browser verification: reloaded the local homepage, confirmed the previously failing uploaded image loaded (`complete: true`, positive `naturalWidth`), and opened the existing product `abc` detail page successfully.
- Full unit-test command: 137 of 140 test files pass. Existing failures: `documentation-links.test.ts` and `documentation-model-count.test.ts` require the already-deleted `README.md`; `prisma-model-budget.test.ts` cannot spawn its CLI under the sandbox (`EPERM`). These unrelated files were preserved.
- Integration command exits successfully across 21 files. PostgreSQL coupon checks are opt-in (`COUPON_DATABASE_TEST=1`) and were not enabled; this is not confirmation of a live database write.
- Full repository lint reports 67 existing errors in generated design assets: `designs/shop-qr-dashboard/src/animate-components.js`, `motion-runtime.js`, and `radix-runtime.js`. The scoped lint passes.
- Production build could not be verified in this environment: Turbopack cannot bind an internal port in the sandbox. Automatic approval review rejected running the build outside the sandbox (`PermissionRequest hook denied approval`). A Webpack fallback also failed while reading subprocess output from TypeScript `--showConfig`; direct TypeScript checking passes.

No live coupons/products were created or deleted during verification. Existing workspace changes were preserved.
