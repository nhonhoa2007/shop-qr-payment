# Assistant product search, clickable cards and two-product comparison

Status: Approved by user on 2026-11-14
Date: 2026-11-14

## Tóm tắt để duyệt

- Khách hỏi bằng tiếng Việt để tìm sản phẩm đang bán theo tên, hãng, giá và
  thông số. Mỗi lần trả tối đa 5 thẻ sản phẩm có ảnh, giá hiện tại, tình trạng
  hàng, thông số chính và liên kết mở trang chi tiết.
- Mỗi thẻ có nút chọn so sánh riêng. Chọn đúng 2 sản phẩm cùng nhóm để xem bảng
  so sánh và nhận giải thích dựa trên thông tin shop có.
- Trợ lý nhớ danh sách vừa tìm để hiểu “so sánh hai chiếc đầu tiên”. Thiếu
  thông số thì ghi rõ, tên chưa rõ thì cho khách chọn lại.
- Dùng lại dữ liệu và hạ tầng hiện có. Chuẩn bị báo cáo chuyển danh mục sang
  laptop, điện thoại và phụ kiện, kiểm tra danh sách thay đổi trước khi áp dụng.
  Giữ liên kết với các đơn hàng cũ.
- Giai đoạn này tập trung tìm kiếm, thẻ bấm mở chi tiết và so sánh; không tự
  thêm hàng vào giỏ hoặc đặt hàng thay khách.

## Intent and agreed direction

The user wants to move the shop toward technology products so the assistant can
find products sold by the shop and compare two products. They selected chat with
clickable product cards and a comparison table over text-only replies.

Success means a customer can ask for products, open a matching product from a
card, select two products, and see a factual comparison without leaving the
shopping conversation. Follow-ups such as “so sánh hai sản phẩm đầu tiên” refer
to the latest results in that conversation.

## Approaches

1. Text-only results: reuse the current chat renderer; quick but awkward for
   browsing products and comparing long specifications.
2. Chat with product cards and structured comparison: selected by the user.
   Requires typed commerce responses and additional UI, but gives direct links,
   explicit selection and readable comparison.

Implementation builds on existing Prisma catalog services, assistant grounding
and the comparison pipeline. Product identity, price, availability, URLs and
table values are assembled by the server from shop records. The model may help
interpret a question and explain verified differences.

## Current implementation and change boundaries

- `AssistantPanel` renders plain text, citations and follow-up buttons.
- `buildEvidenceBundle` finds at most five active products using a contiguous
  phrase in name, description or category. It does not currently turn a budget
  or specification request into catalog filters.
- `answerQuestion` sends the current question and evidence to the provider; it
  does not currently resolve references to earlier result lists.
- `queryCatalog` already supports category, brand, price, availability and
  allowlisted specification filters, including variant-aware pricing.
- `/api/products/compare` and `ProductComparisonModal` exist. The comparison
  service needs alignment with current nested `specs.values`, variant
  `specOverrides`, published score status and active product/variant handling
  before the assistant relies on it.
- The original seed includes general retail products. Electronics seed/import
  code exists; the live database contents have not yet been inspected.

## Customer behavior

### Find products

- Support Vietnamese requests for a product name/model, category, brand, price
  range and supported specifications. Examples: “shop có laptop nào?”, “laptop
  RAM 16GB dưới 20 triệu”, “tìm điện thoại Samsung”.
- Normalize accents, aliases and currency expressions such as `20 triệu`,
  `20tr`, and `500k`. Turn recognized conditions into validated catalog filters.
- A need such as “học lập trình” can prompt for budget or category. Do not infer
  an unsupported suitability or performance claim from the product name.
- Return at most five matching product cards and a count/clear indication when
  more results exist. Offer refinement using the same validated query.
- Show active listings, including explicitly labelled out-of-stock products.
  A request for “còn hàng” applies the availability filter.
- A no-match reply states that no current shop product matches. Never replace
  it with invented products or silently broaden an explicit budget/spec filter.

### Product cards

Each compact card contains a product image or fallback, name, brand/category,
current effective price or price range, availability, and up to three known key
specifications. Image/name and a visible “Xem chi tiết” link open the existing
`/products/{id}` page. A separate “Chọn so sánh” button does not trigger navigation.

Use the existing shop visual tokens. Stack compact cards in the chat so mobile
users can read them. The chat remains open/usable within the current pet widget.
Use keyboard-accessible links/buttons; avoid nested interactive elements.

Conceptual flow (not a final visual layout):

```text
Customer: Laptop RAM 16GB dưới 20 triệu
Assistant: Các sản phẩm khớp yêu cầu của bạn:
  [Ảnh] Sản phẩm A — giá hiện tại — tình trạng
        RAM / SSD / màn hình
        [Xem chi tiết] [Chọn so sánh]
  [Ảnh] Sản phẩm B — giá hiện tại — tình trạng
        RAM / SSD / màn hình
        [Xem chi tiết] [Chọn so sánh]
  Đã chọn 2 sản phẩm                  [So sánh]
```

### Compare exactly two products in the assistant

- Customers select two cards or name two shop products in the message.
- They can remove a selection. A third selection asks them to remove one first.
- Require two distinct products/variants from the same comparison category.
  Explain an incompatible category choice and retain a usable selection.
- When a name matches several models/configurations, show matching cards for
  clarification rather than guessing. Variant selection is explicit when
  comparing a specific configuration. A product-level comparison clearly
  labels starting/range prices and does not attribute a variant's specs to
  every configuration.
- Show a two-column comparison of price, configuration, display, battery,
  weight, warranty and availability where applicable to the category.
- Missing values read “Chưa có dữ liệu”. Keep unknown and unsupported distinct.
- Only explain advantages supported by comparable values. Scores/benchmarks
  are optional and require current, active evidence; absence does not prevent
  the basic comparison. Do not invent a winner or equate RAM with performance.
- Product names in the comparison link to their detail pages. On small screens
  the table scrolls horizontally within its container.
- Retain the existing public API's supported 2–3 item contract; the assistant's
  selection flow accepts exactly two.

### Follow-up and history

- Store a small, versioned commerce context in existing conversation metadata:
  latest ordered result references and current comparison references, capped
  at five results and two comparison selections. Do not reuse another user's
  or conversation's context.
- Resolve “hai sản phẩm đầu tiên”, “chiếc thứ hai” and refinements such as
  “rẻ hơn” against that context, asking for clarification if no usable context
  exists. Explicit current-message IDs/names take priority over prior context.
- Re-fetch referenced records to verify current visibility, variants, price and
  stock. A delisted product becomes unavailable rather than a stale purchase
  recommendation. Check ownership before reading/writing commerce context.
- Preserve product references on message citations using optional server-owned
  `productRef` metadata and a role/order for search/comparison results. This
  keeps the existing citations JSON array compatible without new tables or
  columns. History decoding accepts older citation entries without references.
- Reconstruct cards/tables from validated references when loading history,
  clearly treating displayed prices as current data. Keep ordinary text history
  readable if a referenced item is no longer available. Do not store raw model
  output as trusted product references.

## Data and server contract

- Extend shared assistant response/message DTOs with an optional typed commerce
  payload for search results, candidates needing clarification, or comparison.
  Existing clients and text-only messages remain valid.
- Cards carry validated product/variant identity, image, display name,
  effective price/range, availability, key specs and a server-built relative
  detail URL. Money uses the existing serialized VND conventions.
- Search intent parsing is bounded and validated. Reuse existing catalog
  filters; supplement name resolution with token/alias matching as needed.
  Never accept model-generated SQL, arbitrary filter paths or arbitrary URLs.
- Reuse a consistent spec/variant normalization path for evidence, cards and
  comparisons so the chat cannot disagree with the product detail page.
- Fetch bounded history/context, reject malformed IDs/selection payloads and
  keep conversational requests subject to existing quota/rate limits.
- Assemble cards and factual tables independently of the provider. Search and
  comparison remain useful with the deterministic fallback when the online
  provider is absent, times out or produces an invalid explanation.
- Concurrent requests must not silently overwrite another response's commerce
  context; use conditional updates/versioning or serialize per-conversation
  mutation. The implementer chooses the smallest existing infrastructure fit.

## Technology catalog transition

Builder proposal: use laptop, phone and technology accessory categories already
supported by the schema. Inspect the actual database and existing manifest
before choosing imports; do not assume seed data is trustworthy or installed.

Prepare a dry-run report listing additions, updates, missing specs/images/source
links and legacy listings to hide. Normalize brand, category, typed specs,
variants, pricing, packing and warranty using existing catalog write/readiness
checks. Verify real product facts against manufacturer sources before using
them; disclose synthetic/demo data and omit unsupported benchmark claims.

Keep existing product IDs and historical order references intact. Retire legacy
listings by visibility changes after replacement listings are ready. Prepare and
validate the dry-run/change report before applying catalog changes within the
user's authorized environment and scope. If the database destination is unclear,
finish the code and dataset preparation before clarifying that destination.
No database reset or destructive reseed is part of this design.

## Constraints and non-goals

- Reuse Next.js/React/Prisma architecture and existing shop styles. Read the
  installed Next.js guides before product code changes.
- Keep `client`, `server` and `shared` boundaries. No new Prisma models,
  migrations, vector database or external search dependency is needed.
- First release covers shop search, clickable cards and two-product comparison.
  Accessory bundles, autonomous cart/checkout actions and broad personalized
  recommendation scoring are outside this release.
- Preserve existing order/payment/inventory guards and all user working-tree
  changes. Never run the generic seed as a catalog replacement shortcut.

## Verification and acceptance

Use focused behavioral tests for natural-language filters, accent/alias matching,
strict budget/spec boundaries, ambiguous names, product/variant price alignment,
inactive listings, same-category comparisons, missing specs and source handling.

Exercise a complete mocked server conversation: search -> cards -> follow-up
selecting first two -> comparison, including isolation across users/conversations,
history reconstruction, stale products and provider failure. Existing text-only
conversation data must still load.

Verify the browser interaction with actual available products or isolated
fixtures: card navigation, separate selection buttons, two-item limit,
comparison links, loading/errors and mobile containment. Avoid mutating the
live database just to create fixtures.

Run relevant existing unit suites plus lint, type/build checks, architecture
check and the 35-model registry gate. Integration checks use a dedicated test
database only; report any unavailable dependencies precisely. Acceptance does
not claim live catalog migration until the validated change report is applied
and verified.

## Decisions left to the implementer

Choose component names, exact DTO field names, compact styling, parsing helpers,
safe context persistence details, and whether to adapt the existing comparison
modal or extract a reusable table. Keep the user behaviors and evidence boundary
above. Prefer small shared normalization changes over parallel inconsistent
comparison implementations.
