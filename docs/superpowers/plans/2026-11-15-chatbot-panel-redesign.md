# Chatbot Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the shopping assistant as a polished floating panel while preserving search, product selection, comparison, history, and demo disclosures.

**Architecture:** Keep the existing `AssistantPanel` state and API calls. Refine presentation-only markup and Tailwind classes in the panel, product cards, and comparison table; use existing icons and DTOs.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-15-chatbot-panel-redesign-design.md`

## Global Constraints

- Do not change assistant API calls, DTOs, selection rules, or comparison behavior.
- Keep clickable product links separate from comparison buttons.
- Preserve demo labels, loading/error states, history refresh labels, and mobile horizontal table scrolling.
- Preserve existing unrelated working-tree changes.

## Review Focus

- Panel must stay within the viewport on desktop and mobile.
- Product cards must keep separate detail and compare controls.
- Selected-product dock must remain usable above the composer.
- Comparison table must scroll inside its own region.
- Empty, loading, error, history, and demo states must remain visible.

### Task 1: Floating assistant shell

**Files:** Modify `src/client/components/assistant/AssistantPanel.tsx`.

- [x] Replace the neutral shell with the elevated panel treatment: larger radius, soft shadow, slate header, muted message canvas, and safe mobile width.
- [x] Add a compact Clawd-style avatar badge using existing emoji/icon primitives, online status, and a clearer header label.
- [x] Add empty-state suggestion chips while keeping the existing quick action behavior.
- [x] Restyle assistant/user bubbles, citations, follow-up actions, loading indicator, error banner, selected dock, and composer without changing handlers.

### Task 2: Product cards and comparison surface

**Files:** Modify `src/client/components/assistant/AssistantProductCards.tsx`, `src/client/components/assistant/AssistantComparison.tsx`.

- [x] Tighten card spacing and hierarchy for image, brand/demo label, name, variant, price, stock, and specs.
- [x] Use distinct secondary “Xem” and primary “So sánh” controls with accessible labels preserved.
- [x] Add comparison title styling and emphasize price/stock rows while retaining local horizontal scrolling and demo notice.

### Task 3: Verification

- [x] Run `git diff --check`.
- [x] Run TypeScript check and production Webpack build.
- [x] Inspect the live panel at desktop and a narrow mobile viewport; verify search cards, selected dock, comparison table, and composer.

## Completion record

- Updated `DraggablePetWidget.tsx` host sizing as a small supporting change: 448px desktop width, safe mobile insets, and matching panel radius. Mascot behavior is preserved.
- Scoped ESLint (all four UI components), TypeScript, production Webpack build, and whitespace checks passed. The build emitted an existing Node `url.parse()` deprecation warning.
- Browser verification at 390×844 and 1280×960: quick search returned four Sony cards; two selections enabled the comparison dock; comparison returned the selected products at 2,490,000đ and 3,490,000đ. The mobile table scrolls within a 317px region with 440px content, while the composer stays visible.
- Independent presentation review found low-contrast secondary text; relevant labels were darkened and verified before completion.
- Screenshots: `docs/verification/assets/chatbot-redesign-mobile.jpg` and `docs/verification/assets/chatbot-redesign-desktop.jpg`.
