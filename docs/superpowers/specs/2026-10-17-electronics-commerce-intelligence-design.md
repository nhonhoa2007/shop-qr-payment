# Đặc tả thiết kế mở rộng cửa hàng điện tử và trợ lý tư vấn có căn cứ

- **Dự án:** Shop QR Payment
- **Ngày:** 17/10/2026
- **Trạng thái:** Đã duyệt ngày 17/10/2026
- **Phạm vi tài liệu:** Nghiệp vụ, dữ liệu, backend, AI, kiểm thử và lộ trình triển khai. Không bao gồm thiết kế lại UI.

---

## 1. Ý định và lý do

Dự án sẽ chuyển từ cửa hàng tổng hợp sang **cửa hàng điện tử một người bán**, tập trung vào:

- Laptop;
- Điện thoại;
- Phụ kiện điện tử đi kèm.

Giá trị khác biệt của hệ thống không nằm ở số lượng SKU, mà ở một vòng trải nghiệm có thể chứng minh trong đồ án:

1. Khách tìm và lọc đúng thiết bị theo nhu cầu;
2. Hệ thống so sánh hai sản phẩm bằng dữ liệu có cấu trúc;
3. Hệ thống chấm điểm hiệu năng/giá (P/P) riêng cho từng nhu cầu;
4. Trợ lý AI giải thích thông số, doanh số và phản hồi bằng căn cứ có thể truy vết;
5. Khách mua qua luồng VietQR/ví/GHN đang có;
6. Sau bán hàng, khách theo dõi bảo hành hoặc đổi/trả;
7. Nhân viên quản lý nguồn hàng, tồn kho, serial/IMEI và nhật ký thao tác.

Hệ thống không được biến AI thành nguồn sự thật. Các phép tính, giá, tồn kho, doanh số, điều kiện bảo hành và quyền thực hiện hành động vẫn do backend quyết định.

---

## 2. Mục tiêu

### 2.1. Mục tiêu sản phẩm

- Xây danh mục điện tử có thông số chuẩn hóa nhưng vẫn đủ linh hoạt cho nhiều loại thiết bị.
- Hỗ trợ biến thể thực tế: cấu hình, RAM, dung lượng, màu, kết nối; mỗi SKU có giá và tồn kho riêng.
- Cho phép so sánh 2–3 sản phẩm cùng loại theo các tiêu chí tương đương.
- Có điểm P/P riêng theo nhu cầu thay vì một điểm chung gây hiểu nhầm.
- Kết hợp đánh giá đã xác minh tại shop với dữ liệu bên ngoài có quyền sử dụng rõ ràng.
- Cho phép trợ lý AI so sánh tổng quan trước, sau đó hỏi nhu cầu để tư vấn sâu hơn.
- Xây quy trình bảo hành và đổi/trả có trạng thái, căn cứ và lịch sử.
- Quản lý nhập hàng, biến động kho, serial/IMEI và nhật ký quản trị.
- Giữ nguyên các bất biến quan trọng của thanh toán, đơn hàng, coupon, vận chuyển và kho.

### 2.2. Mục tiêu học thuật

- Chứng minh mô hình hóa domain điện tử thay vì chỉ CRUD sản phẩm.
- Chứng minh tính minh bạch của công thức chấm điểm và khả năng tái lập kết quả.
- Chứng minh AI có grounding, citation, giới hạn an toàn và bộ đánh giá riêng.
- Chứng minh xử lý đồng thời và tính idempotent ở các luồng tiền, kho, bảo hành và nhập hàng.
- Có kịch bản demo xuyên suốt từ tư vấn đến hậu mãi ở cả khách hàng và quản trị.

---

## 3. Ngoài phạm vi và anti-goals

### 3.1. Không làm trong phạm vi này

- Không chuyển thành sàn đa người bán kiểu Shopee.
- Không xây hệ thống hoa hồng, quyết toán nhà bán hoặc tranh chấp giữa nhiều nhà bán.
- Không để chatbot đặt hàng, đổi giá, hoàn tiền, sửa đơn hoặc duyệt bảo hành.
- Không tự huấn luyện foundation model từ đầu.
- Không coi RAG là “train model”.
- Không fine-tune để ghi nhớ giá, tồn kho hoặc thông số thường xuyên thay đổi.
- Không triển khai trả góp, trade-in, loyalty, flash sale hoặc đa chi nhánh trong đợt này.
- Không thiết kế lại UI trong tài liệu này.

### 3.2. Những điều được xem là thất bại dù chức năng chạy

- Điểm P/P không giải thích được công thức, nguồn, phiên bản và ngày tính.
- Trợ lý bịa thông số, trộn biến thể, hoặc khẳng định tương thích khi thiếu căn cứ.
- Đánh giá bên ngoài được hiển thị như đánh giá mua tại shop.
- Dữ liệu mô phỏng bị trình bày như dữ liệu người dùng thật.
- Sản phẩm bán chạy tự động được xem là sản phẩm tốt hơn.
- Nhập/trả/bảo hành làm cộng hoặc trừ kho hai lần.
- Thay đổi giá/tồn kho từ trang admin ghi đè reservation hoặc làm sai tổng tiền đơn hàng.
- Tính năng mới làm suy yếu RBAC hoặc làm lộ khóa AI ở client.

---

## 4. Ràng buộc và nền tảng hiện tại

### 4.1. Kiến trúc phải giữ

- Next.js 16 App Router và React 19;
- Prisma + PostgreSQL;
- `@client` chỉ giao tiếp backend qua HTTP/Pusher, không import `@server` hoặc Prisma;
- `@shared` là shared kernel thuần;
- API routes là facade mỏng đến controller;
- Server Components có thể gọi service server và truyền DTO sang view;
- Node native test runner, alias hook và `npm run arch:check` tiếp tục được dùng.

Trước khi sửa mã Next.js ở từng giai đoạn, phải đọc đúng guide tương ứng trong `node_modules/next/dist/docs/` theo yêu cầu của `AGENTS.md`.

### 4.2. Nền đang tái sử dụng

Hệ thống đã có:

- Product/ProductVariant, SKU, giá và kho theo biến thể;
- Catalog search/category/sort/pagination;
- Checkout định giá phía server, CAS giữ kho và FSM đơn hàng;
- VietQR/Casso, sổ BankTransfer, ví nội bộ và refund;
- GHN quote/fulfillment/webhook;
- Review của người mua đã xác minh;
- CUSTOMER/STAFF/ADMIN và staff permission;
- Chat CSKH người–người qua Pusher;
- Redis/Upstash với fallback local;
- Unit tests và một suite integration với PostgreSQL.

### 4.3. Khoảng trống hiện tại

- Category chỉ là chuỗi; chưa có Brand, cây danh mục hoặc schema thuộc tính.
- Variant chỉ có `color`/`size`; chưa mô hình hóa cấu hình thiết bị.
- Chưa có gallery, nguồn thông số, benchmark, external review, scoring rubric hoặc score snapshot.
- Chưa có serial/IMEI, bảo hành/RMA, nhà cung cấp, phiếu nhập hoặc inventory ledger.
- Chat hiện tại là chat CSKH, không có assistant role, citation, usage hoặc streaming AI.
- Chưa có AI provider adapter.
- Trọng lượng vận chuyển đang dùng fallback/hardcode và chưa đồng nhất quote với fulfillment.
- Tiền đang dùng PostgreSQL/Prisma `Int`, có nguy cơ vượt Int32 với thiết bị giá cao và giỏ nhiều món.
- Admin stock edit hiện là ghi đè tuyệt đối và có thể race với checkout/reservation.

---

## 5. Phạm vi chức năng đã chốt

### 5.1. Catalog điện tử

#### Danh mục

- Laptop;
- Điện thoại;
- Phụ kiện, tối thiểu gồm sạc/cáp/hub, tai nghe, chuột, bàn phím và màn hình.

Mỗi loại phụ kiện có thể có bộ thông số riêng; không ép toàn bộ sản phẩm dùng các cột laptop/điện thoại.

#### Phân khúc chính

Mỗi sản phẩm có đúng một phân khúc chính trong danh mục của nó:

- `BUDGET` — phổ thông;
- `MID_RANGE` — tầm trung;
- `PREMIUM` — cao cấp;
- `FLAGSHIP` — dòng chủ lực.

Ngưỡng giá là dữ liệu cấu hình riêng cho từng danh mục và có phiên bản theo thời gian. Phân khúc không được suy ra từ một ngưỡng giá chung cho mọi danh mục.

#### Nhãn tuyển chọn

Một sản phẩm có thể có nhiều nhãn:

- `FLAGSHIP_KILLER`;
- `GOOD_VALUE`;
- Các nhãn biên tập khác về sau.

`FLAGSHIP_KILLER` là nhãn có căn cứ và yêu cầu duyệt của quản trị viên; không được AI tự gắn. `GOOD_VALUE` được tạo từ kết quả scoring đủ dữ liệu, nhưng quản trị viên vẫn có quyền ẩn nhãn nếu phát hiện dữ liệu nguồn sai; mọi override phải có lý do và audit log.

### 5.2. Tìm kiếm và lọc

- Lọc chung: danh mục, hãng, phân khúc, khoảng giá, tình trạng còn hàng;
- Lọc laptop: CPU, GPU, RAM, SSD, kích thước/tần số màn hình, trọng lượng;
- Lọc điện thoại: chip, RAM, dung lượng, màn hình, camera, pin, chuẩn sạc;
- Lọc phụ kiện: loại, kết nối, công suất, chuẩn/giao thức và thiết bị tương thích;
- Lọc theo nhu cầu và ngưỡng điểm P/P;
- Sort theo giá hiệu lực của SKU bán được, không chỉ `Product.price` nếu sản phẩm có nhiều biến thể.

### 5.3. So sánh sản phẩm

- So sánh 2–3 sản phẩm cùng leaf category;
- Chuẩn hóa đơn vị trước khi so sánh;
- Chỉ so sánh cùng một nghĩa thuộc tính;
- Hiển thị thông số thiếu là “chưa có dữ liệu”, khác với “không hỗ trợ”;
- Hiển thị giá hiện tại, biến thể đang so sánh và ngày cập nhật;
- Hiển thị điểm P/P theo từng nhu cầu, mức độ tin cậy và dữ liệu còn thiếu;
- Hiển thị lượng mua hợp lệ trong cùng khoảng thời gian;
- Hiển thị tổng hợp chủ đề tích cực/tiêu cực, tách nguồn trong shop và bên ngoài;
- Không tự chọn “tốt nhất” khi khách chưa cho biết nhu cầu.

### 5.4. Trợ lý tư vấn AI

Luồng mặc định khi khách yêu cầu so sánh:

1. So sánh tổng quan ngay;
2. Dựa trên dữ liệu có cấu trúc và snapshot scoring;
3. Tóm tắt doanh số và phản hồi theo nguồn;
4. Nêu giới hạn/mức độ chắc chắn;
5. Hỏi **một câu** về nhu cầu chính;
6. Tư vấn sâu hơn sau khi nhận câu trả lời.

Trợ lý hỗ trợ:

- Giải thích thông số;
- So sánh sản phẩm;
- Tư vấn theo ngân sách/nhu cầu;
- Giải thích điểm P/P;
- Kiểm tra tương thích dựa trên rule và dữ liệu;
- Trích dẫn tài liệu hoặc dữ kiện đã dùng.

Trợ lý không được:

- Tự phát minh thông số, benchmark, giá, tồn kho, doanh số hoặc review;
- Khẳng định tương thích chỉ vì hai thiết bị cùng có USB-C;
- Tự thay đổi dữ liệu hoặc thực hiện giao dịch;
- Tự gắn nhãn biên tập;
- Trộn câu trả lời từ model/biến thể/thị trường khác;
- Đọc dữ liệu đơn hàng cá nhân nếu chưa xác thực quyền sở hữu.

### 5.5. Phụ kiện tương thích và mua kèm

- Dùng rule có cấu trúc, không chỉ embedding/AI;
- Rule có direction, điều kiện bắt buộc, điều kiện cảnh báo và mức tin cậy;
- Ví dụ: connector vật lý, protocol, công suất đầu ra, công suất đầu vào, profile sạc, kích thước, hệ điều hành;
- AI chỉ giải thích kết quả rule;
- Giá/tồn kho được kiểm tra lại khi thêm vào giỏ;
- Bundle không khóa khách phải mua toàn bộ.

### 5.6. Bảo hành và đổi/trả

#### Bảo hành

- Chỉ tạo từ OrderItem thuộc khách và đơn đủ điều kiện;
- Có thể gắn serial/IMEI đã bán;
- Khách cung cấp mô tả, ảnh và loại vấn đề;
- Trạng thái đề xuất:
  `SUBMITTED → RECEIVED → INSPECTING → WAITING_PARTS → RESOLVED`,
  với nhánh `REJECTED` hoặc `CANCELLED`;
- Kết quả có thể là sửa chữa, đổi thiết bị, hoàn trả không liên quan tiền, hoặc chuyển sang quy trình refund được kiểm soát;
- Mọi chuyển trạng thái lưu actor, thời gian, ghi chú và bằng chứng.

#### Đổi/trả

- Là quy trình riêng với bảo hành;
- Trạng thái đề xuất:
  `REQUESTED → APPROVED → ITEM_RECEIVED → INSPECTED → RESOLVED`,
  với nhánh `REJECTED` hoặc `CANCELLED`;
- Nhận hàng trả về không đồng nghĩa tự động cộng kho bán được;
- Sau kiểm tra, hàng vào một trong các disposition: `RESTOCKABLE`, `REFURBISH`, `DEFECTIVE`, `RETURN_TO_SUPPLIER`, `DISPOSED`;
- Refund gọi engine tiền hiện có qua operation key idempotent, không viết lại logic cộng ví/BankTransfer tùy ý.

### 5.7. Nhà cung cấp, phiếu nhập và tồn kho

- Quản lý Supplier;
- Purchase Order có trạng thái `DRAFT → ORDERED → PARTIALLY_RECEIVED → RECEIVED/CANCELLED`;
- Receipt ghi nhận số lượng thực nhận, giá vốn, serial/IMEI nếu có;
- Inventory ledger bất biến ghi mọi biến động;
- Không cho sửa trực tiếp số tồn tuyệt đối từ admin sau khi ledger hoạt động; điều chỉnh phải tạo movement có lý do;
- Phân biệt tối thiểu:
  - `onHand`;
  - `reserved`;
  - `available = onHand - reserved`;
  - `quarantined`;
- Reservation/release/receive/return/adjustment đều có `operationKey` duy nhất để chống lặp.

### 5.8. Nhật ký quản trị

Audit log ghi:

- Actor, role và permission;
- Action;
- Entity type/id;
- Before/after ở mức field phù hợp;
- Reason;
- Request/correlation ID;
- Thời gian;
- IP/user-agent nếu chính sách riêng tư cho phép.

Không lưu API key, mật khẩu, token, nội dung prompt chứa PII hoặc dữ liệu thanh toán nhạy cảm vào audit log.

Các hành động bắt buộc audit: sửa giá, đổi trạng thái active, nhập/điều chỉnh kho, xử lý serial, duyệt nguồn, đổi scoring rubric, override nhãn, xử lý bảo hành/đổi trả, refund, đối soát và cấp quyền.

---

## 6. Thiết kế dữ liệu

### 6.1. Nguyên tắc mô hình hóa catalog

Dùng mô hình lai:

- Các trường cần join/filter/invariant mạnh được chuẩn hóa thành bảng/cột;
- Thông số mở rộng theo danh mục dùng schema định nghĩa + value có kiểu;
- Không lưu toàn bộ thông số dưới một JSON tự do vì khó validate, filter và so sánh;
- Không tạo hàng trăm cột nullable cho mọi loại thiết bị.

### 6.2. Thực thể đề xuất

#### Catalog

- `Brand`
- `Category` với `parentId`, `slug`, `kind`
- `AttributeDefinition`
  - code, label, valueType, unit, comparability, filterability;
- `CategoryAttribute`
  - categoryId, attributeId, required, sortOrder;
- `ProductAttributeValue`
  - productId/variantId, attributeId, typed value;
- `ProductImage`
  - productId/variantId, URL, alt, sortOrder;
- `ProductSource`
  - source type, publisher, URL, license status, market, checkedAt, checksum/version;
- mở rộng `Product` với brand/category/segment/physical dimensions/warranty policy;
- mở rộng `ProductVariant` với option values chung thay cho phụ thuộc cứng vào size.

`color` và `size` cũ được migrate thành option values hoặc giữ tạm như trường legacy trong một giai đoạn chuyển đổi. API mới không tiếp tục thiết kế phụ thuộc riêng vào “size”.

#### Dữ liệu đánh giá và benchmark

- `ExternalReviewSource`
  - publisher, dataset URL, license, attribution, allowed uses, checkedAt;
- `ExternalReview`
  - sourceId, externalId, product/variant mapping, rating, title/text, language, timestamp, verified flag của nguồn, helpful count, provenance;
- `ReviewAspectSignal`
  - review origin/id, aspect, sentiment, confidence, analyzerVersion;
- `BenchmarkSource`
- `BenchmarkMeasurement`
  - metric, value, unit, methodology, device/variant, measuredAt, source;
- `ScoringRubric`
  - category, useCase, version, weights, thresholds, status;
- `ProductScoreSnapshot`
  - product/variant, useCase, score, confidence, coverage, priceSnapshot, rubricVersion, sourceSetHash, calculatedAt, explanation payload.

Review nội bộ hiện tại vẫn là nguồn riêng. Không copy external review vào bảng Review rồi giả là review của User trong shop.

#### Compatibility

- `CompatibilityRule`
- `CompatibilityAssertion`
- Có source, version, approvedBy, approvedAt và giải thích.

#### Kho và hậu mãi

- `Supplier`
- `PurchaseOrder`, `PurchaseOrderItem`
- `GoodsReceipt`, `GoodsReceiptItem`
- `InventoryBalance` hoặc projection tương đương
- `InventoryMovement`
- `SerializedUnit`
- `WarrantyPolicy`
- `WarrantyClaim`, `WarrantyEvent`
- `ReturnRequest`, `ReturnItem`, `ReturnEvent`
- `AdminAuditLog`

### 6.3. Mapping chính xác sản phẩm

Nguồn ngoài phải mapping đến ít nhất:

- Brand;
- model code;
- market/region;
- variant/configuration nếu nguồn cung cấp;
- thời gian hiệu lực.

`parent_asin` hoặc một parent identifier chỉ là gợi ý nhóm biến thể, không đủ để gán review cho mọi cấu hình. Mapping mơ hồ được đưa vào hàng đợi duyệt và không tham gia điểm production.

### 6.4. Tiền tệ

Trước khi bán thiết bị giá cao, migrate các cột tiền quan trọng khỏi giới hạn Int32. Quyết định builder mặc định:

- Lưu VND nguyên đơn vị bằng `BigInt` trong database/domain;
- DTO JSON serialize thành chuỗi decimal hoặc dùng transformer thống nhất;
- Không dùng JavaScript `number` cho phép tính có thể vượt `Number.MAX_SAFE_INTEGER`;
- Validation có upper bound nghiệp vụ rõ ràng;
- Cập nhật toàn bộ amount của Product/Variant/Order/Coupon/Transaction/BankTransfer/Refund/Wallet/Shipment/Purchase Order.

Migration này phải có audit danh sách trường và test regression; không đổi từng bảng rời rạc.

### 6.5. Snapshot giao dịch

OrderItem phải giữ đủ dữ liệu để lịch sử không thay đổi khi catalog đổi:

- Product name;
- SKU;
- Variant title/options;
- Giá đơn vị;
- Warranty terms áp dụng;
- Thông tin cần cho đóng gói/vận chuyển.

Giá hợp lệ dùng price version/snapshot. Nếu giá hoặc phí ship thay đổi giữa quote và create order, server trả conflict để khách xác nhận lại, tiếp tục nguyên tắc hiện có.

---

## 7. Công thức điểm P/P

### 7.1. Các use case

#### Laptop

- Học tập và văn phòng;
- Lập trình;
- Gaming;
- Đồ họa và sáng tạo.

#### Điện thoại

- Sử dụng hằng ngày;
- Gaming;
- Chụp ảnh và quay video.

#### Phụ kiện

Mỗi leaf category có rubric riêng; không dùng rubric laptop/điện thoại cho phụ kiện.

### 7.2. Pipeline chấm điểm

Với mỗi category + use case:

1. Xác định cohort so sánh hợp lệ;
2. Chuẩn hóa từng metric theo percentile/winsorized min-max trong cohort;
3. Đổi hướng metric nếu thấp hơn là tốt hơn;
4. Tính `CapabilityScore` từ benchmark và thông số có trọng số;
5. Tính `ExperienceScore` từ aspect signals và rating được điều chỉnh độ tin cậy;
6. Tính `PriceEfficiencyScore` từ capability tương đối với giá bán hiện tại;
7. Tạo score cuối cùng nếu đủ coverage;
8. Lưu snapshot với rubric version, giá, source hash và explanation.

Công thức khởi điểm do builder cấu hình, không hard-code trong prompt AI:

```text
FinalScore(useCase) =
  0.65 × PriceEfficiencyScore
+ 0.25 × ExperienceScore
+ 0.10 × SupportScore
```

Đây là **mặc định kỹ thuật ban đầu**, không phải chân lý khách quan. Tất cả trọng số nằm trong rubric có version và được hiệu chỉnh bằng eval/dữ liệu sau này.

`SupportScore` có thể gồm thời hạn bảo hành, chính sách cập nhật/phần mềm hoặc khả năng sửa chữa nếu có nguồn đáng tin; nếu category không phù hợp thì trọng số được phân bổ lại theo rubric version.

### 7.3. Rating có điều chỉnh

Dùng Bayesian weighted rating thay vì trung bình sao thuần:

```text
AdjustedRating = (v/(v+m)) × R + (m/(v+m)) × C
```

- `R`: trung bình rating của sản phẩm;
- `v`: số review hợp lệ;
- `C`: trung bình cohort;
- `m`: ngưỡng prior theo rubric.

Nguồn trong shop và bên ngoài được tính riêng, sau đó kết hợp theo source weight có version. Cờ “verified purchase” của nguồn ngoài không được đổi thành verified tại shop.

### 7.4. Confidence và coverage

Score luôn đi với:

- `coverage`: tỷ lệ metric bắt buộc có dữ liệu;
- `confidence`: kết hợp độ phủ, số lượng review, recency, source quality và mapping certainty;
- `missingEvidence`: danh sách dữ liệu thiếu.

Nếu coverage dưới threshold của rubric:

- Không phát sinh nhãn `GOOD_VALUE`;
- UI/API trả trạng thái `INSUFFICIENT_DATA`;
- AI nói “chưa đủ dữ liệu”, không suy diễn điểm.

### 7.5. Doanh số

- Chỉ tính từ OrderItem của đơn `COMPLETED` trong hệ thống;
- Trừ quantity đã trả/hoàn theo trạng thái cuối;
- Hiển thị cửa sổ thời gian;
- Dùng như tín hiệu độ phổ biến riêng;
- Không đưa trực tiếp vào score P/P để tránh vòng lặp bán nhiều → điểm cao → càng bán nhiều.

---

## 8. Dữ liệu nguồn và pipeline nhập

### 8.1. Phạm vi dữ liệu ban đầu

Xây vertical slice trước:

- 2 laptop;
- 2 điện thoại;
- 6 phụ kiện có liên quan.

Sau khi schema, mapping, scoring và eval ổn, mở rộng mục tiêu 40–60 model:

- 10–15 laptop;
- 10–15 điện thoại;
- 20–30 phụ kiện.

Danh mục kết hợp sản phẩm mới và model đời cũ có dữ liệu đánh giá phù hợp. Sản phẩm mới thiếu review vẫn được bán và so sánh thông số, nhưng không giả lập confidence cao.

### 8.2. Phân loại nguồn

- Thông số/tài liệu hãng;
- Benchmark có methodology;
- Review nội bộ;
- Review/dataset bên ngoài;
- Giá, kho, đơn hàng và doanh số nội bộ.

Giá/kho/doanh số không đưa vào tài liệu RAG tĩnh; lấy trực tiếp từ service tại thời điểm trả lời.

### 8.3. Quy trình duyệt nguồn ngoài

`DISCOVERED → LICENSE_REVIEW → MAPPING_REVIEW → APPROVED → ACTIVE`, có nhánh `REJECTED`/`REVOKED`.

Chỉ `ACTIVE` mới tham gia scoring và retrieval production.

Hồ sơ nguồn bắt buộc:

- Publisher và URL;
- License/terms và ngày kiểm tra;
- Attribution requirements;
- Được phép dùng cho phân tích/RAG hay không;
- Phạm vi thời gian;
- Mapping logic;
- Checksum/version;
- Người duyệt.

### 8.4. Nguồn đã khảo sát

- **Amazon Reviews 2023:** nội dung/phạm vi phù hợp nhưng trang dự án và dataset card được kiểm tra chưa nêu license rõ; chỉ là ứng viên chờ xác minh, không mặc định nhập production.
- **UCI Sentiment Labelled Sentences:** CC BY 4.0, dùng làm fixture/eval sentiment cơ bản; không có product ID nên không dùng để chấm sản phẩm cụ thể.
- **Open Icecat:** có dữ liệu kỹ thuật nhưng policy cấm trích xuất để train AI/ML nếu không có commercial license; không đưa vào AI pipeline mặc định.

Không lấy một bản mirror trên Kaggle/Hugging Face làm bằng chứng rằng license gốc đã hợp lệ.

### 8.5. Dữ liệu mô phỏng

- Seed demo được gắn `isSynthetic` hoặc dataset scope riêng;
- Không tham gia production score nếu không bật chế độ demo;
- API và chatbot phải công bố rõ kết quả dựa trên dữ liệu mô phỏng;
- Không tạo review giả rồi trình bày như người mua thật.

---

## 9. Kiến trúc trợ lý AI

### 9.1. Tách biệt chat

Giữ nguyên chat CSKH người–người. Xây phân hệ riêng:

- `AssistantConversation`;
- `AssistantMessage` với role/user/assistant/tool và metadata;
- Citation/evidence references;
- Model/provider/request usage;
- Handoff link tùy chọn sang ChatRoom CSKH.

Không ép `Message.senderId` hiện tại nhận assistant giả làm User.

### 9.2. Phân lớp

- `src/server/modules/assistant/`: orchestration, policy, grounding, comparison, conversation;
- `src/server/infrastructure/ai/`: provider adapter server-only;
- `src/shared/types/assistant.ts`: DTO không chứa server types;
- `src/app/api/assistant/**`: facade mỏng;
- client hook/view gọi HTTP/streaming, không import provider SDK.

Provider cấu hình qua env. Model mặc định theo quyết định của chủ dự án:

```env
AI_BASE_URL=
AI_API_KEY=
AI_MODEL=ag/gemini-3.8-flash-high
AI_TIMEOUT_MS=
```

Tên biến và giao thức cuối cùng được xác nhận theo tài liệu của nhà cung cấp khi triển khai. Không giả định OpenAI-compatible nếu chưa kiểm chứng. Chủ dự án tự cung cấp giá trị secret; repository chỉ chứa placeholder trong `.env.example`.

### 9.3. Dòng xử lý một câu hỏi

1. Xác thực/sinh anonymous session hợp lệ;
2. Rate limit và quota;
3. Validate input và kích thước;
4. Xác định intent/category/product candidates;
5. Gọi service deterministic để lấy product/variant, score snapshot, sales, review aggregates và compatibility rules;
6. Retrieve tài liệu approved, lọc theo product/market/version;
7. Xây evidence bundle có ID;
8. Gọi provider bằng structured output contract;
9. Validate response, citation IDs và claims;
10. Nếu grounding không đạt, trả fallback deterministic/“chưa đủ dữ liệu”;
11. Lưu conversation metadata đã redaction;
12. Stream câu trả lời cho client nếu provider hỗ trợ.

### 9.4. Contract trả lời

Tối thiểu:

- `answer`;
- `comparisonSummary`;
- `advantages[]`/`tradeoffs[]` theo từng sản phẩm;
- `citations[]` với evidence ID;
- `confidence`;
- `missingEvidence[]`;
- `followUpQuestion`;
- `disclaimer` khi dùng synthetic/external/insufficient data.

Các con số hiển thị lấy từ evidence bundle; không parse ngược từ văn bản tự do để cập nhật database.

### 9.5. An toàn và vận hành

- API key chỉ ở server;
- Prompt/tool results được coi là dữ liệu, không phải operator instruction;
- Strip/escape nội dung nguồn và chống prompt injection trong review/tài liệu;
- Không gửi PII hoặc toàn bộ order history nếu không cần;
- Timeout, retry có giới hạn, circuit breaker và cancellation;
- Per-user/IP/global concurrency + token/cost budget;
- Fail closed đối với quota khi remote limiter không đáng tin, hoặc dùng atomic backend phù hợp;
- Redact log;
- Không log secret hoặc full prompt có dữ liệu cá nhân;
- Có fallback không-AI cho comparison/scoring.

Không dùng nguyên trạng helper rate-limit hiện tại làm cost guard AI trước khi sửa hành vi lỗi Redis/fixed-window và bổ sung atomic quota.

### 9.6. Cache

Cache theo:

- Normalized intent;
- Product/variant IDs;
- Score/source versions;
- Price/inventory version nếu câu trả lời nhắc đến;
- Model và prompt version.

Không cache câu trả lời cá nhân hóa có order/warranty data chung cho người khác.

---

## 10. Tính đúng kho, tiền và vận chuyển trước khi mở rộng

### 10.1. Kho

Trước nhập hàng/bảo hành:

- Tách `hasVariants`/inventory mode khỏi “hiện có active variants hay không”;
- Không cho product có SKU quay lại đường bán base stock khi mọi variant bị inactive;
- Không cho admin ghi đè stock tuyệt đối khi checkout đang reserve;
- Dùng ledger + version/CAS cho adjustment;
- Xác định parent stock là projection, không phải nguồn sự thật thứ hai;
- Release/receive/return phải idempotent bằng operation key.

### 10.2. Ví và thanh toán

Trước khi mở rộng refund/return:

- Bổ sung CAS trên order payment state cho thanh toán ví;
- Chứng minh hai request thanh toán ví đồng thời không trừ hai lần;
- Chứng minh race payment vs expiry có một kết quả duy nhất;
- Refund từ bảo hành/return dùng một operation key duy nhất xuyên transaction.

### 10.3. Giá

- Price revision/snapshot được server kiểm tra;
- Quote cũ bị conflict nếu giá đổi;
- Catalog sort/filter dùng giá hiệu lực thống nhất;
- Không tin giá client hoặc giá trong RAG/chatbot.

### 10.4. Vận chuyển

- Product/variant có weight/dimensions;
- Cùng một packing snapshot được dùng cho quote và create shipment;
- Không hardcode 300g/250g/200g ở các stage khác nhau;
- Rà soát insurance/COD cap của GHN cho thiết bị giá cao;
- Nếu carrier không hỗ trợ giá trị đơn, route đến manual fulfillment review.

---

## 11. RBAC

Quyền đề xuất mở rộng:

- `products`: catalog, thông số và biến thể;
- `inventory`: nhà cung cấp, nhập hàng, điều chỉnh kho và serial;
- `warranties`: bảo hành/đổi trả;
- `reviews`: review nội bộ;
- `knowledge`: nguồn dữ liệu, mapping và compatibility;
- `scoring`: rubric và score publication;
- `assistant`: conversation/handoff monitoring, không đọc secret;
- Các hành động tài chính, cấu hình provider/model, publish rubric và xóa dữ liệu vẫn ADMIN-only ở giai đoạn đầu.

Phải đồng bộ gate page, API guard và Pusher authorization; không chỉ ẩn navigation.

---

## 12. API/Service boundaries đề xuất

Các route cụ thể có thể điều chỉnh khi lập kế hoạch, nhưng boundary phải giữ:

- `/api/catalog/search`
- `/api/products/[id]/comparison-data`
- `/api/compare`
- `/api/scores/[productId]`
- `/api/compatibility/check`
- `/api/assistant/conversations`
- `/api/assistant/conversations/[id]/messages`
- `/api/warranties/**`
- `/api/returns/**`
- `/api/admin/suppliers/**`
- `/api/admin/purchase-orders/**`
- `/api/admin/inventory/**`
- `/api/admin/data-sources/**`
- `/api/admin/scoring-rubrics/**`
- `/api/admin/audit-logs`

Comparison, score và assistant đều gọi cùng domain services; không tạo ba bản logic khác nhau.

---

## 13. Kiểm thử và tiêu chí nghiệm thu

### 13.1. Catalog và dữ liệu

- Attribute type/unit validation;
- Category-specific required fields;
- Mapping đúng product/variant/market;
- Filter/sort theo giá biến thể;
- Inactive SKU không trở thành base product bán được;
- Nguồn revoked không còn tham gia score/retrieval;
- Dữ liệu “không hỗ trợ” khác “chưa biết”.

### 13.2. Scoring

- Kết quả deterministic với cùng input/version;
- Score khác nhau theo use case;
- Không phát score khi thiếu coverage;
- Bayesian rating xử lý 2 review 5 sao khác 200 review 4,7 sao;
- Doanh số không ảnh hưởng trực tiếp P/P;
- Recompute tạo snapshot version mới, không sửa lịch sử;
- External/shop/synthetic source không bị trộn nhãn.

### 13.3. AI

Tạo ít nhất 100 case, chia train/dev/test hợp lý và giữ test set không dùng để chỉnh prompt:

- So sánh cùng category;
- Phân biệt variant gần giống;
- Tư vấn theo ngân sách/nhu cầu;
- Compatibility;
- Thiếu nguồn/mâu thuẫn nguồn;
- Prompt injection trong review/tài liệu;
- Giá/tồn kho mới thay đổi;
- Citation correctness;
- Provider timeout/error/quota;
- Câu hỏi ngoài phạm vi;
- Dữ liệu synthetic được công bố.

Metric tối thiểu:

- Retrieval/source accuracy;
- Numeric exactness;
- Citation precision;
- Grounded claim rate;
- Correct abstention;
- Follow-up relevance;
- Latency và cost per completed answer.

Không gọi model thật trong unit suite mặc định. Provider có fake adapter; eval online là command riêng, có ngân sách và khóa chạy chủ động.

### 13.4. Kho/tiền/hậu mãi

- Reserve vs admin adjustment race;
- Hai receipt replay;
- Serial unique và không bán hai lần;
- Return received không tự restock;
- Warranty state transitions;
- Refund replay;
- Wallet double-pay/race expiry;
- BigInt amounts và serialization;
- Quote/create shipment dùng cùng weight snapshot.

### 13.5. RBAC và riêng tư

- Page + API + realtime guard cùng kết quả;
- STAFF chỉ thao tác đúng permission;
- Customer chỉ xem claim/conversation/order của họ;
- Assistant không leak dữ liệu người khác;
- Audit log có actor/reason nhưng không chứa secret.

### 13.6. Quality gate mỗi milestone

- Unit tests liên quan;
- `npm run test`;
- `npm run test:integration` khi milestone đụng transaction/database;
- `npm run lint`;
- `npm run arch:check`;
- `npm run build`;
- Prisma validate/migration rehearsal với backup/restore test khi có schema change.

Không tuyên bố pass nếu chưa chạy và đọc output thật.

---

## 14. Lộ trình milestone

### M0 — Baseline và safety fixes

- Đóng băng baseline bằng test/lint/arch/build;
- Chốt migration strategy BigInt;
- Sửa wallet order CAS;
- Sửa invariants variant/base inventory và admin stock race;
- Đồng nhất shipping weight/insurance policy;
- Sửa catalog rating chỉ dùng approved review;
- Đồng bộ STAFF gate ở page/API liên quan.

**Exit:** các bất biến tiền/kho hiện hữu có integration test bảo vệ.

### M1 — Catalog điện tử vertical slice

- Brand/category/attributes/options/images/sources;
- 2 laptop + 2 điện thoại + 6 phụ kiện;
- Migration dữ liệu cũ;
- Catalog filters/search/detail DTO mới;
- Admin quản lý dữ liệu cấu trúc và provenance.

**Exit:** tất cả 10 model tìm/lọc/so sánh thông số đúng, không phá checkout cũ.

### M2 — Comparison và scoring v1

- Comparison service;
- Benchmark/review source models;
- Rubric/version/snapshot;
- P/P theo use case + confidence/coverage;
- Import UCI fixture cho eval sentiment, không dùng chấm product;
- Pipeline external source ở trạng thái license-gated.

**Exit:** score reproducible, thiếu dữ liệu abstain đúng, API trả explanation đầy đủ.

### M3 — Assistant v1

- Provider-neutral adapter theo giao thức thực của nhà cung cấp;
- Conversation schema riêng;
- Evidence bundle + structured response + citation validator;
- Overall-first/follow-up-second interaction;
- Rate/cost/concurrency controls và deterministic fallback;
- Eval suite 100 case.

**Exit:** không có unsupported numeric claims trên test set, injection/timeout/quota có fallback đúng.

### M4 — Compatibility và mua kèm

- Compatibility rule engine;
- Admin duyệt rule/source;
- Check API và assistant explanation;
- Cart revalidation.

**Exit:** rule đủ dữ kiện mới khẳng định compatible; thiếu dữ kiện trả unknown/caveat.

### M5 — Kho nhập hàng và audit

- Supplier/PO/receipt;
- Inventory ledger + balance projection;
- Serialized units;
- Chuyển admin khỏi absolute stock overwrite;
- Audit log cho thao tác nhạy cảm.

**Exit:** replay/concurrency tests không làm lệch balance hoặc trùng serial.

### M6 — Bảo hành và đổi/trả

- Warranty/return state machines;
- Customer ownership/eligibility;
- Staff workflow;
- Inspection disposition;
- Idempotent refund/restock integration;
- Notifications/audit.

**Exit:** demo xuyên suốt một claim và một return, không double refund/restock.

### M7 — Hardening, dữ liệu mở rộng và tài liệu bảo vệ

- Mở rộng 40–60 model;
- Xác minh license nguồn thực tế;
- Chạy eval và quality gates;
- Cập nhật UML, báo cáo, seed demo và kịch bản vấn đáp;
- Ghi rõ đâu là dữ liệu thật, external và synthetic.

**Exit:** một người mới có thể cài, seed, chạy demo và truy vết mọi kết luận AI về nguồn.

---

## 15. Kịch bản demo mục tiêu

1. Khách lọc laptop theo ngân sách và nhu cầu;
2. Chọn hai model để so sánh;
3. Thấy thông số, P/P theo học tập/lập trình/gaming, doanh số cửa sổ thời gian và chủ đề review theo nguồn;
4. Trợ lý đưa so sánh tổng quan, nêu dữ liệu thiếu, rồi hỏi nhu cầu;
5. Khách trả lời và nhận khuyến nghị có citation;
6. Hệ thống kiểm tra phụ kiện tương thích bằng rule;
7. Khách mua, thanh toán VietQR/ví và theo dõi GHN;
8. Trên một đơn completed trong seed demo, khách mở yêu cầu bảo hành;
9. Nhân viên tiếp nhận, kiểm tra serial, cập nhật trạng thái;
10. Admin xem audit log, nguồn dữ liệu và scoring version đã dùng.

---

## 16. Các quyết định giao cho builder

Builder được quyền chọn:

- Tên class/file cụ thể miễn đúng layer và alias;
- Thư viện schema validation nếu không phá stack;
- Cách triển khai typed attribute values (nhiều cột typed hoặc bảng con) sau khi benchmark query;
- SSE hay protocol streaming tương thích provider/Next.js, sau khi đọc docs cục bộ;
- Job runner cụ thể cho ingest/recompute, miễn có idempotency, retry và trạng thái;
- Công thức confidence chi tiết và ngưỡng khởi điểm, nhưng phải version hóa và đưa vào eval;
- Provider transport adapter sau khi chủ dự án cung cấp tài liệu endpoint thực tế.

Builder không được tự ý:

- Trộn chat AI với chat người–người;
- Bỏ provenance/license gate;
- Đưa doanh số vào P/P;
- Cho model trực tiếp cập nhật domain state;
- Dùng dữ liệu synthetic như dữ liệu thật;
- Bỏ safety milestone để làm chatbot trước.

---

## 17. Các quyết định đã được phê duyệt

### 17.1. Phạm vi và thứ tự

- UI redesign bị loại khỏi scope của spec/plan này; implementation chỉ bổ sung UI tối thiểu để sử dụng feature, không xây lại design system hoặc giao diện tổng thể.
- Phạm vi hoàn chỉnh gồm M0–M7 và được triển khai tuần tự, không gom tất cả vào một commit.
- Dữ liệu bên ngoài chỉ được sử dụng sau license review. Nếu chưa tìm được nguồn hợp lệ, hệ thống vẫn hoàn thành bằng review nội bộ, dữ liệu được phép và trạng thái `INSUFFICIENT_DATA`.

### 17.2. Đổi/trả và hoàn tiền

- Hỗ trợ trả từng OrderItem và một phần số lượng.
- Số tiền hoàn dựa trên giá thực trả sau khi phân bổ giảm giá order-level theo tỷ lệ và quy tắc làm tròn có tổng bằng đúng discount đã áp dụng.
- Phí vận chuyển không hoàn, trừ trường hợp lỗi thuộc cửa hàng; quyết định hoàn phí phải có reason và audit log.
- Tổng hoàn lũy kế không được vượt số tiền khách thực trả cho phần hàng đủ điều kiện cộng phần phí vận chuyển được duyệt.
- Đổi sang sản phẩm khác được mô hình hóa thành trả hàng cũ + tạo đơn mới; không tính chênh lệch trực tiếp bên trong một return request.

### 17.3. Chính sách bảo hành

- Eligibility bắt đầu từ lúc đơn đạt `COMPLETED`; điều khoản áp dụng được snapshot trên OrderItem.
- Laptop và điện thoại mặc định 12 tháng khi SKU chưa có chính sách cụ thể; phụ kiện theo từng SKU.
- Mặc định loại trừ rơi vỡ, chất lỏng và sử dụng sai hướng dẫn, trừ khi policy cụ thể cho phép.
- Workflow hỗ trợ xử lý tại shop hoặc chuyển hãng/trung tâm bảo hành.
- Thiết bị thay thế hưởng thời hạn còn lại của sản phẩm gốc; ngoại lệ phải có căn cứ, người duyệt và audit log.

### 17.4. Migration và dữ liệu lịch sử

- Giữ nguyên User, wallet balance/transactions, đơn hàng và lịch sử tài chính.
- Chấp nhận maintenance window có backup, rehearsal, rollback checklist và đối soát số liệu trước/sau.
- Sản phẩm cũ được đánh dấu legacy cho đến khi chuẩn hóa.
- Không backfill giả serial/IMEI, trọng lượng, dimensions hoặc điều khoản bảo hành lịch sử; giá trị chưa biết được biểu diễn tường minh là `UNKNOWN`/null kèm provenance.

### 17.5. Serial và IMEI

- Laptop/điện thoại bắt buộc gán serialized unit trước khi shipment được tạo hoặc chuyển SHIPPING.
- Phụ kiện mặc định không bắt buộc; từng SKU có thể bật `serializationRequired`.
- Một unit có thể có nhiều định danh typed như `SERIAL`, `IMEI_1`, `IMEI_2`; giá trị phải unique theo loại/quy tắc domain.
- Hàng legacy thiếu định danh được phép tồn tại và xử lý theo luồng ngoại lệ có audit, không sinh mã giả.

### 17.6. Vận chuyển giá trị cao

- Đơn vượt giới hạn bảo hiểm/COD/carrier không được tự động tiếp tục.
- Manual fulfillment review có hai outcome: cancel/refund hoặc ghi nhận vận chuyển ngoài.
- Vận chuyển ngoài phải có carrier, tracking/reference, ghi chú, người duyệt và bằng chứng khách đã xác nhận rủi ro/điều kiện.
- Không có thao tác bypass cảnh báo mà không audit.

### 17.7. Provider AI

- Model mặc định là `ag/gemini-3.8-flash-high`.
- Xây provider-neutral interface trước.
- Transport adapter cụ thể bị đánh dấu blocked cho đến khi chủ dự án cung cấp tài liệu endpoint hoặc request mẫu; không mặc định OpenAI-compatible hoặc Google Gemini native.

### 17.8. Riêng tư và retention

- Assistant v1 không nhận ảnh bảo hành, order history đầy đủ hoặc PII không cần thiết.
- Chỉ câu hỏi đã lọc, catalog/evidence đã duyệt và IDs phi nhạy cảm cần thiết được gửi tới provider.
- Hội thoại assistant được giữ 30 ngày rồi xóa hoặc anonymize; khách có quyền xóa sớm, trừ metadata tối thiểu bắt buộc cho chống lạm dụng/an toàn theo chính sách hệ thống.
- STAFF có permission assistant chỉ xem metadata mặc định. Nội dung chỉ được chia sẻ khi khách chủ động handoff sang người thật hoặc ADMIN thực hiện điều tra có audit.
- Ảnh bảo hành không đi qua AI pipeline và có retention theo vòng đời hồ sơ hậu mãi.
