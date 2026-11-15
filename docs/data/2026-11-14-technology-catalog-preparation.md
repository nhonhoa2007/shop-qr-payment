# Danh mục công nghệ demo — đã áp dụng

Người dùng xác nhận dùng sản phẩm demo để chạy và trình diễn. Đã áp dụng vào database local được cấu hình của dự án; không reset hoặc chạy lại seed tổng hợp.

| Kết quả | Số lượng |
|---|---:|
| Laptop | 12 |
| Điện thoại | 12 |
| Phụ kiện | 26 |
| Tổng sản phẩm demo đang hiển thị | 50 |
| Biến thể đang hoạt động | 55 |
| Bút toán khởi tạo tồn kho demo | 55 |
| Đơn vị tồn kho demo ban đầu | 1.395 |
| Mặt hàng legacy được ẩn | 36 |
| Bản ghi sản phẩm cũ được giữ lại | 39 |

## Dữ liệu và nguồn

Đầu vào: `prisma/data/electronics-catalog.json`. Importer mới `scripts/import-demo-technology-catalog.ts` kiểm tra quan hệ, giá/tồn kho, ID/SKU và cấu hình trước khi ghi. Toàn bộ thay đổi nằm trong transaction Serializable. Sản phẩm dùng chế độ kho VARIANT, tồn ban đầu bằng 0 rồi được nhập qua inventory ledger.

Giá, tồn kho, cấu hình, bảo hành và ảnh chỉ phục vụ trình diễn. Không khẳng định đã xác minh với nhà sản xuất. Mỗi sản phẩm có nhãn `SYNTHETIC_DEMO`, mô tả cảnh báo demo và nguồn CATALOG synthetic riêng với checksum từ nội dung demo. Không dùng các URL/checksum placeholder trong manifest làm bằng chứng thực tế. Bộ 27 ảnh chụp từ DummyJSON và trang sản phẩm hãng/nhà bán lẻ được lưu trong `public/demo/products/` cho 50 sản phẩm. Mapping `prisma/data/demo-product-images.json` ghi URL gốc, nguồn, tên sản phẩm trong ảnh và những ảnh chỉ minh họa model cùng dòng. Ảnh không phải bằng chứng xác thực cho thông số/giá bán trên shop.

## Bảo toàn và kiểm chứng

- Đối chiếu snapshot trước/sau: tất cả 39 ID sản phẩm cũ còn tồn tại; stock, onHandStock, reservedStock, quarantinedStock và stockVersion giữ nguyên. Số đơn hàng và dòng đơn hàng giữ nguyên.
- Chỉ ẩn hàng LEGACY sau khi 50 sản phẩm thay thế và biến thể đã sẵn sàng. Không xóa sản phẩm hoặc quan hệ đơn hàng.
- 55 biến thể khớp 55 bút toán RECEIVE; tổng tồn sản phẩm cha khớp tổng biến thể.
- Chạy importer lần hai: thêm 0 sản phẩm, ẩn thêm 0, không cộng thêm tồn kho. Kiểm thử trong schema riêng cũng xác nhận giữ nguyên giá đã sửa và từ chối checksum xung đột.
- Snapshot trạng thái hiển thị/số dư trước khi nhập nằm trong thư mục local `backups/` được git-ignore, tệp gốc `demo-catalog-before-1794674899647.json`. Snapshot không phải bản sao lưu đầy đủ database.

## Chạy lại

```bash
# Xem trước; không ghi database
node --experimental-strip-types --import ./tests/register-alias.mjs --env-file=.env scripts/import-demo-technology-catalog.ts

# Áp dụng theo yêu cầu dùng demo đã xác nhận
node --experimental-strip-types --import ./tests/register-alias.mjs --env-file=.env scripts/import-demo-technology-catalog.ts --apply

# Chỉ cập nhật ảnh demo; không tạo sản phẩm, ẩn hàng hay thay đổi giá/tồn
node --experimental-strip-types --import ./tests/register-alias.mjs --env-file=.env scripts/import-demo-technology-catalog.ts --images-only --apply
```

Lần chạy lại giữ nguyên giá, visibility và số dư của sản phẩm demo có sẵn. Chỉ ảnh thiếu hoặc thuộc bộ ảnh demo được quản lý mới được cập nhật; ảnh chính/gallery nhập thủ công được giữ nguyên. Ảnh thay đổi làm tăng catalogVersion. Importer từ chối ghi đè ID trùng với sản phẩm không thuộc cùng phiên bản demo. Bản sao ảnh và trạng thái trước cập nhật ngày 15/11/2026: `backups/demo-catalog-before-1794727414832.json`; đã cập nhật 50 sản phẩm và lần xem trước tiếp theo có 0 ảnh cần thay.

Nếu cần trở lại danh mục cũ, khôi phục riêng `isActive` theo snapshot và ẩn các ID demo; không xóa sản phẩm hay đảo sổ kho sau khi phát sinh giao dịch. Mọi khôi phục phải được đối chiếu với thay đổi vận hành sau snapshot.
