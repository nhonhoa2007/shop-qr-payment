# Khám phá ưu đãi và voucher đã lưu

## Intent and accepted approach

Customers currently have to know a code before checkout. The user chose a voucher hub and account wallet, with saving optional: customers can still enter a code directly. This records the short design presented and accepted in the conversation.

## Approaches

- Public listing and direct selection only: smallest implementation, no account collection.
- **Selected:** public offers, account-saved vouchers, checkout selection and manual entry. Saving is a bookmark, never a reservation or usage claim.
- Mandatory claim before redemption: rejected because it adds checkout friction.

## Experience

- `/coupons` has “Tất cả ưu đãi” and “Voucher của tôi”. Guests can browse and sign in to save.
- Home shows up to three ongoing offers and a link to the hub. Desktop/mobile navigation includes “Ưu đãi”.
- Cards show discount, cap, minimum order, expiry, per-account limit and save/remove actions. Saved vouchers retain expired/exhausted status.
- Checkout displays public and saved offers with actual savings and specific ineligibility reasons; choosing one validates it through the existing server API. Manual entry remains supported, including private codes.
- Admin can publish/unpublish a code independently of activating it. Existing and newly created coupons default to private until explicitly published.

## Data and boundaries

Use `Coupon.isPublic` and an account-owned `User.savedCouponIds` PostgreSQL array (maximum 100 saves). Keep the existing 35-model budget. Mutations use parameterized atomic SQL so concurrent saves neither duplicate nor overwrite each other. Only public, ongoing, available coupons may be newly saved. An already saved code remains visible to its owner if unpublished.

Public APIs explicitly select coupon display fields. Personalized responses use private/no-store cache headers. Saving/removing never changes coupon usage, and no save requirement is added to order validation. Existing redemption rules remain authoritative.

## Validation

Cover visibility, expired/future/disabled/exhausted states, per-user usage, minimum order, exact monetary previews, independent account ownership, duplicate/concurrent saves, and direct private-code validation without saving. Run unit/integration suites, lint, architecture, type/build checks, Prisma validation/model budget, and browser checks when a local database/server is available.

## Scope

No notification campaigns, quota reservation, or new coupon stacking rules. Preserve unrelated in-progress checkout/assistant changes. Additive schema migration is required before this feature runs against an existing database.
