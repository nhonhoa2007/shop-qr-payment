# Đặc tả thiết kế mở rộng cửa hàng điện tử và trợ lý tư vấn có căn cứ

- **Dự án:** Shop QR Payment
- **Ngày phê duyệt ban đầu:** 17/10/2026
- **Bản sửa đổi kiến trúc:** 17/10/2026 — compact-schema revision
- **Trạng thái:** Đã chốt phạm vi và kiến trúc dữ liệu
- **Phạm vi:** Nghiệp vụ, dữ liệu, backend, AI, kiểm thử và lộ trình M0–M7. Không redesign UI.

---

## 1. Ý định và giá trị đồ án

Dự án được định vị thành **cửa hàng điện tử một người bán**, tập trung vào laptop, điện thoại và phụ kiện. Giá trị khác biệt không nằm ở số lượng SKU mà ở một chu trình có thể giải thích và kiểm chứng:

1. Khách lọc đúng thiết bị theo nhu cầu;
2. Hệ thống so sánh 2–3 sản phẩm bằng dữ liệu có cấu trúc;
3. Hệ thống chấm điểm hiệu năng/giá (P/P) riêng cho từng nhu cầu;
4. Trợ lý AI giải thích kết quả bằng evidence có thể truy vết;
5. Khách mua qua VietQR/ví/GHN hiện có;
6. Sau bán hàng, khách theo dõi bảo hành hoặc đổi/trả;
7. Nhân viên quản lý nhập hàng, tồn kho, serial/IMEI và audit log.

AI không phải nguồn sự thật. Giá, tồn kho, doanh số, P/P, tương thích, quyền và mọi mutation domain do backend quyết định.

### 1.1. Mục tiêu học thuật

- Mô hình hóa domain điện tử thay vì chỉ CRUD sản phẩm;
- Công thức scoring có version, nguồn và khả năng tái lập;
- AI có grounding, citation, abstention và eval;
- Các luồng tiền/kho/nhập hàng/hậu mãi chứng minh concurrency và idempotency;
- Một kịch bản demo xuyên suốt từ tư vấn đến hậu mãi.

### 1.2. Không nằm trong phạm vi

- Marketplace đa người bán, hoa hồng hay quyết toán seller;
- Trả góp, trade-in, loyalty, flash sale, đa chi nhánh;
- Fine-tune để ghi nhớ giá/tồn kho/spec thường xuyên thay đổi;
- Cho AI đặt hàng, đổi giá, hoàn tiền, chỉnh kho hoặc duyệt bảo hành;
- Thiết kế lại design system/giao diện tổng thể.

### 1.3. Anti-goals

Hệ thống được xem là sai dù chức năng chạy nếu:

- P/P không chỉ ra rubric version, evidence và thời điểm tính;
- AI bịa số liệu, trộn model/variant/market hoặc suy đoán tương thích;
- External/synthetic review được trình bày như verified review tại shop;
- Replay webhook/receipt/return gây double debit, double stock hoặc double refund;
- Admin stock edit ghi đè reservation;
- Schema bị phân mảnh thành EAV/child tables không mang vòng đời độc lập;
- Prisma schema vượt ngân sách model ở Section 4.

---

## 2. Nền tảng và ràng buộc phải giữ

### 2.1. Stack và layer boundaries

- Next.js 16 App Router, React 19, TypeScript strict;
- Prisma 6 + PostgreSQL;
- `@client` chỉ gọi HTTP/Pusher, không import `@server` hoặc Prisma;
- `@shared` là shared kernel thuần;
- API route là facade mỏng đến controller;
- Node native test runner, alias hook và `npm run arch:check`;
- Trước khi sửa Next.js phải đọc guide phù hợp trong `node_modules/next/dist/docs/` theo `AGENTS.md`.

### 2.2. Baseline M0 đã có

M0 đã cung cấp các contract load-bearing mà mọi milestone sau phải tái sử dụng:

- VND lưu bằng `BigInt`; JSON dùng `MoneyVnd` decimal string;
- Wallet payment claim bằng CAS và rollback khi post-claim thất bại;
- `InventoryMode` BASE/VARIANT tường minh;
- `stockVersion` và `StockAdjustment` là seam tạm thời chống overwrite;
- Packing snapshot dùng chung cho quote và fulfillment;
- Đơn giá trị cao đi qua manual fulfillment review;
- Catalog aggregate chỉ dùng review `isApproved: true`;
- Permission vocabulary gồm `inventory`, `warranties`, `knowledge`, `scoring`, `assistant`.

`StockAdjustment` là model chuyển tiếp và bắt buộc được migrate vào `InventoryMovement` ở M5.

---

## 3. Nguyên tắc compact-schema

### 3.1. Khi nào được tạo model Prisma

Chỉ tạo model riêng khi thực thể có ít nhất một trong các đặc điểm:

- Vòng đời độc lập và cần FK/ownership rõ;
- High-cardinality query cần index quan hệ;
- Ghi append-only/concurrent ledger;
- Cần unique constraint hoặc CAS ở database;
- Là aggregate root nghiệp vụ được thao tác độc lập.

Dùng `Json`/PostgreSQL `jsonb` khi dữ liệu:

- Thuộc vòng đời của parent;
- Có số phần tử nhỏ/bounded;
- Không cần FK độc lập;
- Có schema version và validation ứng dụng;
- Chỉ cần JSON-path/GIN query trong phạm vi catalog 40–60 product models.

Mọi JSON domain phải có:

1. Shared DTO/schema tường minh;
2. Validation server-side trước khi ghi;
3. `schemaVersion` hoặc parent version;
4. Canonical serialization để hash/replay;
5. GIN/expression index nếu dùng cho filter production;
6. Migration khi shape thay đổi.

### 3.2. Điều bị cấm

Không tạo các model sau trong phạm vi M1–M7:

- EAV: `AttributeDefinition`, `CategoryAttribute`, `ProductAttributeValue`;
- Option/image child tables: `ProductOptionDefinition`, `ProductOptionValue`, `ProductImage`;
- Source fragmentation: `ProductSource`, `ExternalReviewSource`, `BenchmarkSource`;
- Raw review decomposition: `ExternalReview`, `ReviewAspectSignal`;
- Rubric/citation/usage child tables: `ScoringRubric`, `Citation`, `AssistantUsage`;
- Materialized compatibility pair: `CompatibilityAssertion`;
- Procurement duplication: `GoodsReceipt`, `GoodsReceiptItem`;
- Duplicate stock store: `InventoryBalance`;
- Serial child identifier: `SerializedUnitIdentifier`;
- Policy/event/item fragmentation: `WarrantyPolicy`, `WarrantyEvent`, `ReturnItem`, `ReturnEvent`;
- Duplicate refund ledger: `RefundOperation`.

Nếu một yêu cầu mới cần một trong các bảng trên, phải viết ADR chứng minh tại sao JSON/parent/ledger hiện có không đáp ứng được và model nào khác được loại bỏ hoặc tại sao vẫn không vượt budget.

---

## 4. Ngân sách database: 34 model mục tiêu, 40 model tuyệt đối

### 4.1. Quy tắc ngân sách

- **Thiết kế đã chốt:** đúng **34 Prisma models** sau M6;
- **Khoảng đệm thiết kế:** tối đa **37 models**, chỉ dùng sau ADR và review;
- **Hard cap:** **40 models**; vượt 40 là vi phạm spec, không được merge;
- Mỗi migration tạo model phải cập nhật model registry và chạy `npm run schema:budget`;
- Việc đổi enum/field/index không làm tăng model count;
- Không tính PostgreSQL migration metadata do Prisma quản lý.

### 4.2. Registry đích chính xác — 34 models

#### A. Core commerce giữ lại — 18 models

| # | Model | Vai trò |
|---:|---|---|
| 1 | `User` | Customer/Staff/Admin identity |
| 2 | `StaffPermission` | Quyền granular của staff |
| 3 | `OtpCode` | OTP đăng ký/reset |
| 4 | `Product` | Product aggregate và catalog JSON |
| 5 | `ProductVariant` | SKU, giá, option/spec override và projection kho |
| 6 | `Order` | Đơn hàng/FSM/payment/fulfillment |
| 7 | `BankTransfer` | Sổ webhook VietQR/Casso và reconciliation |
| 8 | `RefundCase` | Một operation hoàn tiền có source key idempotent |
| 9 | `OrderItem` | Dòng đơn + immutable commercial snapshots |
| 10 | `Coupon` | Chính sách giảm giá/usage counters |
| 11 | `Review` | Verified in-shop review |
| 12 | `Wishlist` | Danh sách quan tâm |
| 13 | `ChatRoom` | Chat CSKH 1 khách–1 staff được gán |
| 14 | `Message` | Tin nhắn CSKH người–người |
| 15 | `Notification` | Thông báo trong ứng dụng |
| 16 | `Shipment` | Vận đơn/carrier lifecycle |
| 17 | `UserWallet` | Projection số dư ví |
| 18 | `WalletTransaction` | Ledger ví |

#### B. Catalog và commerce intelligence — 8 models

| # | Model | Vai trò |
|---:|---|---|
| 19 | `Brand` | Hãng sản xuất |
| 20 | `Category` | Cây danh mục + `specSchema`, `scoringConfig`, `warrantyConfig` JSON |
| 21 | `DataSource` | Nguồn/provenance/licensing và approved evidence payload hợp nhất |
| 22 | `BenchmarkMeasurement` | Measurement high-cardinality có source/product/variant/metric |
| 23 | `ProductScoreSnapshot` | Snapshot P/P bất biến, rubric/evidence/breakdown JSON |
| 24 | `AssistantConversation` | Phiên assistant riêng, retention 30 ngày |
| 25 | `AssistantMessage` | Message + citations/usage/claims JSON |
| 26 | `CompatibilityRule` | Rule tương thích có version và nguồn |

#### C. Operations và hậu mãi — 8 models

| # | Model | Vai trò |
|---:|---|---|
| 27 | `Supplier` | Nhà cung cấp |
| 28 | `PurchaseOrder` | PO header/FSM |
| 29 | `PurchaseOrderItem` | Quantity/cost/received projection cần CAS |
| 30 | `InventoryMovement` | Ledger kho append-only, operation key duy nhất |
| 31 | `SerializedUnit` | Serial/IMEI và lifecycle thiết bị vật lý |
| 32 | `WarrantyClaim` | Claim + timeline/evidence JSON có version |
| 33 | `ReturnRequest` | Partial return + items/timeline/allocation JSON có version |
| 34 | `AdminAuditLog` | Audit bất biến, redacted |

### 4.3. Bốn model hiện tại phải được hợp nhất/retire

| Model hiện tại | Đích | Milestone | Quy tắc migration |
|---|---|---|---|
| `StockAdjustment` | `InventoryMovement(kind=ADJUST)` | M5 | Backfill theo `operationKey`, đối soát delta/version rồi drop |
| `Transaction` | `BankTransfer(status=APPLIED_ORDER)` | M5 | Backfill bank transaction/fingerprint, chuyển mọi reader rồi drop |
| `CouponUsage` | `Order.couponId/userId/usageClaimedAt` | M5 | Đối soát count/per-user; claim trong transaction rồi drop |
| `ChatRoomParticipant` | `ChatRoom.customerId/assignedStaffId/readAt` | M5 | Chỉ chấp nhận room 1:1; room bất thường vào migration report rồi drop |

Migration dùng expand → backfill → switch readers/writers → reconcile → contract. Trong giai đoạn expand, tổng model vẫn không được vượt 37.

### 4.4. Model count theo milestone

| Mốc | Thay đổi | Count sau mốc |
|---|---|---:|
| M0 hiện tại | 22 models | 22 |
| M1 | + `Brand`, `Category`, `DataSource` | 25 |
| M2 | + `BenchmarkMeasurement`, `ProductScoreSnapshot` | 27 |
| M3 | + `AssistantConversation`, `AssistantMessage` | 29 |
| M4 | + `CompatibilityRule` | 30 |
| M5 expand | + 6 operations models | 36 (peak) |
| M5 contract | − 4 legacy models | 32 |
| M6 | + `WarrantyClaim`, `ReturnRequest` | **34 final** |
| M7 | Không thêm model | **34** |

---

## 5. Catalog điện tử dùng JSONB có kiểm soát

### 5.1. Category và schema

`Category` là cây (`parentId`, `slug`, `kind`) và chứa:

- `specSchema Json`: DSL được validate, liệt kê field code, label, type, unit, enum values, required/filterable/comparable và knowledge semantics;
- `specSchemaVersion Int`;
- `scoringConfig Json`: rubric theo use case, weights, thresholds, prior và version;
- `warrantyConfig Json`: thời hạn/điều khoản mặc định;
- GIN index cho trường JSON cần query; expression indexes cho filter nóng được chứng minh bằng query plan.

Không cho admin nhập arbitrary JSON. Controller parse qua shared schema; unknown keys bị từ chối.

### 5.2. Product và ProductVariant

`Product` bổ sung:

- `brandId`, `categoryId`, `kind`, `segment`, `isLegacy`;
- `specs Json` với `schemaVersion` và `KnowledgeState = KNOWN | UNKNOWN | UNSUPPORTED`;
- `images Json`: array bounded `{url, alt, sortOrder, sourceId?}`;
- `editorialTags Json`: tag, evidence, approval/override metadata;
- `warrantyConfig Json?` override category;
- physical dimensions M0 tiếp tục là cột typed vì tham gia invariant vận chuyển.

`ProductVariant` bổ sung:

- `optionValues Json`: canonical array/map cho RAM/storage/color/connectivity;
- `specOverrides Json`: chỉ override field variant-specific;
- `images Json` và `warrantyConfig Json?`;
- `serializationRequired Boolean`;
- `optionHash` unique theo product để chặn hai SKU cùng cấu hình.

`color`/`size` cũ chỉ là compatibility fields trong migration; API mới không phụ thuộc riêng vào `size`.

### 5.3. Tìm kiếm, lọc và so sánh

- Lọc chung: category, brand, segment, effective price, stock;
- Lọc theo JSON spec bằng allowlisted key/operator/unit;
- Normalize đơn vị trước khi ghi và so sánh;
- `UNKNOWN` khác `UNSUPPORTED`;
- Sort giá dùng minimum active/sellable SKU BigInt, không sort decimal string ở client;
- So sánh 2–3 sản phẩm cùng leaf category và exact variant;
- Không chọn “tốt nhất” trước khi biết nhu cầu.

### 5.4. Provenance hợp nhất trong DataSource

`DataSource` có `sourceType` như `CATALOG`, `REVIEW_AGGREGATE`, `BENCHMARK`, `COMPATIBILITY`, metadata publisher/URL/license/market/checksum/version và state:

`DISCOVERED → LICENSE_REVIEW → MAPPING_REVIEW → APPROVED → ACTIVE`, nhánh `REJECTED | REVOKED`.

Chỉ `ACTIVE` tham gia scoring/retrieval. `payload Json` chứa normalized evidence bounded theo source type:

- Catalog facts và mapping exact product/variant/market;
- Review aggregate theo aspect (`count`, adjusted inputs, positive/negative signals), không copy raw corpus nếu license không cho phép;
- Methodology/attribution metadata;
- Synthetic flag rõ ràng.

Benchmark numeric high-cardinality nằm ở `BenchmarkMeasurement`, không nhồi vào payload.

---

## 6. Scoring P/P và comparison

### 6.1. Use cases

- Laptop: office/study, programming, gaming, creative;
- Phone: everyday, gaming, photo/video;
- Accessory: rubric riêng theo leaf category.

### 6.2. Pipeline

Với category + use case:

1. Xác định cohort hợp lệ;
2. Normalize metric bằng percentile/winsorized min-max;
3. Đảo chiều lower-is-better;
4. Tính capability từ specs/benchmarks;
5. Tính experience từ shop review và external aggregate tách nguồn;
6. Tính price efficiency bằng BigInt/fixed-point;
7. Chỉ publish nếu đạt coverage;
8. Ghi immutable `ProductScoreSnapshot`.

Công thức khởi điểm:

```text
FinalScore = 0.65 × PriceEfficiency + 0.25 × Experience + 0.10 × Support
```

Rubric versioned nằm trong `Category.scoringConfig`; snapshot lưu `rubricSnapshot`, `breakdown`, `sourceRefs`, `missingEvidence`, `sourceSetHash`, `priceSnapshot`, confidence và coverage. Không cần `ScoringRubric` model.

Rating dùng Bayesian adjustment:

```text
AdjustedRating = (v/(v+m)) × R + (m/(v+m)) × C
```

Doanh số chỉ từ OrderItem thuộc order COMPLETED, trừ quantity đã return; là popularity signal riêng, không đi vào P/P.

---

## 7. Trợ lý AI có căn cứ

### 7.1. Tách khỏi Chat CSKH

`AssistantConversation`/`AssistantMessage` là phân hệ riêng. Không giả assistant thành `User` trong `Message`.

`AssistantMessage` nhúng:

- `citations Json` với evidence IDs;
- `usage Json` với model/provider/token/cost/latency đã redaction;
- `claims Json` cho validator;
- structured response/fallback metadata.

Không tạo `Citation` hoặc `AssistantUsage` model.

### 7.2. Flow

1. Xác thực user hoặc anonymous session hash;
2. Rate/quota limit fail-closed;
3. Validate input/size;
4. Gọi deterministic services lấy products, live price/stock, score, sales, review aggregate, compatibility;
5. Lấy DataSource ACTIVE đúng variant/market/version;
6. Xây evidence bundle có ID;
7. Gọi provider-neutral adapter;
8. Validate structured output, citations và numeric claims;
9. Grounding thất bại thì trả deterministic fallback/insufficient data;
10. Lưu redacted conversation và usage;
11. Retention 30 ngày, hỗ trợ xóa sớm.

Interaction mặc định: so sánh tổng quan trước, sau đó hỏi đúng một câu về nhu cầu chính.

Model mặc định là `ag/gemini-3.8-flash-high`. Transport thật bị block cho đến khi có endpoint/request-response/auth/error docs; không đoán OpenAI-compatible hay Gemini-native.

### 7.3. An toàn

- Secret server-only;
- Review/document là data, không phải instruction;
- Không gửi PII/order history/ảnh bảo hành không cần thiết;
- Quota dùng Redis atomic primitive, không tạo quota table;
- Không stream claim chưa validation;
- Unit suite dùng fake provider, không gọi model thật;
- Ít nhất 100 eval cases, giữ held-out split.

---

## 8. Compatibility engine

`CompatibilityRule` lưu direction, category scope, conditions/warnings JSON, source/version/approval. Engine deterministic trả:

- `COMPATIBLE`: mọi predicate bắt buộc có đủ evidence;
- `INCOMPATIBLE`: có mismatch được chứng minh;
- `UNKNOWN`: thiếu/contradictory evidence.

Không tạo `CompatibilityAssertion`; kết quả pair được tính lúc đọc và có thể cache Redis theo rule/spec revision. AI chỉ diễn giải output.

---

## 9. Procurement, inventory và serialized units

### 9.1. Projection và ledger

Không tạo `InventoryBalance`. `InventoryMovement` là ledger append-only; Product/ProductVariant giữ projection để đọc nhanh:

- `onHandStock`;
- `reservedStock`;
- `quarantinedStock`;
- `stock` tiếp tục là compatibility projection của `available = onHand - reserved`;
- `stockVersion` dùng CAS.

Movement có `operationKey` unique, request fingerprint, deltas, before/after version, kind, actor/reason và reference. Mọi projection update và movement insert nằm cùng transaction.

Các kind tối thiểu: `OPENING_LEGACY`, `RESERVE`, `RELEASE`, `SHIP`, `RECEIVE`, `QUARANTINE`, `RESTOCK`, `ADJUST`.

### 9.2. PO và receipt không tạo bảng riêng

- `PurchaseOrder`: header/FSM;
- `PurchaseOrderItem`: ordered/received quantity và unit cost BigInt;
- Mỗi lần nhận hàng tạo `InventoryMovement(RECEIVE)` có `purchaseOrderItemId`, batch/reference và operation key;
- PO status được suy từ received projection;
- Không tạo `GoodsReceipt`/`GoodsReceiptItem`.

### 9.3. SerializedUnit

Một row chứa các identifier bounded:

- `serialNumber`;
- `imei1`;
- `imei2`;

Mỗi cột nullable có unique constraint và normalization. Laptop/phone bắt buộc assignment trước shipment; phụ kiện theo `serializationRequired`. Không backfill mã giả cho legacy.

---

## 10. Warranty, return và refund

### 10.1. Warranty policy và claim

Policy nằm ở Category, có thể override Product/Variant và được snapshot vào OrderItem. Không tạo `WarrantyPolicy`.

Mặc định laptop/phone 12 tháng từ Order COMPLETED nếu SKU chưa override; accessory phải có policy cụ thể. `WarrantyClaim` chứa status, version, outcome, `timeline Json`, `evidenceRefs Json` và serialized unit link. Transition dùng expected-version CAS; AdminAuditLog ghi action bất biến.

FSM:

`SUBMITTED → RECEIVED → INSPECTING → WAITING_PARTS → RESOLVED`, với `REJECTED | CANCELLED`.

### 10.2. Partial return

`ReturnRequest` chứa bounded `items Json`, mỗi item gồm orderItemId, quantity, unit IDs, entitlement/allocation snapshots; `timeline Json`, status/version và disposition. `OrderItem.returnedQuantity`/refund projection dùng CAS để chặn concurrent over-return.

FSM:

`REQUESTED → APPROVED → ITEM_RECEIVED → INSPECTED → RESOLVED`, với `REJECTED | CANCELLED`.

ITEM_RECEIVED chỉ tăng quarantine. Chỉ `RESTOCKABLE` mới chuyển quarantine sang saleable stock; `REFURBISH`, `DEFECTIVE`, `RETURN_TO_SUPPLIER`, `DISPOSED` không tự restock.

### 10.3. Refund

Không tạo `RefundOperation`. Mở rộng `RefundCase` làm operation record idempotent liên kết ReturnRequest/WarrantyClaim/BankTransfer/Order và WalletTransaction.

- Discount order-level phân bổ bằng largest remainder, tổng đúng từng đồng;
- Shipping mặc định không hoàn; ngoại lệ store-fault cần ADMIN reason/audit;
- Tổng refund lũy kế không vượt entitlement;
- Partial path không gọi nguyên trạng whole-order cancel/refund vì không được release toàn bộ stock/coupon.

---

## 11. Baseline model compaction ở M5

### 11.1. Transaction → BankTransfer

Backfill Transaction thành BankTransfer `APPLIED_ORDER`, tạo fingerprint deterministic, chuyển analytics/readers, đối soát count/sum/bankTransId rồi drop.

### 11.2. CouponUsage → Order

Order giữ couponId, userId và `couponUsageClaimedAt`. Per-user/usage-limit claim dùng transaction/CAS trên Coupon và count Order hợp lệ. Backfill, đối soát và drop CouponUsage.

### 11.3. ChatRoomParticipant → ChatRoom

Mô hình shop 1:1 dùng `customerId`, `assignedStaffId`, `customerReadAt`, `staffReadAt`. Migration phải report room không đúng cardinality; không âm thầm mất participant. Sau switch readers/writers và realtime auth, drop child table.

---

## 12. RBAC, privacy và audit

- `products`: catalog và SKU;
- `inventory`: supplier/PO/movement/serial;
- `warranties`: warranty/return workflow;
- `reviews`: verified review moderation;
- `knowledge`: DataSource và compatibility draft;
- `scoring`: scoring config/recompute draft;
- `assistant`: metadata/handoff monitoring;
- Publish source/rubric, financial refund, reconciliation override và secret config là ADMIN-only.

Page, API và realtime auth phải đồng bộ. `AdminAuditLog` lưu actor/action/entity/before-after allowlist/reason/correlation/time; không lưu secret, password, token, raw payment, full prompt PII hay identifier plaintext không cần thiết.

---

## 13. API/service boundaries

Các route là facade mỏng; service chung được tái sử dụng:

- `/api/catalog/search`, `/api/products/[id]`, `/api/compare`;
- `/api/scores/[productId]`;
- `/api/compatibility/check`;
- `/api/assistant/conversations/**`;
- `/api/warranties/**`, `/api/returns/**`;
- `/api/admin/data-sources/**`;
- `/api/admin/suppliers/**`, `/api/admin/purchase-orders/**`, `/api/admin/inventory/**`;
- `/api/admin/audit-logs`.

Comparison, assistant và UI không được tự triển khai lại scoring/compatibility.

---

## 14. Dữ liệu nguồn và demo

Vertical slice: 2 laptop, 2 phone, 6 accessory product models. M7 mở rộng 40–60 **product models** (không phải Prisma models): 10–15 laptop, 10–15 phone, 20–30 accessories.

- Manufacturer facts và benchmark phải có DataSource ACTIVE;
- Amazon Reviews 2023 chưa được coi là licensed mặc định;
- UCI Sentiment Labelled Sentences chỉ dùng eval, không map product;
- Open Icecat không vào AI pipeline nếu chưa có quyền phù hợp;
- Synthetic data có flag/scope và disclosure, không tham gia production score mặc định;
- Giá/kho/doanh số luôn lấy live service, không đưa vào RAG tĩnh.

---

## 15. Kiểm thử và acceptance criteria

### 15.1. Schema/model budget

- Registry model chính xác theo milestone;
- `schema:budget` fail khi >40 hoặc xuất hiện forbidden model;
- Final M6/M7 đúng 34 models;
- JSON schema validation, version/hash và GIN migration có test/query plan evidence.

### 15.2. Catalog/scoring

- Invalid/unknown spec key/type/unit bị từ chối;
- UNKNOWN khác UNSUPPORTED;
- Effective SKU price/filter/sort chính xác;
- Source revoke loại khỏi retrieval/score ngay;
- Score deterministic, use-case-specific, abstain khi thiếu coverage;
- Recompute tạo snapshot mới, không sửa lịch sử;
- Sales không ảnh hưởng score.

### 15.3. Assistant/compatibility

- Citation/numeric claim ngoài evidence bị từ chối;
- Cross-user/cross-anonymous ownership bị chặn;
- Timeout/quota/malformed/provider error có fallback;
- 100-case offline eval có zero unsupported numeric claims ở held-out threshold đã chốt;
- USB-C nhưng thiếu protocol/power trả UNKNOWN;
- Cart/checkout revalidate live SKU/price/stock.

### 15.4. Money/inventory/after-sales

- Wallet double-pay/payment-expiry race;
- Movement replay/concurrency và projection reconciliation;
- Receipt overrun/replay;
- Serial/IMEI unique và không bán hai lần;
- Return receipt không auto-restock;
- Warranty/return FSM và ownership;
- Partial refund conservation/cap/replay;
- BigInt DTO round-trip;
- Quote/create shipment dùng cùng packing snapshot.

### 15.5. Quality gate

Mỗi milestone chạy targeted tests và:

```bash
npm run test
npm run test:integration
npm run lint
npm run arch:check
npm run build
npx prisma validate
npm run schema:budget
```

Milestone có migration phải rehearsal trên disposable PostgreSQL, backup/rollback và reconcile trước/sau. Không tuyên bố pass nếu chưa chạy và đọc output thật.

---

## 16. Lộ trình M0–M7 và model budget

- **M0 — COMPLETE:** safety foundation, 22 models;
- **M1:** Brand/Category/DataSource + JSON catalog, 25 models;
- **M2:** benchmark + score snapshots, 27 models;
- **M3:** assistant conversations/messages, 29 models;
- **M4:** compatibility rules, 30 models;
- **M5:** ledger/procurement/serial/audit; peak 36 rồi compact còn 32;
- **M6:** warranty/return, final 34;
- **M7:** hardening/data/docs, giữ nguyên 34.

Chi tiết task nằm trong:

- `docs/superpowers/plans/2026-10-17-electronics-commerce-expansion-roadmap.md`;
- `docs/superpowers/plans/2026-10-17-m1-electronics-catalog.md`;
- `docs/superpowers/plans/2026-10-17-m2-m4-commerce-intelligence.md`;
- `docs/superpowers/plans/2026-10-17-m5-m6-operations-aftersales.md`;
- `docs/superpowers/plans/2026-10-17-m7-hardening-release.md`.

---

## 17. Kịch bản demo mục tiêu

1. Khách lọc laptop theo ngân sách/spec/nhu cầu;
2. Chọn hai exact variants để so sánh;
3. Xem P/P theo office/programming/gaming, confidence và missing evidence;
4. Assistant so sánh tổng quan, trích nguồn rồi hỏi một nhu cầu chính;
5. Compatibility engine kiểm tra phụ kiện;
6. Khách checkout, thanh toán và theo dõi shipment;
7. Admin nhập hàng qua PO/movement, gán serial;
8. Khách mở warranty hoặc partial return từ completed order;
9. Staff nhận hàng vào quarantine, inspect và resolve/refund idempotently;
10. Admin xem audit, source và score snapshot đã dùng;
11. `schema:budget` chứng minh hệ thống giữ đúng 34 Prisma models.

---

## 18. Quyết định đã khóa

- UI redesign ngoài scope;
- BigInt/MoneyVnd contract của M0 không đổi;
- JSONB compact catalog được ưu tiên thay EAV;
- Planned final model count là 34, target ceiling 37, hard cap 40;
- Product images/options/specs/citations/usage/timelines/return items/policies là validated JSON, không phải model riêng;
- PurchaseOrderItem được giữ relational vì quantity/cost/receipt concurrency;
- BenchmarkMeasurement được giữ relational vì high-cardinality numeric queries;
- InventoryMovement là ledger; không có InventoryBalance;
- Serialized identifiers là columns trên SerializedUnit;
- RefundCase là operation ledger cho cả full/partial refund;
- Provider transport thật vẫn blocked đến khi có docs;
- Assistant retention 30 ngày;
- Ảnh hậu mãi không đi qua AI;
- Mọi thay đổi registry model cần ADR, migration/reconciliation plan và budget check.
