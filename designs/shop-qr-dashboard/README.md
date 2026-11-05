# shop. — Dashboard preview

Bản xem trước tương tác cho trung tâm quản trị Shop QR Payment, xây bằng skill baoyu-dashboard. Nội dung nằm trong thư mục này, tách khỏi ứng dụng Next.js.

Bản preview được dựng ngày 03/11/2026. Giao diện tương ứng được đưa vào ứng dụng `/admin` ngày 04/11/2026; preview này vẫn dùng dữ liệu mẫu riêng.

Thiết kế hiện tại theo hướng tối giản: nền trắng, chữ và đường phân cách trung tính, một màu nhấn cho dữ liệu đang chọn. Sidebar cố định bên trái trên màn hình rộng để chuyển mục tức thì; trên màn hình nhỏ, menu Animate UI mở cùng các mục đó. Bốn KPI ở đầu trang dẫn tới biểu đồ doanh thu, tỷ trọng thanh toán, việc cần xử lý và bảng đơn hàng.

## Mở preview

```bash
node /home/nhonhoa/.codex/plugins/cache/baoyu-design/baoyu-dashboard/2.8.2/skills/claude-dashboard/scripts/artifact.mjs open designs/shop-qr-dashboard
```

Khoảng thời gian mặc định: 7 ngày, chốt mẫu ngày 03/11/2026. Có thể chọn hôm nay hoặc 30 ngày, xem tooltip doanh thu và tỷ trọng thanh toán, tìm đơn hàng, lọc trạng thái, sắp xếp tổng tiền, xuất CSV/JSON các đơn đang lọc. Sidebar và menu trên màn hình nhỏ cùng dẫn tới các mục của bản preview.

## Animate UI trong preview

Bộ chọn kỳ (Toggle Group), menu xuất dữ liệu (Dropdown Menu), hộp thông tin (Dialog) và menu mobile (Dialog dạng Sheet) dùng **`@animate-ui/react` 2.4.1 thực sự**, dựa trên Radix UI và Motion, không phải hiệu ứng CSS giả lập thư viện. Các component tôn trọng thiết lập giảm chuyển động và sử dụng hành vi focus/bàn phím của Radix.

Theo yêu cầu dùng Animate UI trực tiếp trong preview này, trang được mở rộng bằng các vùng React nhỏ. Đây là ngoại lệ so với định dạng HTML/D3 mặc định của skill baoyu-dashboard. React/Motion/Radix và các component được esbuild đóng gói thành classic script trong `src/`; không có CDN hay module import lúc chạy. Mỗi file nhỏ hơn giới hạn document 256 KB, và các React root được mount/update/unmount bằng lifecycle `dash.draw`. Portal của dialog/menu nằm bên trong vùng vẽ để CSS, nguồn và vòng đời vẫn thuộc preview. Dataset, Sources và biểu đồ D3 giữ nguyên.

Dependency chỉ ở `animate-ui/`, tách khỏi dependencies và giao diện `/admin` của app chính. Khóa phiên bản tại `animate-ui/package-lock.json`. Mã nguồn third-party vẫn giữ các license notice trong bundle và trong package cài đặt.

## Dữ liệu

- Tên, loại, SKU và giá của 8 sản phẩm lấy từ `prisma/data/electronics-catalog.json` trong project.
- Toàn bộ đơn hàng, khách hàng ẩn danh, trạng thái giao dịch, số tồn kho và số liệu kinh doanh đều là **dữ liệu mẫu được sinh ra** bằng `src/prepare-data.py`, seed `20261103`. Không đọc dữ liệu cá nhân, biến môi trường, cơ sở dữ liệu hay tài khoản ngân hàng.
- Doanh thu là tổng tiền của các đơn đã thanh toán, chưa trừ hoàn tiền; tỷ lệ khớp chỉ áp dụng với đơn VietQR đã thanh toán. Bộ lọc kỳ tác động đến KPI, biểu đồ, top sản phẩm và đơn hàng. Trung tâm xử lý là ảnh chụp toàn cửa hàng tại ngày chốt mẫu và không đổi theo bộ lọc.
- Files JSON gốc ở `src/`, bản đính kèm ở `_blobs/`. Ai được cấp bản sao thư mục đều đọc được các file này. Sources trong trình xem cho phép xem dữ liệu, công thức và tải CSV.

## Chỉnh sửa

Trang gốc: `src/index.html`, `src/dashboard.js`, `src/animate-preview.css`, `src/minimal.css`. Component React ở `animate-ui/components.jsx`, các chuỗi giao diện cố định nằm trong HTML templates của trang. Nếu sửa component, chạy build trước khi đồng bộ:

```bash
npm ci --prefix designs/shop-qr-dashboard/animate-ui
npm run build --prefix designs/shop-qr-dashboard/animate-ui
python designs/shop-qr-dashboard/src/sync-page.py
node /home/nhonhoa/.codex/plugins/cache/baoyu-design/baoyu-dashboard/2.8.2/skills/claude-dashboard/scripts/artifact.mjs check designs/shop-qr-dashboard
```

`sync-page.py` chỉ cập nhật trang, giữ dữ liệu và bộ lọc hiện tại. `prepare-store.py` dùng khi tạo lại toàn bộ dashboard và đặt lại bộ lọc mặc định.

Preview này vẫn dùng dữ liệu mẫu riêng; trang `/admin` của ứng dụng đã dùng API analytics với dữ liệu thật.
