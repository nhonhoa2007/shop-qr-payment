# Demo Product Photos Implementation Plan

> Execute inline in the existing authorized checkout; preserve previous feature and user edits.

**Goal:** Add suitable photographic assets to all 50 existing demo technology products.

**Architecture:** Check in a media mapping with source URLs and local assets. Use it in the demo importer and provide an images-only refresh with a backup. Preserve custom photos and all operational data.

**Spec:** `docs/superpowers/specs/2026-11-15-demo-product-photos-design.md`

### Task 1: Media assets and mapping

- [x] Map each existing product ID to a photo of the correct product type; record exact/family illustration and original URL.
- [x] Download selected assets into `public/demo/products/` and verify each decodes as an image.

### Task 2: Safe image refresh

- [x] Test that managed images refresh, custom images survive and a second run makes no changes.
- [x] Use local media in `prepareDemoCatalog`; preserve fallback behavior for other manifests.
- [x] Add images-only refresh with a backup and apply it to the local demo database.

### Task 3: Verification

- [x] Run focused catalog/refresh tests, TypeScript, lint and whitespace checks.
- [x] Confirm cards, details and assistant search display the photos in the running app; save screenshots.
