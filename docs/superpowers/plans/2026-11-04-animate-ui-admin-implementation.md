# Animate UI Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved minimalist dashboard and persistent left navigation to the real admin app, using Animate UI for the sidebar, mobile panel, period selector, and confirmation controls.

**Architecture:** Keep the current Next.js admin layout, analytics endpoints, polling, Pusher, and permission model. Add Animate UI primitives in existing client components, and adjust the current dashboard components to match the approved visual hierarchy. Integrate manually because this app does not have shadcn `components.json`.

**Tech Stack:** Next.js 16.3.4, React 19.2.8, Tailwind CSS 4, `@animate-ui/react` 2.4.1, Motion, Radix UI, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-04-animate-ui-admin-design.md`

## Global Constraints

- Sidebar stays visible at widths ≥1024 px; mobile navigation is a left sheet below 1024 px.
- Preserve `ADMIN`/`STAFF` navigation permissions and analytics endpoints, range keys `today`/`7days`/`month`, polling and Pusher.
- Provider uses `reducedMotion="user"`; data refresh does not animate the whole page.
- Use real analytics values; numbers in SVG sketches are illustrative only.
- Keep unrelated dirty worktree files untouched. The baseline `npm test` has one environment failure: `tests/prisma-model-budget.test.ts` cannot spawn a Node subprocess (`EPERM`).

## Review Focus

- First render with saved collapsed state: sidebar and main content align without hydration mismatch.
- STAFF with no optional permissions: only permitted navigation and operational data appear.
- Mobile sheet close via Esc, overlay, explicit close, or navigation, with focus returned to trigger.
- Rapid range selection while polling: the final selected range remains visible and drives the chart request.
- Confirmation while loading: Escape/backdrop and repeated confirm stay disabled until completion.

---

### Task 1: Animate UI foundation and accessible navigation

**Files:** `package.json`, `package-lock.json`, `src/client/components/admin/layout/AdminAppShell.tsx`, `AdminSidebar.tsx`, `AdminTopbar.tsx`; create `src/client/components/admin/layout/admin-navigation.ts`, `tests/admin-navigation.test.ts`.

**Interfaces:** `getVisibleAdminNavGroups(role?: string, permissions?: readonly string[]): NavGroup[]`, `isAdminNavItemActive(pathname: string, href: string, exact?: boolean): boolean`; `AdminSidebar` keeps its existing props.

- [x] Write real navigation tests for ADMIN, STAFF with selected/no permissions, exact dashboard matching, and nested active routes; verify RED.
- [x] Add `@animate-ui/react`, `motion`, `radix-ui`; manually mount `AnimateUIProvider` in `AdminAppShell`.
- [x] Extract navigation data/filter and use Animate UI sidebar `Provider`/`Highlight` for persistent desktop navigation; retain the current saved collapsed state and a readable active item.
- [x] Replace the mobile custom drawer with Animate UI Radix `Dialog` styled as a left sheet; close on route selection and preserve trigger focus.
- [x] Restyle shell/topbar to quiet gray surfaces, readable labels and a mobile-only menu trigger; retain search and permission-safe action links.
- [ ] Run navigation tests, TypeScript, lint on touched files, and inspect desktop/mobile behavior.

### Task 2: Simplified data-first dashboard

**Files:** `src/client/views/admin/AdminDashboardView.tsx`, `src/client/components/admin/dashboard/AdminKpiStrip.tsx`, `AdminRevenueBars.tsx`, `AdminDonutChart.tsx`, `AdminActionCenter.tsx` as needed; create `src/client/components/admin/dashboard/dashboard-presentation.ts`, `tests/admin-dashboard-presentation.test.ts`.

**Interfaces:** Pure presentation helpers return labels and values for the current `RevenueBarRange` without changing analytics payloads. `AdminRevenueBars` receives the selected range from the page; it does not render a duplicate period control.

- [x] Write tests for today/7days/month KPI selection, empty analytics, and ADMIN/STAFF visibility; verify RED.
- [x] Replace the period buttons with Animate UI `ToggleGroup` and simplify the header to title, date, refresh and one relevant action.
- [x] Render four concise KPI cards, then revenue and payment distribution, then urgent work and recent orders; place supporting cards below that section.
- [x] Remove decorative sparkline/pulsing surfaces; preserve the data labels and add stable loading/error states.
- [ ] Run presentation and analytics tests, TypeScript and lint; inspect phone/tablet/desktop layouts.

### Task 3: Confirmation controls and focused rollout

**Files:** `src/client/components/ui/ConfirmDialog.tsx`, its admin consumers if needed; create `tests/confirm-dialog-policy.test.ts` and a small pure policy module only if needed to enforce loading behavior.

**Interfaces:** Keep `ConfirmDialog`'s existing props and callbacks so Cart, Wishlist, Coupons, Reviews and Products continue to work.

- [x] Add a failing test for close/confirm policy under normal and loading states; verify RED.
- [x] Replace the manual overlay with Animate UI `AlertDialog`/`Dialog` while preserving labels, secondary action, focus on Cancel, and disabled interaction during loading.
- [x] Check every existing consumer for changed close or confirm semantics; add a real DropdownMenu only where a current admin control already presents multiple actions.
- [ ] Run targeted tests, full available test suite, lint, `arch:check`, and build. Compare final screens with the approved SVGs.

## Execution note

The user already approved the design and authorized implementation. Execute inline in the shared workspace. The working tree contains unrelated edits and untracked preview assets; stage or modify only task files. Do not block on an additional plan approval question.

Implementation verification: 1,072 unit tests, 77 integration tests, TypeScript, source lint, architecture check, and a clean Webpack production build passed. The three visual inspection checkboxes remain open because the browser automation host was unavailable in this session. Existing STAFF links to ADMIN-only Orders, Products, and Shipments pages remain a separate access-control issue.
