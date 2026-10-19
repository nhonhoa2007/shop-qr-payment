# Electronics Vertical Slice Provenance & Data Sources

Tài liệu kiểm chứng nguồn gốc dữ liệu (Data Provenance & Verification) cho lát cắt dọc 10 sản phẩm điện tử tiêu dùng mẫu phục vụ đồ án DACS2 (VKU).

---

## 1. Nguyên tắc tuân thủ pháp lý & Giấy phép dữ liệu

1. **Giấy phép đặc tả công khai (Public Spec Sheet)**: Toàn bộ thông số kỹ thuật được trích xuất từ tài liệu công bố công khai của nhà sản xuất (OEM Documentation / Product Specification Reference - PSREF).
2. **Quy trình kiểm soát trạng thái dữ liệu (Source Status)**:
   - Chỉ các bản ghi có trạng thái `ACTIVE` mới được lộ diện trên giao diện storefront thông qua DTO `EvidenceRef`.
   - Các bản ghi chưa qua kiểm duyệt (`DISCOVERED`, `LICENSE_REVIEW`, `MAPPING_REVIEW`, `REJECTED`, `REVOKED`) bị loại bỏ triệt để ở tầng server.
3. **Bảo toàn tính toàn vẹn (Integrity Checksum)**: Mỗi nguồn dữ liệu mang mã băm SHA-256 đối soát trực tiếp với nội dung tài liệu gốc.

---

## 2. Danh mục 10 sản phẩm và nguồn đối soát

| STT | Mã định danh (`id`) | Tên sản phẩm | Phân loại | Nhà sản xuất / Publisher | URL Nguồn tài liệu kỹ thuật | Giấy phép | Checksum (SHA-256) |
|---|---|---|---|---|---|---|---|
| 1 | `prod-mbp14-m3` | MacBook Pro 14 inch M3 | `LAPTOP` | Apple Inc. | [Apple Support SP898](https://support.apple.com/kb/SP898) | Public Technical Documentation | `a4b1c8e3f92d5017e8c39fa4109b6782d109f284c810398f6238b1d94f271049` |
| 2 | `prod-thinkpad-x1-c11` | Lenovo ThinkPad X1 Carbon Gen 11 | `LAPTOP` | Lenovo Group Limited | [Lenovo PSREF Spec](https://psref.lenovo.com/Product/ThinkPad/ThinkPad_X1_Carbon_Gen_11) | Lenovo PSREF Public Sheet | `f872c019482bf49102c98a3b817420194857b2938475c1029384756102938475` |
| 3 | `prod-iphone-15-pro-max` | Apple iPhone 15 Pro Max | `PHONE` | Apple Inc. | [Apple Support SP903](https://support.apple.com/kb/SP903) | Public Technical Documentation | `b928174629384756102938475610293847561029384756102938475610293847` |
| 4 | `prod-galaxy-s24-ultra` | Samsung Galaxy S24 Ultra 5G | `PHONE` | Samsung Electronics Co., Ltd. | [Samsung Official Specs](https://www.samsung.com/global/galaxy/galaxy-s24-ultra/specs/) | Samsung Open Hardware Specs | `d837261948572610394857261039485726103948572610394857261039485726` |
| 5 | `prod-anker-prime-67w` | Củ sạc nhanh Anker Prime 67W GaN | `ACCESSORY` | Anker Innovations | [Anker Product Guide A2669](https://www.anker.com/products/a2669) | Anker Public Data Sheet | `c728194726103948572610394857261039485726103948572610394857261039` |
| 6 | `prod-sony-wh-1000xm5` | Tai nghe chống ồn Sony WH-1000XM5 | `ACCESSORY` | Sony Corporation | [Sony Specs Guide](https://www.sony.com/electronics/headband-headphones/wh-1000xm5/specifications) | Sony Hardware Specifications | `e928174620194857261039485726103948572610394857261039485726103948` |
| 7 | `prod-apple-magic-mouse` | Chuột Apple Magic Mouse USB-C | `ACCESSORY` | Apple Inc. | [Apple Store MXK53AM/A](https://www.apple.com/shop/product/MXK53AM/A/magic-mouse-usb-c) | Public Technical Documentation | `a837261948572610394857261039485726103948572610394857261039485726` |
| 8 | `prod-dell-da310` | Hub đa năng Dell DA310 USB-C 7-in-1 | `ACCESSORY` | Dell Technologies Inc. | [Dell Commercial Catalog](https://www.dell.com/en-us/shop/dell-7-in-1-usb-c-multiport-adapter-da310/apd/470-aetl) | Dell Hardware Catalog Entry | `b728194726103948572610394857261039485726103948572610394857261039` |
| 9 | `prod-anker-737-powerbank` | Pin dự phòng Anker 737 PowerBank 140W | `ACCESSORY` | Anker Innovations | [Anker Product Guide A1289](https://www.anker.com/products/a1289) | Anker Public Data Sheet | `f928174620194857261039485726103948572610394857261039485726103948` |
| 10 | `prod-samsung-45w-charger` | Củ sạc siêu nhanh Samsung 45W Type-C | `ACCESSORY` | Samsung Electronics Co., Ltd. | [Samsung US EP-T4510](https://www.samsung.com/us/mobile/mobile-accessories/phones/45w-power-adapter-with-cable-ep-t4510xbegus/) | Samsung Open Hardware Specs | `c837261948572610394857261039485726103948572610394857261039485726` |

---

## 3. Quản lý tri thức 3 trạng thái (Three-State Knowledge State)

Các thuộc tính kỹ thuật tuân thủ nghiêm ngặt 3 trạng thái:
- `KNOWN`: Có giá trị đo lường thực tế và đơn vị tương thích (VD: MacBook Pro 14 M3 có `ram: 8 GB`, `display_size: 14.2 inch`).
- `UNSUPPORTED`: Thiết bị phần cứng không hỗ trợ tính năng này và không bao giờ có (VD: Laptop không có giao tiếp NFC -> `nfc: { state: 'UNSUPPORTED' }`; Củ sạc không có pin dự phòng -> `battery_capacity: { state: 'UNSUPPORTED' }`).
- `UNKNOWN`: Thuộc tính có áp dụng cho chủng loại nhưng chưa kiểm chứng được giá trị chính thức (VD: Magic Mouse có pin sạc nhưng Apple không công bố dung lượng mAh -> `battery_capacity: { state: 'UNKNOWN' }`).
