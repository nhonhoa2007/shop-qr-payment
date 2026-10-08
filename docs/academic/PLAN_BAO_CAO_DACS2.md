# KẾ HOẠCH TRIỂN KHAI BÁO CÁO ĐỒ ÁN CƠ SỞ 2 (DACS2)
## DỰ ÁN: WEBSITE THƯƠNG MẠI ĐIỆN TỬ TÍCH HỢP THANH TOÁN VIETQR & QUẢN TRỊ SAAS BENTO GRID (SHOP QR PAYMENT)

- **Cơ quan chủ quản đào tạo:** Trường Đại học Công nghệ Thông tin & Truyền thông Việt - Hàn (VKU) — Đại học Đà Nẵng
- **Khoa:** Khoa Khoa học Máy tính
- **Học phần:** Đồ án cơ sở 2 (DACS2)
- **Kiến trúc trưởng & Tech Lead:** Orchestrator (Hermes Researcher)
- **Chuyên viên xuất bản & định dạng:** `@document-specialist` (Hermes Document Specialist)
- **Tài liệu tham chiếu chuẩn mẫu:** `BÁO CÁO DACS2.docx.pdf` (127 trang, Google Docs / Skia PDF)

---

## 1. MỤC TIÊU VÀ NGUYÊN TẮC THIẾT KẾ BÁO CÁO

### 1.1. Mục tiêu
1. Chuyển hóa toàn bộ mã nguồn, tài liệu thiết kế hệ thống (`SYSTEM_DESIGN.md`), 21 sơ đồ UML (`docs/uml/README.md`), và tài liệu chức năng (`docs/HE-THONG-CHUC-NANG.md`) của dự án **shop-qr-payment** thành một bản Báo cáo Đồ án cơ sở 2 hoàn chỉnh, chuẩn mực theo đúng quy cách của trường Đại học Công nghệ Thông tin & Truyền thông Việt - Hàn (VKU).
2. Tái cấu trúc chuẩn xác 100% theo mẫu báo cáo gốc đính kèm (`BÁO CÁO DACS2.docx.pdf`), bao gồm đầy đủ 5 chương, các trang bìa học thuật, biên bản họp nhóm, đặc tả use case bảng 2 cột, các sơ đồ UML (Use Case, Class, Activity, Sequence, Communication), từ điển dữ liệu cơ sở dữ liệu quan hệ, kiến trúc ứng dụng và kết luận.
3. Bảo toàn nguyên tắc bảo mật thông tin cá nhân: Chuyển toàn bộ tên sinh viên, mã số sinh viên (MSSV), lớp sinh hoạt, tên giảng viên hướng dẫn và lời cảm ơn thành các khung định danh `[...]` để sinh viên tự điền theo thực tế mà không để lộ dữ liệu cá nhân.

### 1.2. Tiêu chuẩn Typography & Trình bày Văn bản Học thuật (Invariants)
Tuân thủ nghiêm ngặt quy định trình bày đồ án tốt nghiệp / đồ án cơ sở của VKU:
- **Khổ giấy:** A4 (210 x 297 mm), in 1 mặt.
- **Căn lề trang (Margins):**
  - Lề trên (Top): `2.0 cm`
  - Lề dưới (Bottom): `2.0 cm`
  - Lề trái (Left - gáy đóng sách): `3.0 cm`
  - Lề phải (Right): `2.0 cm`
- **Font chữ chính:** `Times New Roman`, Size `13 pt`, Màu chữ `#000000` (đen tiêu chuẩn).
- **Giãn dòng (Line spacing):** `1.3` đến `1.5 lines`.
- **Khoảng cách đoạn (Paragraph spacing):** `Space Before: 0 pt`, `Space After: 6 pt`. Thụt đầu dòng đoạn văn: `1.0 cm` (First line indent).
- **Hệ thống đề mục (Heading Hierarchy):**
  - **Tên Chương (Heading 1):** Size `16 pt`, In hoa (All Caps), In đậm (Bold), Màu `#1E3A8A` (Deep Navy), căn giữa hoặc căn trái, Space before `18 pt`, Space after `10 pt`, ngắt trang đầu mỗi chương (Page Break).
  - **Mục lớn (Heading 2, e.g. 1.1, 2.1):** Size `14 pt`, In đậm (Bold), Màu `#1E3A8A`, Space before `12 pt`, Space after `6 pt`.
  - **Mục con (Heading 3, e.g. 1.1.1, 2.1.4):** Size `13 pt`, In đậm (Bold), Màu `#0F172A`, Space before `8 pt`, Space after `4 pt`.
  - **Mục cấp 4 (Heading 4, e.g. 2.1.4.1):** Size `13 pt`, In đậm nghiêng (Bold Italic), Màu `#334155`, Space before `6 pt`, Space after `2 pt`.
- **Định dạng bảng biểu (Tables):**
  - Header: Nền màu Navy đậm `#1E3A8A`, chữ màu trắng `#FFFFFF`, in đậm, căn giữa.
  - Viền bảng: Màu xám bạc `#CBD5E1`, độ dày `0.5 pt`.
  - Các dòng xen kẽ (Zebra striping): Dòng chẵn nền trắng, dòng lẻ nền xám nhẹ `#F8FAFC`.
  - Canh lề: STT / Mã căn giữa, Tiêu đề / Mô tả căn trái, Số lượng / Giá căn phải.
- **Tiêu đề hình và bảng:**
  - Hình: Ghi phía dưới hình: `Hình X.Y: Tên hình minh họa` (Size 11pt, Nghiêng, Căn giữa).
  - Bảng: Ghi phía trên bảng: `Bảng X.Y: Tên bảng dữ liệu` (Size 11pt, Đậm, Căn trái hoặc giữa).
- **Header & Footer:**
  - Header (Đầu trang): Căn phải, `8.5 pt`, In nghiêng, màu xám: `Báo cáo Đồ án cơ sở 2 — Hệ thống Shop QR Payment`.
  - Footer (Chân trang): Căn giữa, `10 pt`, số trang `1, 2, 3...` bắt đầu từ Chương I.

---

## 2. MA TRẬN PHÂN RÃ CẤU TRÚC 5 CHƯƠNG SO VỚI MẪU GỐC

| STT | Phần / Chương | Nội dung theo mẫu gốc (DACS2 Petshop) | Nội dung ánh xạ Dự án Shop QR Payment |
| :---: | :--- | :--- | :--- |
| **0** | **Phần đầu** | Trang bìa chính & phụ, Lời cảm ơn, Nhận xét GVHD, Mục lục | Giữ nguyên form mẫu VKU, chuẩn hóa thông tin cá nhân dạng `[...]` |
| **1** | **Chương I** | **TỔNG QUAN ĐỀ TÀI**<br>1.1. Giới thiệu (Mục đích, quy ước, đối tượng, phạm vi)<br>1.2. Mô tả tổng quan (Quan điểm, lớp người dùng, môi trường, hạn chế, hướng dẫn, giả định)<br>1.3. Observation (Biên bản họp nhóm) | Giới thiệu bài toán thương mại điện tử không chạm, thanh toán VietQR tự động Napas 247, giải quyết bài toán nghẽn đơn và gian lận chuyển khoản; Đối tượng khách hàng & quản trị SaaS Bento; Môi trường Web Next.js 16/PostgreSQL/Redis; Biên bản họp định kỳ. |
| **2** | **Chương II** | **MÔ HÌNH VÀ CHỨC NĂNG**<br>2.1. Yêu cầu chức năng & Đặc tả 22 Use Cases (Bảng 2 cột)<br>2.2. Biểu đồ Use Case (Tổng quát + 3 Actor)<br>2.3. Class Diagram<br>2.4. Activity Diagram (22 sơ đồ)<br>2.5. Sequence Diagram (22 sơ đồ)<br>2.6. Communication Diagram (22 sơ đồ)<br>2.7. Mô hình CSDL quan hệ (11 bảng) | Đặc tả 22 Use Cases hoàn chỉnh của hệ thống Shop QR Payment (Đăng ký OTP, Đăng nhập JWT, Đặt hàng VietQR, Nạp ví nội bộ, Thanh toán ví 1-chạm, Hủy đơn hoàn tiền CAS, Chat realtime Pusher, Đánh giá xác thực, Định vị GPS GHN, Quản lý đơn FSM, Quản lý biến thể Matrix, Đối soát thủ công, Phân quyền RBAC STAFF, v.v.); Bộ biểu đồ UML; Cơ sở dữ liệu 18 bảng chuẩn hóa 1:1 từ `prisma/schema.prisma`. |
| **3** | **Chương III** | **XÂY DỰNG ỨNG DỤNG**<br>3.1. Giao diện khách hàng (11 màn hình)<br>3.2. Giao diện Admin (5 màn hình)<br>3.3. Giao diện Nhân viên (3 màn hình) | Kiến trúc Clean Architecture 3 lớp + Realtime Pusher; Chi tiết các module giao diện Storefront Khách hàng; Giao diện Quản trị SaaS Bento Grid 21 chỉ số analytics; Giao diện Nhân viên vận hành với Ma trận phân quyền. |
| **4** | **Chương IV** | **KẾT LUẬN**<br>4.1. Ưu điểm<br>4.2. Hạn chế<br>4.3. Hướng phát triển<br>4.4. Kết luận | Phân tích ưu điểm công nghệ vượt trội: Giao dịch tức thì không chạm, Chống race condition kho nguyên tử, Hoàn tiền tự động, 452 ca kiểm thử tự động pass 100%; Hạn chế khách quan; Hướng phát triển AI cá nhân hóa và Mobile App. |
| **5** | **Chương V** | **TÀI LIỆU THAM KHẢO** | Danh mục tài liệu tham khảo chuẩn IEEE / APA (Next.js docs, Prisma, RFCs, VietQR standard, Pusher, PostgreSQL). |

---

## 3. PHÂN CÔNG TRÁCH NHIỆM & QUY TRÌNH PHỐI HỢP (ORCHESTRATION WORKFLOW)

### Vai trò 1: Tech Lead & System Architect (Orchestrator - Active Session)
1. Khảo sát mẫu báo cáo gốc `BÁO CÁO DACS2.docx.pdf` và trích xuất cấu trúc chi tiết.
2. Xây dựng tài liệu kế hoạch triển khai (`PLAN_BAO_CAO_DACS2.md`).
3. Soạn thảo toàn diện bản thảo học thuật nội dung dự án (`BAN_THAO_BAO_CAO_DACS2.md`) với đầy đủ các chương, 22 bảng đặc tả Use Case chi tiết (thuộc tính + kịch bản 2 cột Action of Actor / Action of System), từ điển CSDL 18 bảng, kiến trúc kỹ thuật và kết luận.
4. Tạo nhiệm vụ điều phối trên hệ thống Kanban và kích hoạt subagent chuyên trách `@document-specialist`.
5. Kiểm định nghiệm thu văn bản đầu ra (`.docx`, `.pdf`) đảm bảo tính trung thực kỹ thuật và tiêu chuẩn trình bày.

### Vai trò 2: Document & Publishing Specialist (`@document-specialist`)
1. Tiếp nhận tài liệu Kế hoạch (`PLAN_BAO_CAO_DACS2.md`) và Bản thảo (`BAN_THAO_BAO_CAO_DACS2.md`).
2. Viết mã nguồn Python tự động hóa định dạng OpenXML (`generate_report_dacs2.py`) sử dụng thư viện `python-docx` qua công cụ `uv`.
3. Áp dụng bảng màu học thuật Deep Navy `#1E3A8A`, viền bảng mảnh `#CBD5E1`, lề trang chuẩn 2-2-3-2 cm, font Times New Roman 13pt.
4. Xuất file tài liệu hoàn chỉnh `BAO_CAO_DACS2_SHOP_QR_PAYMENT.docx`.
5. Thực hiện biên dịch không đầu (headless) sang PDF thông qua LibreOffice:
   ```bash
   libreoffice --headless --convert-to pdf BAO_CAO_DACS2_SHOP_QR_PAYMENT.docx --outdir docs/academic/
   ```
6. Bàn giao file kết quả kèm đường dẫn `MEDIA:` trực tiếp trên giao diện chat cho người dùng tải về.

---

## 4. TIÊU CHÍ NGHIỆM THU (QUALITY GATES)

- [ ] **Gate 1 - Cấu trúc:** Có đầy đủ Trang bìa ngoài, bìa trong, Lời cảm ơn, Nhận xét GVHD, Mục lục và đủ 5 chương.
- [ ] **Gate 2 - Trung thực kỹ thuật:** 100% thuộc tính bảng CSDL khớp với `prisma/schema.prisma`; số liệu kiểm thử khớp với thực tế chạy `npm test` (452 tests passed / 108 suites / 0 errors).
- [ ] **Gate 3 - Đặc tả Use Case:** Toàn bộ 22 Use Cases có bảng đặc tả 2 cột Action of Actor / Action of System theo đúng mẫu.
- [ ] **Gate 4 - Bảo mật thông tin:** Không chứa tên thật, MSSV hay thông tin cá nhân của người dùng; sử dụng placeholder `[...]`.
- [ ] **Gate 5 - Định dạng:** Xuất thành công cả 2 định dạng `.docx` và `.pdf` có thể mở được, không lỗi font, bảng biểu không tràn lề.
