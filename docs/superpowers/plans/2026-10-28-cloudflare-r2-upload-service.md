# Cloudflare R2 Upload Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Cloudflare R2 object storage into the upload service with priority fallback (R2 -> Cloudinary -> Local Disk), supporting custom domains and S3-compatible uploads.

**Architecture:** Extend `@server/modules/upload/upload.service.ts` with pure configuration resolution and an S3-compatible R2 upload client using `@aws-sdk/client-s3`. Wire `src/app/api/admin/upload/route.ts` to prioritize R2 over Cloudinary and local disk without breaking existing tests or deployments.

**Tech Stack:** Next.js 16, TypeScript, `@aws-sdk/client-s3`, Node.js native test runner (`node:test`).

**Spec:** In-session design requested by user ("chuyển từ cloudinary sang cloudflare", domain: `media.nhonhoadev.id.vn`).

## Global Constraints

- Never break existing Cloudinary or local upload behavior when R2 credentials are missing.
- Zero server leakage: keep upload logic entirely within `@server/modules/upload/`.
- Maintain 100% test pass rate with `npm run test`.
- All environment access must be safely injectable for deterministic unit testing.

## Review Focus

1. Missing R2 environment variables fall back cleanly to Cloudinary or local disk without unhandled rejections.
2. Trailing slashes on `R2_PUBLIC_DOMAIN` do not produce duplicate slashes in the final returned URL.
3. Content-Type and Cache-Control headers (`public, max-age=31536000, immutable`) are properly set on uploaded S3/R2 objects.
4. Custom S3 client injection allows unit tests to execute without real Cloudflare credentials or external network calls.
5. Path traversal or non-image files are rejected before touching the R2 client.

---

### Task 1: R2 Configuration Parser & Upload Engine in `upload.service.ts`

**Files:**
- Modify: `src/server/modules/upload/upload.service.ts`
- Test: `tests/upload.test.ts`

**Interfaces:**
- Produces:
  - `interface R2Config`: `{ accountId: string; accessKeyId: string; secretAccessKey: string; bucketName: string; publicDomain: string }`
  - `getR2Config(env?: Record<string, string | undefined>): R2Config | null`
  - `uploadToR2(input: { fileBuffer: Buffer; filename: string; contentType: string; folder?: string }, client?: S3ClientLike, config?: R2Config): Promise<string>`

- [ ] **Step 1: Write failing unit tests for `getR2Config` and `uploadToR2` in `tests/upload.test.ts`**
- [ ] **Step 2: Run test suite to verify tests fail**
  Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/upload.test.ts`
  Expected: FAIL (functions not exported/defined)
- [ ] **Step 3: Implement `getR2Config` and `uploadToR2` in `src/server/modules/upload/upload.service.ts`**
- [ ] **Step 4: Run test suite to verify tests pass**
  Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/upload.test.ts`
  Expected: PASS

---

### Task 2: Route Handler Integration in `src/app/api/admin/upload/route.ts`

**Files:**
- Modify: `src/app/api/admin/upload/route.ts`

**Interfaces:**
- Consumes: `getR2Config`, `uploadToR2`, `generateSafeUploadFilename` from `@server/modules/upload/upload.service`
- Produces: `POST /api/admin/upload` response `{ url: string, success: true }`

- [ ] **Step 1: Inspect route handler and add R2 branch ahead of Cloudinary**
- [ ] **Step 2: Verify route handling with test suite**
  Run: `npm run test`
  Expected: PASS (all 1051+ tests pass)

---

### Task 3: Environment Configuration & Verification

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Document `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_DOMAIN` in `.env.example`**
- [ ] **Step 2: Run full verification suite**
  Run: `npm run verify` (or `npm run test && npm run lint && npm run arch:check`)
  Expected: All checks pass with 0 errors.
