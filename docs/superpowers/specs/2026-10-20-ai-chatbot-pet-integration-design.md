# AI Chatbot & Draggable Clawd Chef Pet Integration Design

**Date:** 2026-10-20  
**Status:** In Review / Design  
**Scope:** Client-side Draggable Pet Floating Widget (Clawd Chef), App Router Layout Mount, and Configurable Custom HTTP LLM Provider (`api/v1`)

---

## 1. Intent & Problem Statement

The repository contains an electronics commerce AI assistant subsystem (`src/server/modules/assistant/`) equipped with evidence bundle aggregation, grounding verification, and token quotas. However:
1. **Unreachable UI:** The client component `AssistantPanel.tsx` is completely unmounted. Customers visiting the shop cannot discover or interact with the AI assistant.
2. **Offline Fake Provider:** The active AI provider is hardcoded to `FakeAiProvider`, which only produces static scripted strings without invoking real LLM intelligence.
3. **User Experience Goal:** The user requested a modern, delightful interactive experience: a floating widget positioned at the corner of the screen that customers can freely drag and reposition, represented by the **Clawd Chef** mascot (`clawd-chef.codex-pet.zip`), which changes animation states when Claude is "cooking" an answer.
4. **Backend Connectivity Goal:** The backend must connect to an external LLM provider whose base URL (`api/v1`) and API key are configured via environment variables in `.env`.

---

## 2. Goals & Invariants

### 2.1 Goals
- **G1 (Movable Pet Widget):** Render an interactive floating widget on the customer storefront featuring the animated spritesheet of **Clawd Chef**. Customers can drag and reposition the mascot anywhere on the screen (mouse & touch support).
- **G2 (Position Persistence & Boundary Clamping):** Mascot coordinates are remembered in `localStorage` across page navigations and clamped within viewport bounds to prevent getting lost off-screen.
- **G3 (Reactive Animation States):**
  - **Idle State:** Clawd breathes and twitches claws gently at rest.
  - **Cooking State:** While waiting for the AI response (`isLoading = true`), Clawd dons a chef's hat and stirs a boiling soup pot (*"Claude is cooking"* 🍲).
  - **Finished State:** Once answered, Clawd waves cheerily and presents the grounded product advice.
- **G4 (Custom HTTP LLM Provider):** Implement `CustomHttpAiProvider` conforming to `AiProvider` interface, capable of calling standard `/api/v1/chat/completions` endpoints with bearer authentication, custom model names, and json output parsing.
- **G5 (Deterministic Safety & Grounding Invariants):** Retain all existing zero-hallucination verification (`grounding.service.ts`), prompt-injection sanitization, and automatic fallback to verified catalog specs if the model errs or is unreachable.
- **G6 (Model & Schema Invariants):** Zero new database tables; Prisma model budget remains strictly locked at 34 models.

### 2.2 Non-Goals
- Modifying the existing staff/customer support chat (`/chat`, Pusher human-to-human channel).
- Storing customer chat messages in vector databases (already handled by Prisma `AssistantConversation` and `AssistantMessage` tables).
- Changing the existing 30-day conversation purge lifecycle.

---

## 3. Architecture & Data Flow

```
[Browser / Customer View]
       |
       +---> <DraggablePetWidget /> (Mounted in src/app/layout.tsx)
       |        |
       |        +-- Drag & Drop Engine (Pointer events, clamping, localStorage persistence)
       |        +-- Spritesheet Animator (Idle: row 0 | Cooking: row 6)
       |        +-- Toggle Dialog (<AssistantPanel /> inside draggable / modal container)
       |
       v
[HTTP API Routes]
  POST /api/assistant/conversations
  POST /api/assistant/conversations/[id]/messages
       |
       v
[Assistant Controller & Service]
  src/server/modules/assistant/assistant.controller.ts
  src/server/modules/assistant/assistant.service.ts
       |
       +---> 1. Quota & Rate Limit Check (src/server/infrastructure/ai/quota.ts)
       +---> 2. Evidence Compilation (specs, prices, benchmark scores from DB)
       +---> 3. LLM Dispatch via Provider
                 |
                 v
       [CustomHttpAiProvider] (src/server/infrastructure/ai/custom-http-provider.ts)
                 |
                 +---> POST ${AI_API_BASE_URL}/chat/completions
                 |     Headers: { Authorization: "Bearer ${AI_API_KEY}" }
                 |     Body: { model, messages, temperature, max_tokens, response_format }
                 |
                 v
       [Grounding & Hallucination Guard] (src/server/modules/assistant/grounding.service.ts)
                 |
                 +-- Valid JSON & Grounded Claims? -> Return AssistantAnswerDto
                 +-- Unreachable / Malformed / Hallucinated? -> Fallback to buildDeterministicAnswer()
```

---

## 4. Frontend Design: Draggable Clawd Chef Widget

### 4.1 Asset Placement
- Unpacked spritesheet: `public/assets/pet/clawd-chef/spritesheet.webp`
- Configuration: `public/assets/pet/clawd-chef/pet.json`
- Grid Specifications:
  - Total Atlas: 1536 x 2288 px (8 columns x 11 rows).
  - Cell Dimensions: 192 x 208 px.
  - Scale Factor: Rendered at 64 x 69 px or 72 x 78 px on desktop, 56 x 60 px on mobile.
  - Row 0: `idle` (6 frames, 6 fps).
  - Row 6: `cooking / waiting` (6 frames, 8 fps).
  - Row 3: `waving` (4 frames, 6 fps).

### 4.2 Draggable Pet Component (`src/client/components/assistant/DraggablePetWidget.tsx`)
1. **Pointer Event Drag Engine:**
   - Uses `onPointerDown`, `onPointerMove`, `onPointerUp`, `setPointerCapture`.
   - Distinguishes click from drag: if displacement is `< 6px`, treated as click (toggles chat window); if `>= 6px`, treated as drag.
   - Restricts coordinates: `minX = 12`, `maxX = window.innerWidth - widgetWidth - 12`, `minY = 12`, `maxY = window.innerHeight - widgetHeight - 12`.
   - Stores coordinates in `localStorage.getItem('clawd_pet_coords')`.
2. **Chat Window Modal / Drawer:**
   - Clicking Clawd opens an overlay panel containing `AssistantPanel`.
   - Header features Clawd avatar, conversation title, minimize button, and close button.
   - When open on mobile: anchors smoothly as a bottom sheet. On desktop: floats near the pet or can be docked.
3. **Route Filter:**
   - Hidden when URL starts with `/admin` so it does not collide with store operators managing back-office tables.

---

## 5. Backend Design: Custom HTTP AI Provider

### 5.1 Environment Variables
In `.env` / `.env.example`:
```env
# AI Chatbot Custom LLM Provider (api/v1 compatible)
AI_API_BASE_URL="https://api.openai.com/v1"   # e.g. https://your-provider.com/api/v1
AI_API_KEY="your-api-key-here"
AI_MODEL_NAME="gpt-4o-mini"                   # Or custom model ID
AI_TIMEOUT_MS="20000"                        # Request abort timeout (20s)
```

### 5.2 Implementation (`src/server/infrastructure/ai/custom-http-provider.ts`)
Conforms strictly to `AiProvider`:
```typescript
export interface CustomHttpAiProviderOptions {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}
```

1. **URL Normalization:**
   If `baseUrl` ends with `/chat/completions`, use as-is; otherwise append `/chat/completions` (e.g. `https://my-host.com/api/v1` -> `https://my-host.com/api/v1/chat/completions`).
2. **Payload Construction:**
   ```json
   {
     "model": modelName,
     "messages": input.messages.map(m => ({ role: m.role, content: m.content })),
     "temperature": input.temperature ?? 0.2,
     "max_tokens": input.maxTokens ?? 1500,
     "response_format": input.responseFormat === 'json' ? { "type": "json_object" } : undefined
   }
   ```
3. **Safe JSON Parsing:**
   Extracts `choices[0].message.content`. Handles both direct JSON and markdown code fences (````json ... ````).
4. **Resilience & Fallback:**
   - If `AI_API_KEY` or `AI_API_BASE_URL` is unset, returns `{ finishReason: 'error', text: '' }`.
   - The caller (`assistant.service.ts`) catches provider errors or ungrounded outputs and invokes `buildDeterministicAnswer(bundle, reason)` automatically. Store visitors receive verified prices and specifications even if the external LLM is offline.

---

## 6. Testing & Quality Strategy

1. **Unit Tests:**
   - `tests/custom-http-provider.test.ts`: Tests URL normalization, Authorization header formatting, timeout handling, markdown JSON extraction, and graceful failure without throwing unhandled exceptions.
   - `tests/draggable-pet-widget.test.ts`: Tests state transitions, boundary clamping math, and localStorage persistence keys.
2. **Integration & E2E Tests:**
   - `tests/assistant-e2e.test.ts`: Verify that sending queries through `/api/assistant/conversations/[id]/messages` continues passing with full evidence bundle grounding.
3. **Architecture & Budget Verification:**
   - `npm run schema:budget`: Asserts 34 models preserved.
   - `npm run arch:check`: Asserts zero layer violations between client and server.
