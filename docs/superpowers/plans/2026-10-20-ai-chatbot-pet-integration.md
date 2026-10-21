# AI Chatbot & Draggable Clawd Chef Pet Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mount an interactive, movable floating chatbot widget featuring the animated Clawd Chef mascot on the storefront and connect the backend assistant engine to custom OpenAI-compatible HTTP providers (`api/v1`).

**Architecture:** A client-side draggable widget component (`DraggablePetWidget`) renders the Clawd Chef spritesheet with state-reactive animations (idle, cooking, waving) and hosts the grounded `AssistantPanel` modal. On the backend, a new `CustomHttpAiProvider` implements the existing `AiProvider` interface to dispatch JSON-formatted chat completion requests to configurable endpoints while preserving zero-hallucination catalog grounding and token quotas.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Node.js built-in test runner (`node:test` + `node:assert/strict`), WebP Spritesheet animation.

**Spec:** `docs/superpowers/specs/2026-10-20-ai-chatbot-pet-integration-design.md`

## Global Constraints

- **Prisma Model Budget:** Zero database schema modifications. The 34-model schema budget remains strictly locked (`npm run schema:budget` must pass).
- **Clean Architecture Boundaries:** Presentation code (`@client/*`) must never import from `@server/*` or `@prisma/client`. Server code must never import from `@client/*`. Enforced by `npm run arch:check`.
- **Zero Hallucination Grounding:** All numeric prices, specs, and benchmark claims must strictly pass `validateAssistantAnswer`. If ungrounded or if the external LLM is offline/malformed, the system must trigger `buildDeterministicAnswer`.
- **Route Isolation:** The pet widget must automatically hide on all `/admin*` routes.
- **Fail-Safe Transport:** Network errors, HTTP 4xx/5xx, timeouts, or missing API keys must never crash the server process or throw unhandled promise rejections.

## Review Focus

1. **URL Normalization edge cases:** Base URLs provided with or without trailing slashes, or already including `/chat/completions` (e.g. `https://host.com/api/v1` vs `https://host.com/api/v1/` vs `https://host.com/api/v1/chat/completions`). Must resolve to a valid completions URL in all cases.
2. **Markdown Code Fence JSON Output:** LLMs frequently wrap JSON responses in ````json\n{...}\n```` codeblocks. The parser must unwrap and parse markdown fences cleanly without failing back to null.
3. **Viewport Clamping Math:** Dragging on ultra-wide screens, mobile screens, or resizing the browser window must not strand the mascot off-screen.
4. **Pointer Click vs. Drag Discrimination:** A slight finger/mouse jitter (< 6px displacement) must open/close the dialog instead of being captured as a drag motion.
5. **Missing/Unset Environment Variables:** When `AI_API_KEY` or `AI_API_BASE_URL` is omitted, the provider must return a clean error finish reason, triggering deterministic catalog fallback with 0 unhandled rejections.

---

### Task 1: Custom HTTP AI Provider Implementation

**Files:**
- Create: `src/server/infrastructure/ai/custom-http-provider.ts`
- Test: `tests/custom-http-provider.test.ts`

**Interfaces:**
- Consumes:
  - `src/server/infrastructure/ai/provider.ts`: `AiProvider`, `AiGenerationRequest`, `AiGenerationResult`, `AiMessage`, `DEFAULT_AI_MODEL`
- Produces:
  - `src/server/infrastructure/ai/custom-http-provider.ts`: `CustomHttpAiProvider`, `CustomHttpAiProviderOptions`, `normalizeChatCompletionsUrl`, `extractJsonFromLlmText`

- [ ] **Step 1: Write the failing unit tests for CustomHttpAiProvider**

Create `tests/custom-http-provider.test.ts` testing URL normalization, bearer auth header, request formatting, timeout handling, markdown JSON unwrapping, and fallback behavior when credentials are missing.

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CustomHttpAiProvider,
  normalizeChatCompletionsUrl,
  extractJsonFromLlmText,
} from '../src/server/infrastructure/ai/custom-http-provider.ts';

describe('CustomHttpAiProvider - URL Normalization & JSON Parser', () => {
  it('normalizes various base URL formats correctly', () => {
    assert.equal(
      normalizeChatCompletionsUrl('https://api.openai.com/v1'),
      'https://api.openai.com/v1/chat/completions'
    );
    assert.equal(
      normalizeChatCompletionsUrl('https://api.openai.com/v1/'),
      'https://api.openai.com/v1/chat/completions'
    );
    assert.equal(
      normalizeChatCompletionsUrl('https://my-llm.com/api/v1/chat/completions'),
      'https://my-llm.com/api/v1/chat/completions'
    );
  });

  it('extracts raw JSON and markdown code fence JSON cleanly', () => {
    const raw = '{"answer": "Tốt", "citations": []}';
    assert.deepEqual(extractJsonFromLlmText(raw), { answer: 'Tốt', citations: [] });

    const fenced = '```json\n{"answer": "Tốt", "citations": []}\n```';
    assert.deepEqual(extractJsonFromLlmText(fenced), { answer: 'Tốt', citations: [] });

    const malformed = 'Not a json';
    assert.equal(extractJsonFromLlmText(malformed), null);
  });
});

describe('CustomHttpAiProvider - Generation & Transport Contract', () => {
  it('dispatches request with correct headers, model, and body', async () => {
    const originalFetch = globalThis.fetch;
    let interceptedUrl = '';
    let interceptedHeaders: HeadersInit | undefined;
    let interceptedBody: any = null;

    globalThis.fetch = async (url, init) => {
      interceptedUrl = String(url);
      interceptedHeaders = init?.headers;
      interceptedBody = JSON.parse(String(init?.body || '{}'));
      return new Response(
        JSON.stringify({
          id: 'chatcmpl-test',
          model: 'custom-model-v1',
          choices: [
            {
              message: { role: 'assistant', content: '{"answer": "Gợi ý laptop", "citations": []}' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      const provider = new CustomHttpAiProvider({
        baseUrl: 'https://test-provider.com/api/v1',
        apiKey: 'secret-key-123',
        model: 'custom-model-v1',
      });

      const res = await provider.generate(
        {
          messages: [{ role: 'user', content: 'Xin chào' }],
          responseFormat: 'json',
        },
        { signal: new AbortController().signal }
      );

      assert.equal(interceptedUrl, 'https://test-provider.com/api/v1/chat/completions');
      assert.equal((interceptedHeaders as any)['Authorization'], 'Bearer secret-key-123');
      assert.equal(interceptedBody.model, 'custom-model-v1');
      assert.equal(res.finishReason, 'stop');
      assert.deepEqual(res.parsedJson, { answer: 'Gợi ý laptop', citations: [] });
      assert.equal(res.usage.totalTokens, 130);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('fails gracefully without throwing when API key or base URL is missing', async () => {
    const provider = new CustomHttpAiProvider({ baseUrl: '', apiKey: '' });
    const res = await provider.generate(
      { messages: [{ role: 'user', content: 'Test' }] },
      { signal: new AbortController().signal }
    );
    assert.equal(res.finishReason, 'error');
    assert.equal(res.parsedJson, null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/custom-http-provider.test.ts`
Expected: FAIL with Cannot find module `custom-http-provider.ts`.

- [ ] **Step 3: Implement `CustomHttpAiProvider` in `src/server/infrastructure/ai/custom-http-provider.ts`**

Implement URL normalization, payload mapping, fetch dispatch with signal timeout, error handling, token usage mapping, and JSON extraction.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/custom-http-provider.test.ts`
Expected: PASS (all test cases pass).

- [ ] **Step 5: Commit**

```bash
git add src/server/infrastructure/ai/custom-http-provider.ts tests/custom-http-provider.test.ts
git commit -m "feat(ai): implement configurable custom http ai provider"
```

---

### Task 2: Provider Factory & Assistant Controller Integration

**Files:**
- Modify: `src/server/modules/assistant/assistant.controller.ts:40-52`
- Modify: `.env.example:49-55`
- Test: `tests/assistant-provider-resolution.test.ts`

**Interfaces:**
- Consumes:
  - `src/server/infrastructure/ai/custom-http-provider.ts`: `CustomHttpAiProvider`
  - `src/server/infrastructure/ai/fake-provider.ts`: `FakeAiProvider`
- Produces:
  - `src/server/modules/assistant/assistant.controller.ts`: `getAssistantProvider()`, `setAssistantProvider()`, `resolveDefaultAiProvider()`

- [ ] **Step 1: Write the failing unit test for dynamic provider resolution**

Create `tests/assistant-provider-resolution.test.ts` to test that when `AI_API_BASE_URL` or `AI_API_KEY` is present, `getAssistantProvider()` returns `CustomHttpAiProvider`, and when unset, it preserves `FakeAiProvider`.

```typescript
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAssistantProvider,
  setAssistantProvider,
  resolveDefaultAiProvider,
} from '../src/server/modules/assistant/assistant.controller.ts';
import { FakeAiProvider } from '../src/server/infrastructure/ai/fake-provider.ts';
import { CustomHttpAiProvider } from '../src/server/infrastructure/ai/custom-http-provider.ts';

describe('Assistant Controller - Provider Resolution', () => {
  const originalBaseUrl = process.env.AI_API_BASE_URL;
  const originalApiKey = process.env.AI_API_KEY;

  afterEach(() => {
    process.env.AI_API_BASE_URL = originalBaseUrl;
    process.env.AI_API_KEY = originalApiKey;
    setAssistantProvider(new FakeAiProvider());
  });

  it('returns FakeAiProvider when AI credentials are not configured in environment', () => {
    delete process.env.AI_API_BASE_URL;
    delete process.env.AI_API_KEY;
    const provider = resolveDefaultAiProvider();
    assert.ok(provider instanceof FakeAiProvider);
  });

  it('returns CustomHttpAiProvider when AI_API_BASE_URL or AI_API_KEY is configured', () => {
    process.env.AI_API_BASE_URL = 'https://my-llm.com/api/v1';
    process.env.AI_API_KEY = 'test-token';
    const provider = resolveDefaultAiProvider();
    assert.ok(provider instanceof CustomHttpAiProvider);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/assistant-provider-resolution.test.ts`
Expected: FAIL (`resolveDefaultAiProvider` not defined).

- [ ] **Step 3: Implement dynamic provider resolution in `assistant.controller.ts`**

Update `src/server/modules/assistant/assistant.controller.ts` to export `resolveDefaultAiProvider()`, and update `getAssistantProvider()` to use it unless an explicit mock has been injected via `setAssistantProvider()`.
Update `.env.example` with the new environment variables (`AI_API_BASE_URL`, `AI_API_KEY`, `AI_MODEL_NAME`, `AI_TIMEOUT_MS`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/assistant-provider-resolution.test.ts`
Expected: PASS.
Also run existing assistant tests: `npm run test` on assistant suites to ensure no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/assistant/assistant.controller.ts .env.example tests/assistant-provider-resolution.test.ts
git commit -m "feat(ai): integrate custom http provider resolution into assistant controller"
```

---

### Task 3: AssistantPanel Enhancements for Mascot State Reactivity

**Files:**
- Modify: `src/client/components/assistant/AssistantPanel.tsx:1-50`
- Test: `tests/assistant-panel-props.test.ts`

**Interfaces:**
- Consumes:
  - `src/client/components/assistant/AssistantPanel.tsx`: `AssistantPanelProps`
- Produces:
  - Enhanced `AssistantPanelProps`: `onLoadingChange?: (loading: boolean) => void`, `onClose?: () => void`

- [ ] **Step 1: Write test verifying prop definitions and loading state emissions**

Create `tests/assistant-panel-props.test.ts` verifying that `AssistantPanelProps` supports `onLoadingChange` and `onClose`, and that typechecking succeeds.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/assistant-panel-props.test.ts`
Expected: FAIL if types or exports are missing.

- [ ] **Step 3: Update `AssistantPanel.tsx` with callbacks**

Add `onLoadingChange?: (loading: boolean) => void` and `onClose?: () => void` to `AssistantPanelProps`.
In `handleSendMessage`, trigger `onLoadingChange?.(true)` before dispatch and `onLoadingChange?.(false)` in the `finally` block.
Add close button in the panel header if `onClose` is provided.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/assistant-panel-props.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/components/assistant/AssistantPanel.tsx tests/assistant-panel-props.test.ts
git commit -m "feat(assistant): add loading and close callbacks to AssistantPanel"
```

---

### Task 4: Draggable Clawd Chef Pet Widget (`DraggablePetWidget.tsx`)

**Files:**
- Create: `src/client/components/assistant/DraggablePetWidget.tsx`
- Test: `tests/draggable-pet-widget.test.ts`

**Interfaces:**
- Consumes:
  - `src/client/components/assistant/AssistantPanel.tsx`: `<AssistantPanel />`
  - Asset: `/assets/pet/clawd-chef/spritesheet.webp`
- Produces:
  - `src/client/components/assistant/DraggablePetWidget.tsx`: `DraggablePetWidget`, `clampCoordinates`, `isDragMovement`

- [ ] **Step 1: Write failing unit test for widget coordinate math and clamping**

Create `tests/draggable-pet-widget.test.ts`:
```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampCoordinates,
  isDragMovement,
} from '../src/client/components/assistant/DraggablePetWidget.tsx';

describe('DraggablePetWidget - Coordinate Clamping & Interaction Detection', () => {
  it('clamps coordinates strictly within viewport boundaries with margins', () => {
    const viewport = { width: 1000, height: 800 };
    const widgetSize = { width: 80, height: 90 };
    const margin = 12;

    // Inside bounds: unchanged
    assert.deepEqual(
      clampCoordinates({ x: 500, y: 400 }, viewport, widgetSize, margin),
      { x: 500, y: 400 }
    );

    // Negative / left overflow: clamped to margin
    assert.deepEqual(
      clampCoordinates({ x: -50, y: 400 }, viewport, widgetSize, margin),
      { x: 12, y: 400 }
    );

    // Right overflow: clamped to viewport - width - margin
    assert.deepEqual(
      clampCoordinates({ x: 1200, y: 400 }, viewport, widgetSize, margin),
      { x: 1000 - 80 - 12, y: 400 }
    );

    // Bottom overflow: clamped to viewport - height - margin
    assert.deepEqual(
      clampCoordinates({ x: 500, y: 900 }, viewport, widgetSize, margin),
      { x: 500, y: 800 - 90 - 12 }
    );
  });

  it('discriminates click from drag movement with 6px threshold', () => {
    assert.equal(isDragMovement({ x: 0, y: 0 }, { x: 3, y: 4 }), false); // hypot = 5 < 6
    assert.equal(isDragMovement({ x: 0, y: 0 }, { x: 6, y: 0 }), true);  // hypot = 6 >= 6
    assert.equal(isDragMovement({ x: 10, y: 10 }, { x: 20, y: 20 }), true); // hypot = 14.14 >= 6
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/draggable-pet-widget.test.ts`
Expected: FAIL (`DraggablePetWidget.tsx` does not exist).

- [ ] **Step 3: Implement `DraggablePetWidget.tsx`**

1. Export `clampCoordinates` and `isDragMovement` pure functions.
2. Build `DraggablePetWidget`:
   - Checks `usePathname()`; if `pathname.startsWith('/admin')`, returns null.
   - Pointer events: `onPointerDown`, `onPointerMove`, `onPointerUp`.
   - LocalStorage key `clawd_pet_position` for persisting x, y.
   - Renders CSS spritesheet animation with `/assets/pet/clawd-chef/spritesheet.webp`.
   - Animation states:
     - `clawd-idle`: Row 0 steps(6)
     - `clawd-cooking`: Row 6 steps(6) when `isCooking` is true
     - `clawd-wave`: Row 3 steps(4)
   - Clicking opens floating chat window hosting `<AssistantPanel onLoadingChange={setIsCooking} onClose={() => setIsOpen(false)} />`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/draggable-pet-widget.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/components/assistant/DraggablePetWidget.tsx tests/draggable-pet-widget.test.ts
git commit -m "feat(client): implement draggable Clawd Chef pet widget component"
```

---

### Task 5: Root Layout Mounting & Storefront Integration

**Files:**
- Modify: `src/app/layout.tsx:1-30`
- Test: `tests/layout-integration.test.ts`

**Interfaces:**
- Consumes:
  - `src/client/components/assistant/DraggablePetWidget.tsx`: `<DraggablePetWidget />`
- Produces:
  - Universal storefront availability of Clawd Chef AI assistant.

- [ ] **Step 1: Write integration test for storefront widget rendering**

Create `tests/layout-integration.test.ts` testing that `DraggablePetWidget` is imported and mounted inside RootLayout / Providers and that the spritesheet asset file exists in `public/assets/pet/clawd-chef/spritesheet.webp`.

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Storefront Layout Integration: Draggable AI Pet Mascot', () => {
  it('ensures spritesheet asset is present in public assets', () => {
    const assetPath = path.resolve(process.cwd(), 'public/assets/pet/clawd-chef/spritesheet.webp');
    assert.ok(fs.existsSync(assetPath), 'Clawd Chef spritesheet must exist in public/assets');
    const stats = fs.statSync(assetPath);
    assert.ok(stats.size > 1000, 'Spritesheet file must not be empty');
  });

  it('ensures layout.tsx mounts DraggablePetWidget', () => {
    const layoutContent = fs.readFileSync(path.resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8');
    assert.ok(
      layoutContent.includes('DraggablePetWidget'),
      'Root layout must import and render DraggablePetWidget'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/layout-integration.test.ts`
Expected: FAIL (`layoutContent.includes('DraggablePetWidget')` is false).

- [ ] **Step 3: Mount `DraggablePetWidget` in `src/app/layout.tsx`**

Import `DraggablePetWidget` from `@client/components/assistant/DraggablePetWidget` and place `<DraggablePetWidget />` inside `<Providers>` right above `<Footer />`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/layout-integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full verification suite**

Run:
1. `npm run test` (all unit tests)
2. `npm run arch:check` (dependency-cruiser layer boundaries)
3. `npm run schema:budget` (must remain 34 models)
4. `npm run lint`
5. `npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx tests/layout-integration.test.ts
git commit -m "feat(storefront): mount draggable Clawd Chef assistant widget in root layout"
```
