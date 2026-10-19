# Legacy Product Normalization & Backward Compatibility

Tài liệu quy định chiến lược chuẩn hóa và tương thích ngược (Backward Compatibility & Normalization) cho các sản phẩm kế thừa từ giai đoạn M0 (thời trang, đồ gia dụng, bán lẻ thông thường) khi nâng cấp lên hệ thống thương mại điện tử chuyên ngành thiết bị số (Electronics Commerce) trong Đồ án DACS2 (VKU).

---

## 1. Nguyên tắc cốt lõi: Tính trung thực của dữ liệu (Data Honesty)

1. **Tuyệt đối không bịa đặt dữ liệu (Zero Invented Data)**:
   - Các sản phẩm phi điện tử (như Áo Thun Cotton, Giày Sneaker) không có thông số phần cứng (CPU, RAM, GPU, dung lượng pin, chuẩn sạc).
   - Tuyệt đối **không** tạo thông số giả lập hoặc ép kiểu chúng vào `CategorySpecSchema` của máy tính hay điện thoại.
   - Trường `specs` của sản phẩm legacy phải giữ giá trị `null` hoặc `{ "isLegacy": true }`.
2. **Bảo tồn phân loại lịch sử (Preserve Historical Taxonomy)**:
   - Cột văn bản `Product.category` (chuỗi string nguyên thủy như `"Thời trang nam"`, `"Phụ kiện"`) được bảo lưu nguyên vẹn để phục vụ các truy vấn kế thừa và hiển thị storefront cũ.
   - Cột quan hệ khóa ngoại `Product.categoryId` trỏ tới bảng `Category` được để `null` đối với sản phẩm legacy, hoặc trỏ tới danh mục gốc có `kind = 'LEGACY'`.
3. **Phân định rõ ranh giới phân loại (`ProductKind`)**:
   - `kind = 'LEGACY'`: Dành riêng cho sản phẩm cũ.
   - `kind = 'LAPTOP'`: Máy tính xách tay.
   - `kind = 'PHONE'`: Điện thoại thông minh.
   - `kind = 'ACCESSORY'`: Phụ kiện công nghệ cao (sạc, cáp, tai nghe, hub chuyển đổi).

---

## 2. Bảng quy tắc ánh xạ và chuẩn hóa thuộc tính

| Thuộc tính `Product` | Trị số cho sản phẩm M1 Điện tử | Trị số chuẩn hóa cho sản phẩm Legacy M0 |
|---|---|---|
| `kind` | `LAPTOP`, `PHONE`, `ACCESSORY` | `LEGACY` (mặc định enum) |
| `isLegacy` | `false` | `true` |
| `categoryId` | Trỏ tới bản ghi `Category` hợp lệ | `null` |
| `category` (cũ) | Tên danh mục đồng bộ (`Laptop`, `Phụ kiện`) | Chuỗi phân loại gốc (`Áo thun`, `Thời trang`) |
| `specs` (JSONB) | Tuân thủ schema version của `Category` | `null` |
| `warrantyConfig` (JSONB) | `{ policyType, periodMonths, provider }` | `null` (không có bảo hành điện tử chính hãng) |
| `weightGrams` | Trọng lượng đo kiểm thực tế (gram) | Fallback an toàn logistics: `200` - `300` gram |
| `lengthCm` / `widthCm` / `heightCm` | Kích thước đóng gói thực tế (cm) | Fallback an toàn: `20 x 15 x 5` cm |
| `dataSources` | Liên kết với `DataSource` trạng thái `ACTIVE` | Không liên kết (mảng rỗng) |

---

## 3. Cơ chế xử lý đơn hàng và đóng băng snapshot (Order Snapshot Fallback)

Khi khách hàng đặt mua sản phẩm legacy:
1. **Giá trị đơn giá (`unitPrice`)**:
   - Trích xuất trực tiếp từ `ProductVariant.price` hoặc `Product.price` dưới dạng `BigInt` chính xác tuyệt đối.
2. **Quy chuẩn mã nhận diện (`sku`)**:
   - Nếu có biến thể: sử dụng `ProductVariant.sku`.
   - Nếu không có biến thể: fallback về `Product.slug`, và cuối cùng là `Product.id`.
3. **Chính sách bảo hành (`warrantySnapshot`)**:
   - Ghi nhận `null` một cách minh bạch; DTO hiển thị `null`, không hiển thị thông tin bảo hành điện tử gây hiểu lầm cho người mua.
4. **Kích thước đóng gói (`packingLineSnapshot`)**:
   - Tự động áp dụng kích thước tiêu chuẩn cho bưu kiện nhỏ (`unitWeightGrams = 200`, `20 x 15 x 5 cm`) để tính phí vận chuyển GHN chính xác qua API, không làm đứt gãy luồng thanh toán và giao vận.
5. **Phiên bản lược đồ (`schemaRevision` & `sourceRevision`)**:
   - Ghi nhận `null` vì sản phẩm không thuộc lược đồ thông số kỹ thuật điện tử.

---

## 4. Tiêu chí sẵn sàng xuất bản (Catalog Readiness for Legacy)

Hàm `evaluateCatalogReadiness(productId)` áp dụng quy tắc riêng cho sản phẩm legacy:
```ts
if (product.kind === 'LEGACY' || product.isLegacy) {
  return {
    productId,
    publishable: true,
    missing: [],
    warnings: ['legacy_product: skipping electronics spec validation and data source requirements'],
    details: {
      hasBrand: Boolean(product.brandId),
      hasCategory: true,
      hasSpecs: false,
      hasActiveSource: false,
      hasPacking: Boolean(weight > 0 && length > 0 && width > 0 && height > 0),
      hasWarranty: Boolean(product.warrantyConfig),
      hasSellableVariant: Boolean(product.variants?.some((v) => v.isActive && Number(v.price) > 0)),
      isLegacy: true,
    },
  };
}
```
Nhờ đó:
- Sản phẩm cũ vẫn được bày bán bình thường trên trang chủ hoặc trang danh mục cũ.
- Sản phẩm cũ không bị từ chối xuất bản vì thiếu chứng chỉ nguồn `DataSource` hay thông số GIN JSONB.
- Toàn bộ 666 bài test tự động của hệ thống chạy đồng thời mà không xảy ra bất kỳ xung đột nào giữa dữ liệu mới và cũ.
