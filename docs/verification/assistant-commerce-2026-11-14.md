# Kiểm chứng trợ lý tìm kiếm và so sánh

Hoàn tất kiểm tra ngày 2026-11-15 (Asia/Ho_Chi_Minh). Không commit hoặc triển khai production trong tác vụ này.

## Hành vi đã xác nhận

- Tìm sản phẩm đang bán bằng tiếng Việt có/không dấu, tên hãng/model, loại sản phẩm, khoảng giá, RAM/SSD và còn hàng. Giá/tồn kho/thông số lọc trên cùng biến thể; tối đa 5 thẻ.
- Thẻ có giá, trạng thái, thông số và liên kết trang chi tiết; nút chọn so sánh riêng. Giới hạn hai sản phẩm cùng danh mục.
- So sánh theo hai thẻ, hai tên rõ ràng hoặc “hai sản phẩm đầu tiên”; tên trùng, tên mơ hồ và sản phẩm ngừng bán được xử lý. Thông số khác nhau giữa cấu hình chưa chọn không tạo kết luận dung lượng sai.
- Lịch sử hội thoại khôi phục tham chiếu và cập nhật lại giá/tồn kho. Cookie anonymous riêng, quyền sở hữu hội thoại và quota giữ nguyên ranh giới.
- Nạp thành công danh mục 50 sản phẩm demo, 55 biến thể; giữ nguyên đơn hàng và số dư cũ. Có nhãn demo và ảnh minh họa local.

## Kết quả tự động

| Kiểm tra | Kết quả |
|---|---|
| `npm test` | 1.123 pass, 0 fail, 0 skip |
| `npm run test:integration` | 77 pass, 0 fail, 0 skip |
| `tsc --noEmit --incremental false` | Pass |
| ESLint phạm vi tệp thay đổi | 0 error; warning về any trong mock/test và mã hiện có |
| `npm run arch:check` | Pass — 416 modules, 1.251 dependencies |
| `npm run schema:budget -- --expected=35 --lock-registry` | Pass — không thêm model |
| `next build --webpack` | Pass — build production, TypeScript và 66 trang tĩnh |
| `git diff --check` | Pass |

Integration test chạy trong schema `assistant_verify_20261114`, tách khỏi schema shop. Importer còn được kiểm thử riêng trong schema đó: 50 sản phẩm/55 bút toán, rerun không nhân tồn, giữ giá đã sửa, từ chối phiên bản checksum khác và giữ nguyên số đơn hàng.

Full lint của repository có sẵn 67 error / 2.502 warning. Toàn bộ 67 error thuộc các tệp không đổi trong `designs/shop-qr-dashboard/src/`: `animate-components.js` (50), `motion-runtime.js` (3), `radix-runtime.js` (14). Không sửa các runtime thiết kế ngoài phạm vi.

Turbopack build gặp lỗi giới hạn môi trường khi tạo process/bind port. Production build bằng Webpack hoàn tất; không thay đổi cấu hình bundler mặc định của dự án. Host execution cũng khắc phục lỗi EPERM subprocess của test runner và cho phép truy cập PostgreSQL local.

## Kiểm tra trình duyệt

Chạy ứng dụng thật tại `http://localhost:3007` với database demo. Xác nhận tìm laptop dưới 40 triệu trả 4 thẻ; tìm tai nghe Sony trả 4 thẻ; liên kết mở đúng trang ASUS; chọn hai thẻ Sony hiển thị 2/2 rồi tạo bảng so sánh; mở lại hội thoại giữ lịch sử và giá cập nhật.

Tại viewport 390×844, trang không tràn ngang. Vùng bảng rộng 315px và nội dung 440px cuộn ngang nội bộ. Đã reset viewport sau kiểm tra. Ảnh kiểm chứng nằm trong `docs/verification/assets/assistant-commerce-*.jpg`.

## Review

Reviewer độc lập phát hiện ba lỗi: alias phụ kiện tiếng Việt/Anh, hai tên trùng và thông số cơ sở không đại diện mọi cấu hình. Đã thêm test tái hiện thất bại, sửa và chạy xanh. Re-review xác nhận cả ba đã giải quyết, không còn finding chặn trong phạm vi review.

## Giới hạn

Đây là tìm kiếm xác định với alias và bộ lọc, không phải tìm kiếm ngữ nghĩa tổng quát. Mỗi truy vấn kiểm tra tối đa 500 sản phẩm và có thông báo nếu vượt giới hạn. Danh mục hiện tại có 50 sản phẩm. Giá/thông số/bảo hành/ảnh demo chưa được xác minh để bán hàng thực tế; không tạo benchmark hoặc kết luận hiệu năng thiếu bằng chứng.
