# TÀI LIỆU HƯỚNG DẪN ĐÓNG GÓI, CÀI ĐẶT VÀ VẬN HÀNH DỰ ÁN

**TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN & TRUYỀN THÔNG VIỆT - HÀN (VKU)**  
**HỌC PHẦN: ĐỒ ÁN CƠ SỞ 2 (DACS2)**  
**DỰ ÁN: SHOP QR PAYMENT**

---

- **Người biên soạn & phụ trách thuyết minh:** `[Họ và tên Sinh viên Tiên - MSSV]`  
- **Vai trò:** Lập trình viên Frontend (Storefront) & Chuyên viên Đóng gói triển khai  
- **Phiên bản tài liệu:** v1.2 (Chính thức cho Hội đồng chấm đồ án)  
- **Ngày phát hành:** 16/10/2026  

---

## 1. YÊU CẦU MÔI TRƯỜNG & HỆ THỐNG TỐI THIỂU

Để cài đặt và chạy thử nghiệm hệ thống Shop QR Payment ổn định nhất, máy tính cần đáp ứng các tiêu chuẩn kỹ thuật sau:

| Thành phần | Yêu cầu tối thiểu | Phiên bản khuyến nghị (Đã kiểm thử) | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Hệ điều hành** | Windows 10/11, macOS 12+, Linux (Ubuntu 20+, Arch) | Arch Linux / Windows 11 (WSL2) | Hỗ trợ đa nền tảng |
| **Node.js** | Phiên bản 20.x trở lên | Node.js v20.18 LTS hoặc v22.x | Bắt buộc hỗ trợ native ESM & test runner |
| **NPM** | Phiên bản 10.x trở lên | npm v10.8+ (Đi kèm Node.js) | Trình quản lý package |
| **Cơ sở dữ liệu** | PostgreSQL 14.x trở lên | PostgreSQL 16.x Localhost (Port 5432) | Chứa 18 bảng CSDL quan hệ |
| **Bộ nhớ RAM** | Tối thiểu 4 GB RAM | 8 GB RAM trở lên | Tối ưu hóa khi build Next.js |
| **Trình duyệt** | Chrome, Edge, Firefox, Safari | Google Chrome / Brave (Mới nhất) | Hỗ trợ WebSockets & LocalStorage |

---

## 2. QUY TRÌNH CÀI ĐẶT & KHỞI CHẠY HỆ THỐNG (TỪNG BƯỚC)

Quy trình chuẩn gồm 5 bước tuần tự. Sinh viên hoặc Giảng viên chỉ cần thực hiện theo các lệnh terminal bên dưới:

```
[Mã nguồn] ──> [npm install] ──> [.env Config] ──> [Prisma Sync & Seed] ──> [npm run dev]
```

### Bước 1: Mở thư mục mã nguồn
Mở cửa sổ dòng lệnh (Terminal / PowerShell / Command Prompt) và điều hướng vào thư mục gốc của dự án:
```bash
cd /path/to/shop-qr-payment
```

### Bước 2: Cài đặt các gói thư viện phụ thuộc (Dependencies)
Thực thi lệnh cài đặt thông qua trình quản lý npm:
```bash
npm install
```
*Thời gian dự kiến: 1 - 2 phút tùy tốc độ mạng.*

### Bước 3: Cấu hình tệp biến môi trường (`.env`)
Tạo tệp `.env` tại thư mục gốc của dự án (sao chép từ file mẫu hoặc cấu hình trực tiếp):
```bash
cp .env.example .env
```

**Bảng giải thích ý nghĩa các biến môi trường cốt lõi:**
| Biến môi trường | Giá trị cấu hình mẫu | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/shop_qr_payment?schema=public` | Chuỗi kết nối đến cơ sở dữ liệu PostgreSQL cục bộ. |
| `NEXTAUTH_SECRET` | `super-secret-key-vku-dacs2-32-chars-long` | Khóa bí mật mã hóa Session JWT của NextAuth. |
| `NEXTAUTH_URL` | `http://localhost:3000` | Tọa độ URL gốc của ứng dụng web. |
| `CASSO_API_KEY` | `test_casso_api_key` | Khóa API tích hợp cổng biến động số dư ngân hàng VietQR. |
| `CASSO_WEBHOOK_SECRET` | `test_casso_webhook_secret` | Chữ ký xác thực Webhook chống tấn công giả mạo (HMAC). |
| `PUSHER_APP_ID` | `demo_pusher_app_id` | Khóa định danh ứng dụng Pusher WebSockets. |
| `PUSHER_KEY` | `demo_pusher_key` | Public key phía Client nhận thông báo realtime. |
| `PUSHER_SECRET` | `demo_pusher_secret` | Khóa bảo mật phía Server để phát (broadcast) sự kiện. |
| `NEXT_PUBLIC_PUSHER_KEY` | `demo_pusher_key` | Đồng bộ key Pusher cho môi trường trình duyệt. |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | `ap1` | Cụm máy chủ Pusher khu vực Châu Á - Thái Bình Dương. |

*(Lưu ý: Dự án đã được thiết kế cơ chế Fallback Mock, các API bên thứ 3 như Casso, GHN hay Pusher đều có sẵn bộ giả lập nội bộ phục vụ cho việc demo chấm điểm mà không đòi hỏi tài khoản thật).*

### Bước 4: Đồng bộ CSDL và nạp dữ liệu mẫu (Database Sync & Seed)
1. Đồng bộ cấu trúc 18 bảng vào cơ sở dữ liệu PostgreSQL:
```bash
npx prisma db push
```
2. Nạp bộ dữ liệu mẫu phong phú (tài khoản demo, danh mục, sản phẩm biến thể, đơn hàng, mã giảm giá, đánh giá):
```bash
npm run seed
```
*Kết quả thông báo thành công: `🌱 Khởi tạo dữ liệu mẫu phong phú cho hệ thống hoàn tất!`*

### Bước 5: Khởi động hệ thống ở chế độ phát triển (Development)
Chạy lệnh khởi động máy chủ Next.js:
```bash
npm run dev
```
Truy cập trình duyệt tại địa chỉ: **`http://localhost:3000`**

---

## 3. DANH MỤC TÀI KHOẢN TRUY CẬP HỆ THỐNG SẴN CÓ

Sau khi chạy lệnh `npm run seed`, hệ thống đã thiết lập sẵn 3 tài khoản tương ứng với 3 phân quyền tác nhân để phục vụ việc demo:

| Phân quyền (Role) | Email đăng nhập | Mật khẩu | Mục đích sử dụng khi Demo |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin@shop.com` | `admin123` | Trực quan hóa Bảng điều khiển SaaS Bento Grid, xem 21 chỉ số KPI, duyệt đơn, tạo ma trận biến thể sản phẩm, đối soát giao dịch VietQR và phân quyền nhân viên. |
| **Nhân viên (Staff)** | `staff@shop.com` | `staff123` | Đăng nhập cổng vận hành cửa hàng, kiểm tra giới hạn menu theo ma trận quyền (chỉ hiển thị các mục được Admin cấp phép). |
| **Khách hàng (Customer)** | `khachhang@gmail.com` | `user123` | Mua sắm, thêm giỏ hàng, checkout VietQR, thanh toán ví nội bộ, theo dõi lịch sử đơn hàng, chat realtime với nhân viên. |

---

## 4. QUY TRÌNH ĐÓNG GÓI MÃ NGUỒN ĐỒ ÁN (PACKAGING)

Để phục vụ việc nộp file cho giáo viên hoặc sao lưu dự án, nhóm đã xây dựng script tự động hóa đóng gói chuẩn hóa:

### 4.1. Lệnh đóng gói tự động bằng Script
Chạy lệnh trực tiếp trên terminal:
```bash
./scripts/package-project.sh
```

**Nguyên lý hoạt động của Script:**
- Tự động tạo thư mục đầu ra `dist_packages/`.
- Tự động nén toàn bộ mã nguồn sạch thành tệp `shop-qr-payment_vku_[YYYYMMDD_HHMMSS].zip` (hoặc `.tar.gz`).
- **Loại trừ nghiêm ngặt các thư mục rác dung lượng lớn:**
  - `node_modules/` (Thư viện phụ thuộc — người nhận chỉ cần chạy `npm i`).
  - `.next/` (Bản build tạm thời của framework).
  - `.git/` (Lịch sử commit nội bộ).
  - `.hermes/`, `.claude/` (Cấu hình IDE/Agent).
  - Các tệp log và cache rác.
- **Kích thước gói nén sau khi tối ưu:** Chỉ khoảng **15 - 25 MB** (thay vì hơn 600 MB nếu để lộ `node_modules`), thuận tiện gửi qua Google Drive, Zalo, Microsoft Teams hoặc nộp hệ thống trường.

### 4.2. Lệnh đóng gói thủ công (Nếu máy không hỗ trợ Bash script)
Nếu sử dụng Windows PowerShell, có thể chạy lệnh nén có chọn lọc:
```powershell
Compress-Archive -Path src, prisma, docs, public, scripts, tests, package.json, tsconfig.json, .env.example, README.md -DestinationPath shop-qr-payment-vku.zip
```

---

## 5. HƯỚNG DẪN KIỂM ĐỊNH NGHIỆM THU (TEST & BUILD VERIFICATION)

Khi giáo viên yêu cầu kiểm tra chất lượng mã nguồn hoặc chạy thử nghiệm sản phẩm ở phiên bản đóng gói thương mại (Production), Tiên thực hiện 2 lệnh sau:

### 5.1. Chạy toàn bộ 452 ca kiểm thử tự động
```bash
npm run test
```
- **Kết quả kỳ vọng:** `✔ All tests passed (108 suites, 452 tests)`
- **Thời gian chạy:** Dưới 30 giây.
- **Ý nghĩa:** Chứng minh hệ thống backend và các logic giỏ hàng/thanh toán hoàn toàn vững chắc, không phát sinh lỗi tiềm ẩn.

### 5.2. Biên dịch bản Build Production
```bash
npm run build
npm start
```
- Hệ thống sẽ tối ưu hóa tĩnh (Static Generation), nén bundle JS/CSS và khởi chạy trên port 3000 với hiệu năng tối đa.

---

## 6. SỔ TAY XỬ LÝ SỰ CỐ NHANH (TROUBLESHOOTING DÀNH CHO TIÊN)

Dưới đây là các tình huống bất ngờ có thể xảy ra khi khởi động trước mặt giáo viên và câu trả lời/cách xử lý tức thì:

1. **Sự cố: Lỗi "Port 3000 is already in use"**
   - *Nguyên nhân:* Có một tiến trình khác đang chiếm dụng cổng 3000.
   - *Cách xử lý:* Chạy lệnh tắt cổng trên Linux/macOS: `npx kill-port 3000` hoặc chạy Next.js trên cổng phụ: `npx next dev -p 3001`.
   - *Giải thích với GV:* "Dạ thưa Thầy/Cô, do cổng 3000 đang có dịch vụ nền chạy ngầm, em chuyển nhanh sang cổng 3001 hoặc giải phóng cổng bằng công cụ kill-port ạ."

2. **Sự cố: Lỗi kết nối CSDL "Can't reach database server at localhost:5432"**
   - *Nguyên nhân:* Dịch vụ PostgreSQL trên máy chưa được bật.
   - *Cách xử lý:* Bật dịch vụ PostgreSQL:
     - Trên Arch/Ubuntu: `sudo systemctl start postgresql`
     - Trên Windows: Mở Services -> Start service `postgresql-x64-XX`.
   - *Giải thích với GV:* "Dạ thưa Thầy/Cô, do dịch vụ daemon PostgreSQL đang ở trạng thái dừng, em vừa khởi động lại service qua systemctl để ứng dụng kết nối lại qua Prisma Client ạ."

3. **Sự cố: Giáo viên yêu cầu reset lại dữ liệu về trạng thái ban đầu**
   - *Cách xử lý:* Chạy lại đúng một lệnh: `npm run seed`.
   - *Giải thích với GV:* "Dạ hệ thống có sẵn kịch bản seed dữ liệu tái lập bằng TypeScript (`prisma/seed.ts`). Chỉ cần chạy `npm run seed`, toàn bộ bảng dữ liệu sẽ được thiết lập lại sạch sẽ theo chuẩn trạng thái ban đầu ạ."
