# KỊCH BẢN DEMO LIVE VÀ BỘ CÂU HỎI VẤN ĐÁP BẢO VỆ ĐỒ ÁN (DACS2)

**TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN & TRUYỀN THÔNG VIỆT - HÀN (VKU)**  
**ĐỀ TÀI: SHOP QR PAYMENT**

---

Tài liệu này được biên soạn như một **cẩm nang thực chiến ("phao cứu sinh")** dành riêng cho nhóm 3 người, đặc biệt là **Tiên** và **Vanh**, giúp các bạn nắm rõ từng thao tác chuột, lời thoại thuyết minh và câu trả lời phản biện để đạt điểm tối đa trước Hội đồng chấm thi.

---

## PHẦN I: PHÂN BỔ THỜI GIAN BUỔI BÁO CÁO (TỔNG CỘNG: 15 PHÚT)

```
[00:00 - 02:00] Trưởng nhóm: Giới thiệu đề tài & Công bố Bảng phân công nhiệm vụ
[02:00 - 06:00] Tiên: Live Demo phân hệ Khách hàng (Storefront & VietQR Flow)
[06:00 - 10:00] Vanh: Live Demo phân hệ Quản trị (Admin Bento Grid & Staff Matrix)
[10:00 - 12:00] Trưởng nhóm: Trình diễn kiến trúc kỹ thuật & Chạy 452 ca kiểm thử
[12:00 - 15:00] Toàn nhóm: Trả lời câu hỏi vấn đáp phản biện của Giảng viên
```

---

## PHẦN II: KỊCH BẢN THAO TÁC DEMO TỪNG BƯỚC (STEP-BY-STEP)

### 1. Mở đầu: Giới thiệu (Trưởng nhóm / 2 phút)
- **Lời thoại mẫu:**  
  *"Kính thưa Quý Thầy/Cô trong Hội đồng chấm đồ án, nhóm em gồm 3 thành viên: Em là [Tên], đảm nhiệm vai trò Tech Lead & Kiến trúc Backend; bạn Tiên đảm nhiệm Lập trình Frontend phân hệ Khách hàng và Đóng gói triển khai; bạn Vanh đảm nhiệm Lập trình Frontend phân hệ Quản trị SaaS Bento Grid và Nhân viên.  
  Đề tài của nhóm em là **'Website thương mại điện tử tích hợp thanh toán VietQR tự động và Quản trị SaaS Bento Grid'**. Sau đây, bạn Tiên xin phép đại diện nhóm bắt đầu phần Demo luồng trải nghiệm khách hàng ạ."*

---

### 2. Demo Luồng Khách Hàng (Tiên thao tác & thuyết minh / 4 phút)

| Bước | Thao tác trên màn hình | Lời thoại thuyết minh của Tiên | Mở file code nếu GV yêu cầu |
| :---: | :--- | :--- | :--- |
| **B1** | Mở trình duyệt `http://localhost:3000`. Lướt nhẹ trang chủ, chỉ vào banner Hero và danh mục sản phẩm. | *"Dạ thưa Thầy/Cô, đây là giao diện Storefront dành cho khách hàng. Trang chủ được thiết kế theo phong cách hiện đại với hiệu ứng Hero Constellation, phân chia rõ ràng danh mục sản phẩm, bộ lọc theo giá và trạng thái còn hàng."* | `src/client/views/HomeView.tsx`<br>`src/client/components/home/HeroFloatingConstellation.tsx` |
| **B2** | Nhấp vào một sản phẩm có biến thể (Ví dụ: Áo Hoodie hoặc Giày). Chọn Size `L`, Màu `Đen`. Bấm **'Thêm vào giỏ hàng'**. | *"Khi vào chi tiết sản phẩm, khách hàng có thể chọn các biến thể thuộc tính đa chiều như Size, Màu sắc. Hệ thống tự động cập nhật số lượng tồn kho khả dụng theo từng mã SKU tương ứng. Em bấm Thêm vào giỏ hàng, thông báo Toast hiện lên tức thì."* | `src/client/views/ProductDetailView.tsx`<br>`src/client/components/product/ProductDetailView.tsx` |
| **B3** | Bấm vào biểu tượng Giỏ hàng trên Header. Tăng số lượng lên 2. Bấm **'Tiến hành thanh toán'**. | *"Giỏ hàng được quản lý trạng thái tập trung qua Zustand Store và đồng bộ với LocalStorage, giúp dữ liệu không bị mất khi F5 trang. Em bấm thanh toán để chuyển sang trang Checkout."* | `src/client/views/CartView.tsx`<br>`src/client/stores/cart-store.ts` |
| **B4** | Tại trang Checkout: Chọn Tỉnh/Thành, Quận/Huyện, Phường/Xã (Tích hợp định vị GHN). Chọn phương thức **'Chuyển khoản VietQR (Napas 247)'**. Bấm **'Đặt hàng ngay'**. | *"Ở trang thanh toán, hệ thống tích hợp API danh mục địa chỉ chuẩn của Giao Hàng Nhanh. Khách hàng chọn phương thức thanh toán VietQR tự động và tiến hành đặt hàng."* | `src/client/views/CheckoutView.tsx`<br>`src/client/components/checkout/CheckoutForm.tsx` |
| **B5** | Màn hình chuyển sang trang **Payment (`/payment/[orderId]`)**. Chỉ vào mã QR động, số tài khoản, số tiền, nội dung chuyển khoản và **Đồng hồ đếm ngược 15:00**. | *"Đây là tính năng cốt lõi của đề tài: Màn hình sinh mã VietQR động chuẩn Napas 247. Mã QR này chứa sẵn số tiền chính xác và mã đơn hàng duy nhất trong phần nội dung. Kèm theo đó là đồng hồ đếm ngược 15 phút. Nếu sau 15 phút khách không thanh toán, đơn sẽ tự động hủy để hoàn tồn kho."* | `src/client/views/PaymentView.tsx`<br>`src/client/components/payment/QRPayment.tsx` |
| **B6** | Giả lập khớp tiền thành công: Màn hình tự động nhảy sang màu xanh `ĐÃ THANH TOÁN THÀNH CÔNG` (Realtime). | *"Khi tài khoản ngân hàng nhận được tiền, Webhook sẽ phát sự kiện qua Pusher WebSockets. Màn hình của khách hàng tự động chuyển sang trạng thái PAID trong vài giây mà không cần người dùng bấm F5 hay gửi ảnh biên lai ạ."* | `src/client/components/payment/PaymentStatus.tsx` |
| **B7** | Vào mục **'Đơn hàng của tôi'** (`/orders`), bấm nút **'Hủy đơn hàng'**. | *"Khách hàng có thể chủ động hủy đơn khi đơn ở trạng thái chờ duyệt. Khi bấm Hủy đơn, tiền sẽ được hoàn trả 100% tự động vào Ví Shop Wallet nội bộ của khách hàng ạ."* | `src/client/views/OrdersView.tsx`<br>`src/client/views/WalletView.tsx` |

---

### 3. Demo Luồng Quản Trị & Phân Quyền (Vanh thao tác & thuyết minh / 4 phút)

| Bước | Thao tác trên màn hình | Lời thoại thuyết minh của Vanh | Mở file code nếu GV yêu cầu |
| :---: | :--- | :--- | :--- |
| **B1** | Mở tab trình duyệt ẩn danh (Incognito), vào `http://localhost:3000/admin`. Đăng nhập tài khoản `admin@shop.com` / `admin123`. | *"Dạ thưa Thầy/Cô, em xin phép demo phân hệ Quản trị. Em đang đăng nhập với vai trò Quản trị viên (Admin). Ngay sau khi đăng nhập, hệ thống hiển thị Bảng điều khiển SaaS Bento Grid."* | `src/client/views/admin/AdminDashboardView.tsx`<br>`src/client/components/admin/layout/AdminAppShell.tsx` |
| **B2** | Chỉ vào các thẻ Bento Grid trên Dashboard: Doanh thu thực tế, Doanh thu dự kiến, AOV, Biểu đồ cột SVG 7 ngày, Biểu đồ tròn thanh toán (Donut Chart). | *"Bảng điều khiển được tổ chức theo ngôn ngữ thiết kế Bento Grid với 21 chỉ số KPI vận hành thời gian thực. Admin có thể nhìn thấy ngay doanh thu hôm nay, tỷ lệ đơn hủy, biểu đồ doanh thu 7 ngày qua và cơ cấu phương thức thanh toán VietQR so với Ví nội bộ."* | `src/client/components/admin/dashboard/AdminKpiStrip.tsx`<br>`src/client/components/admin/dashboard/AdminRevenueBars.tsx`<br>`src/client/components/admin/dashboard/AdminDonutChart.tsx` |
| **B3** | Vào mục **'Đơn hàng'** (`/admin/orders`). Tìm đơn hàng vừa đặt của Tiên, duyệt đơn từ `PAID` sang `SHIPPING`. | *"Đây là trang quản lý đơn hàng hoạt động theo Máy trạng thái hữu hạn (FSM). Admin duyệt đơn sang trạng thái Đang giao hàng, hệ thống tự động sinh mã vận đơn Giao Hàng Nhanh và khóa không cho hủy đơn trái quy trình."* | `src/client/views/admin/AdminOrdersView.tsx` |
| **B4** | Vào mục **'Đối soát giao dịch'** (`/admin/transactions`). Chỉ vào danh sách biến động số dư ngân hàng và nút **'Khớp thủ công'**. | *"Trang Đối soát ngân hàng lưu lại toàn bộ log biến động số dư VietQR. Trong trường hợp khách hàng chuyển khoản nhưng gõ sai nội dung đơn hàng, hệ thống cho phép Admin thực hiện khớp tiền thủ công có lưu vết kiểm toán ạ."* | `src/client/views/admin/AdminTransactionsView.tsx`<br>`src/client/components/admin/BankReviewPanel.tsx` |
| **B5** | Vào mục **'Khách hàng & Phân quyền'** (`/admin/customers`). Chọn một tài khoản, phân vai trò `STAFF` và tích chọn 2 quyền: `Đơn hàng` và `Sản phẩm`. | *"Đây là tính năng Ma trận phân quyền nhân viên (Staff Permission Matrix). Admin có thể bổ nhiệm tài khoản thành Staff và chỉ cấp một số quyền cụ thể trong 5 nhóm quyền độc lập (Đơn hàng, Sản phẩm, Vận chuyển, Chat, Đánh giá)."* | `src/client/views/admin/AdminCustomersView.tsx` |
| **B6** | Đăng xuất. Đăng nhập tài khoản `staff@shop.com` / `staff123`. Chỉ vào thanh Sidebar bên trái. | *"Bây giờ em đăng nhập bằng tài khoản Nhân viên. Như Thầy/Cô có thể thấy, thanh menu Sidebar bên trái đã tự động ẩn đi các mục nhạy cảm như Doanh thu tài chính, Cấu hình đối soát và Phân quyền; nhân viên chỉ thấy đúng các mục mà Admin đã phê duyệt ạ."* | `src/client/components/admin/layout/AdminSidebar.tsx` |

---

### 4. Báo Cáo Kỹ Thuật & Nghiệm Thu (Trưởng nhóm / 2 phút)
- **Lời thoại mẫu:**  
  *"Kính thưa Thầy/Cô, để đảm bảo toàn bộ mã nguồn của nhóm hoạt động bền vững, không lỗi hồi quy, nhóm em đã xây dựng bộ kiểm thử tự động toàn diện với 452 ca kiểm thử (Unit test & Integration test) chạy trên test runner gốc của Node.js. Sau đây em xin phép chạy trực tiếp trên terminal ạ."*
- **Thực thi trên Terminal:**
  ```bash
  npm run test
  ```
- **Kết quả hiển thị trên màn hình chiếu:** `108 suites passed, 452 tests passed (100%)`.

---

## PHẦN III: PHAO CỨU SINH VẤN ĐÁP DÀNH RIÊNG CHO TIÊN (STOREFRONT & PACKAGING)

### Câu 1: Em đã sử dụng những công nghệ và thư viện gì để xây dựng giao diện khách hàng?
- **Trả lời:** *"Dạ thưa Thầy/Cô, ở phân hệ giao diện khách hàng, em sử dụng **Next.js 16 (App Router)** với các Client Component khai báo `'use client'`. Về giao diện và tạo kiểu, em dùng **Tailwind CSS v4** kết hợp bộ icon **Lucide React**. Quản lý trạng thái giỏ hàng và danh sách yêu thích em dùng thư viện **Zustand**. Để hiển thị các thông báo trực quan (Toast), em dùng thư viện **Sonner** ạ."*
- **File dẫn chứng:** `package.json`, `src/client/views/HomeView.tsx`, `src/client/stores/cart-store.ts`.

### Câu 2: Giỏ hàng được lưu trữ ở đâu? Nếu khách hàng tắt trình duyệt hoặc F5 thì hàng trong giỏ có bị mất không?
- **Trả lời:** *"Dạ thưa Thầy/Cô, giỏ hàng được quản lý bằng **Zustand Store** kết hợp middleware `persist`. Toàn bộ danh sách sản phẩm, số lượng và biến thể được lưu tự động vào `localStorage` của trình duyệt dưới khóa `shop-cart-storage`. Do đó, khi khách hàng F5 tải lại trang hoặc tắt trình duyệt mở lại, giỏ hàng vẫn được bảo toàn nguyên vẹn ạ."*
- **File dẫn chứng:** `src/client/stores/cart-store.ts` (Dòng 21: `persist(...)`).

### Câu 3: Đồng hồ đếm ngược 15 phút trên trang thanh toán VietQR hoạt động như thế nào?
- **Trả lời:** *"Dạ trên trang Payment (`/payment/[orderId]`), em dùng React Hook `useEffect` kết hợp hàm `setInterval` đếm mỗi 1000ms (1 giây). Thời gian còn lại được tính bằng chênh lệch giữa thời điểm hết hạn (`order.createdAt + 15 phút`) trừ đi thời gian hiện tại (`Date.now()`). Khi thời gian đếm ngược về 0, giao diện sẽ tự động chuyển sang trạng thái cảnh báo đơn hàng đã hết hạn và vô hiệu hóa mã QR ạ."*
- **File dẫn chứng:** `src/client/views/PaymentView.tsx`, `src/client/components/payment/QRPayment.tsx`.

### Câu 4: Vì sao khi người dùng chuyển khoản thành công thì màn hình thanh toán tự động chuyển sang màu xanh mà không cần khách hàng bấm F5?
- **Trả lời:** *"Dạ thưa Thầy/Cô, em tích hợp thư viện **Pusher-js** ở phía giao diện. Khi vào trang thanh toán của đơn hàng X, component sẽ đăng ký lắng nghe (subscribe) một channel WebSockets riêng có tên là `order-X`. Khi Webhook ngân hàng phía server ghi nhận tiền về, server sẽ phát (broadcast) sự kiện `order:paid`. Client nhận được sự kiện này qua kết nối socket mở sẵn và tự động cập nhật State sang `PAID` ngay lập tức ạ."*
- **File dẫn chứng:** `src/client/views/PaymentView.tsx` (Tìm hàm `pusher.subscribe`).

### Câu 5: Em đóng gói dự án này như thế nào để nộp cho Giảng viên hoặc triển khai máy khác?
- **Trả lời:** *"Dạ em đã xây dựng một script đóng gói tự động hóa bằng Bash đặt tại `scripts/package-project.sh`. Khi chạy script, hệ thống sẽ tự động quét và nén toàn bộ mã nguồn sạch thành file `.zip`, đồng thời loại trừ triệt để các thư mục rác dung lượng lớn như `node_modules/`, `.next/`, `.git/` và các file log. Nhờ vậy file nén nộp bài chỉ nặng khoảng 15–20 MB. Người nhận chỉ cần làm theo tài liệu `HUONG_DAN_DONG_GOI_VA_CAI_DAT.md`, chạy `npm install` và `npm run seed` là có thể chạy ngay ạ."*
- **File dẫn chứng:** `scripts/package-project.sh`, `docs/academic/HUONG_DAN_DONG_GOI_VA_CAI_DAT.md`.

---

## PHẦN IV: PHAO CỨU SINH VẤN ĐÁP DÀNH RIÊNG CHO VANH (ADMIN PORTAL & STAFF MATRIX)

### Câu 1: Bảng điều khiển Admin Bento Grid hiển thị những thông số gì và tại sao lại chọn phong cách thiết kế này?
- **Trả lời:** *"Dạ thưa Thầy/Cô, Bảng điều khiển Admin được thiết kế theo phong cách **Bento Grid** hiện đại (lấy cảm hứng từ khay cơm Bento Nhật Bản, chia thông tin thành các ô khối trực quan, không lãng phí không gian). Bảng hiển thị **21 chỉ số KPI vận hành**, chia làm 4 nhóm chính: 
  1. Chỉ số doanh thu tài chính (Doanh thu thực tế, dự kiến, AOV - Giá trị đơn trung bình);
  2. Biểu đồ cột SVG hiển thị doanh thu 7 ngày gần nhất;
  3. Biểu đồ tròn Donut Chart phân tích tỷ trọng giữa các phương thức thanh toán VietQR và Ví nội bộ;
  4. Thẻ đơn hàng thời gian thực và top sản phẩm bán chạy nhất."*
- **File dẫn chứng:** `src/client/views/admin/AdminDashboardView.tsx`, `src/client/components/admin/dashboard/**`.

### Câu 2: Ma trận phân quyền nhân viên (Staff Permission Matrix) hoạt động ở phía giao diện Frontend như thế nào?
- **Trả lời:** *"Dạ thưa Thầy/Cô, hệ thống chia nhân viên thành 5 nhóm quyền độc lập: `orders`, `products`, `shipments`, `chat`, `reviews`. Ở phía Frontend:
  1. Trong component `AdminSidebar.tsx`, em viết logic lọc mảng danh mục menu dựa trên mảng `permissions` lưu trong Session người dùng. Nếu tài khoản Staff không có quyền `orders`, mục Đơn hàng trên thanh điều hướng sẽ tự động bị ẩn.
  2. Ở cấp độ Route/Page, em kiểm tra quyền nếu truy cập trực tiếp bằng URL thì hệ thống sẽ hiển thị cảnh báo `403 - Bạn không có quyền truy cập trang này`."*
- **File dẫn chứng:** `src/client/components/admin/layout/AdminSidebar.tsx`, `src/client/views/admin/AdminCustomersView.tsx`.

### Câu 3: Trang Đối soát giao dịch ngân hàng phục vụ mục đích gì và Admin thao tác ra sao?
- **Trả lời:** *"Dạ thưa Thầy/Cô, trang Đối soát (`/admin/transactions`) là công cụ đối chiếu giữa dữ liệu sổ cái ngân hàng và đơn hàng trong hệ thống. Hệ thống có 2 cơ chế:
  - Tự động: Webhook tự động khớp mã đơn trong nội dung chuyển khoản.
  - Thủ công: Dành cho các trường hợp ngoại lệ như khách hàng gõ sai nội dung, chuyển thiếu tiền hoặc ngân hàng bị nghẽn mạng sao kê. Admin có thể tra cứu mã giao dịch ngân hàng, bấm nút **'Khớp tiền thủ công'** để xác nhận đơn hàng sang `PAID` và cập nhật vết kiểm toán (Audit Log) lưu rõ ai là người duyệt ạ."*
- **File dẫn chứng:** `src/client/views/admin/AdminTransactionsView.tsx`, `src/client/components/admin/BankReviewPanel.tsx`.

### Câu 4: Làm thế nào để quản trị được sản phẩm có nhiều biến thể phức tạp (Size, Màu sắc)?
- **Trả lời:** *"Dạ trên giao diện `AdminProductsView.tsx`, em xây dựng bảng ma trận biến thể **SKU Matrix**. Khi Admin nhập các thuộc tính như Size (S, M, L) và Màu (Đỏ, Xanh), hệ thống sẽ tự động nhân ma trận để sinh ra các dòng biến thể SKU cụ thể. Admin có thể nhập giá bán và số lượng tồn kho riêng biệt cho từng SKU, giúp quản lý kho hàng chính xác tuyệt đối."*
- **File dẫn chứng:** `src/client/views/admin/AdminProductsView.tsx`.

### Câu 5: Nếu giáo viên yêu cầu em chỉ vào code layout của trang Quản trị, em sẽ chỉ vào đâu?
- **Trả lời:** *"Dạ em sẽ mở ngay thư mục `src/client/components/admin/layout/`. Trong đó:
  - `AdminAppShell.tsx`: Khung bao ngoài chứa thanh Sidebar bên trái và Topbar bên trên.
  - `AdminSidebar.tsx`: Thanh điều hướng menu có kiểm tra phân quyền RBAC.
  - `AdminTopbar.tsx`: Thanh công cụ trên cùng chứa thông tin tài khoản đang đăng nhập, nút chuyển chế độ và nút đăng xuất ạ."*
- **File dẫn chứng:** `src/client/components/admin/layout/AdminAppShell.tsx`.

---

## PHẦN V: BẢNG TỔNG HỢP "TỬ HUYỆT" & FILE CODE DÀNH CHO TIÊN VÀ VANH

Khi giáo viên chỉ tay vào bất kỳ thành phần nào trên màn hình và bảo: *"Mở file code phần này lên cho thầy xem"*, hai bạn chỉ cần bình tĩnh mở đúng file theo bảng tra cứu thần tốc dưới đây:

| Màn hình hiển thị trên Web | Ai phụ trách? | Mở đúng đường dẫn File này trong VS Code |
| :--- | :---: | :--- |
| **Trang chủ & Banner vũ trụ Hero** | Tiên | `src/client/views/HomeView.tsx`<br>`src/client/components/home/HeroFloatingConstellation.tsx` |
| **Trang Chi tiết sản phẩm & Chọn Size/Màu** | Tiên | `src/client/views/ProductDetailView.tsx` |
| **Giỏ hàng & Nút tăng giảm số lượng** | Tiên | `src/client/views/CartView.tsx`<br>`src/client/stores/cart-store.ts` |
| **Trang Checkout & Điền địa chỉ GHN** | Tiên | `src/client/views/CheckoutView.tsx`<br>`src/client/components/checkout/CheckoutForm.tsx` |
| **Mã VietQR động & Đồng hồ đếm ngược 15p** | Tiên | `src/client/views/PaymentView.tsx`<br>`src/client/components/payment/QRPayment.tsx` |
| **Giao diện Ví Shop Wallet & Nạp tiền** | Tiên | `src/client/views/WalletView.tsx`<br>`src/client/components/wallet/WalletTopupModal.tsx` |
| **Giao diện Chat khách hàng với Shop** | Tiên | `src/client/views/ChatView.tsx`<br>`src/client/components/chat/ChatWindow.tsx` |
| **Tài liệu đóng gói & File script bash** | Tiên | `scripts/package-project.sh`<br>`docs/academic/HUONG_DAN_DONG_GOI_VA_CAI_DAT.md` |
| **Bảng điều khiển Admin Bento Grid (21 KPI)** | Vanh | `src/client/views/admin/AdminDashboardView.tsx`<br>`src/client/components/admin/dashboard/AdminKpiStrip.tsx` |
| **Biểu đồ cột doanh thu 7 ngày (SVG)** | Vanh | `src/client/components/admin/dashboard/AdminRevenueBars.tsx` |
| **Biểu đồ tròn phương thức thanh toán** | Vanh | `src/client/components/admin/dashboard/AdminDonutChart.tsx` |
| **Quản lý Đơn hàng & Bộ lọc FSM** | Vanh | `src/client/views/admin/AdminOrdersView.tsx` |
| **Quản lý Sản phẩm & Bảng ma trận SKU** | Vanh | `src/client/views/admin/AdminProductsView.tsx` |
| **Đối soát ngân hàng & Khớp tiền VietQR** | Vanh | `src/client/views/admin/AdminTransactionsView.tsx`<br>`src/client/components/admin/BankReviewPanel.tsx` |
| **Phân quyền nhân viên (Staff Permissions)** | Vanh | `src/client/views/admin/AdminCustomersView.tsx`<br>`src/client/components/admin/layout/AdminSidebar.tsx` |
| **Quản lý Vận đơn GHN & Lộ trình** | Vanh | `src/client/views/admin/AdminShipmentsView.tsx` |
| **Quản lý Mã giảm giá (Coupons)** | Vanh | `src/client/views/admin/AdminCouponsView.tsx` |
| **Kiểm duyệt Đánh giá (Reviews)** | Vanh | `src/client/views/admin/AdminReviewsView.tsx` |
| **Cổng CSKH trực tuyến của nhân viên** | Vanh | `src/client/views/admin/AdminChatView.tsx` |

---

## PHẦN VI: NGUYÊN TẮC VÀNG TRONG PHÒNG BẢO VỆ

1. **Bình tĩnh, lắng nghe hết câu hỏi:** Không ngắt lời giáo viên. Khi nghe xong, bắt đầu bằng: *"Dạ em cảm ơn câu hỏi của Thầy/Cô..."*.
2. **Nói chắc, rõ ràng, đúng trọng tâm:** Nếu giáo viên hỏi về Frontend, trả lời đúng phần việc của mình (Zustand, giao diện React, Tailwind, hiệu ứng, trải nghiệm người dùng).
3. **Phối hợp đồng đội nhịp nhàng:** Khi giáo viên hỏi sâu về CSDL hoặc Backend API phức tạp (như xử lý race condition hay webhook mã hóa HMAC), Tiên hoặc Vanh có thể khéo léo chuyển tiếp: *"Dạ ở phần giao diện em xử lý nhận dữ liệu và hiển thị trực quan; còn về phần thuật toán xử lý luồng Backend và khóa dữ liệu nguyên tử, bạn Trưởng nhóm đã thiết kế rất kỹ, em xin phép mời bạn giải thích sâu hơn về mặt kỹ thuật ạ."* -> Cách đối đáp này thể hiện tinh thần làm việc nhóm chuyên nghiệp và được hội đồng đánh giá rất cao!
