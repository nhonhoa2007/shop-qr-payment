# KẾ HOẠCH TRIỂN KHAI: QUÊN MẬT KHẨU & PHÂN QUYỀN ADMIN (PLAN_AUTH_ADMIN_RBAC.md)

Dự án: **Shop QR Payment**  
Điều phối: **Tech Lead / System Architect**  
Mục tiêu: Phân rã nhiệm vụ cho 3 subagents: `be-coder`, `fe-coder`, `tester`.

---

## 1. PHÂN CÔNG TÁC VỤ CHO SUBAGENTS

### Gói công việc B: Backend & Database Architect (`be-coder`)
- **B1**: Nâng cấp `src/lib/otp.ts`:
  - Mở rộng hàm `sendOtp` và `verifyOtp` hỗ trợ tham số `type: 'REGISTRATION' | 'PASSWORD_RESET'`.
  - Giữ nguyên các cơ chế an toàn: cooldown 60s, TTL 5 phút, bcrypt hash OTP, giới hạn max 5 attempts.
- **B2**: Tạo email template `src/emails/PasswordResetEmail.tsx` (dành riêng cho thông báo mã OTP đặt lại mật khẩu với giao diện React Email chỉn chu).
- **B3**: Tạo Controller & Route Quên mật khẩu:
  - `src/server/modules/auth/forgot-password.controller.ts` & `src/app/api/auth/forgot-password/route.ts`.
  - Kiểm tra email hợp lệ, kiểm tra tài khoản tồn tại và không bị khóa (`!isBlocked`), gọi `sendOtp` với `PASSWORD_RESET`.
- **B4**: Tạo Controller & Route Đặt lại mật khẩu:
  - `src/server/modules/auth/reset-password.controller.ts` & `src/app/api/auth/reset-password/route.ts`.
  - Validate mật khẩu mới (tối thiểu 6 ký tự), verify OTP `PASSWORD_RESET`, hash mật khẩu mới với bcrypt, update user trong Prisma, mark OTP used.
- **B5**: Cập nhật NextAuth `auth-options.ts`:
  - Trong `authorize()` credentials & `signIn()` Google: kiểm tra `if (user.isBlocked) throw new Error('TÀI_KHOẢN_BỊ_KHÓA')`.
  - Bổ sung `isBlocked` vào JWT token và session callback.
- **B6**: Mở rộng API Quản lý Người dùng & Phân quyền Admin:
  - Cập nhật `src/server/modules/admin/customers.controller.ts` & `src/server/modules/admin/admin.service.ts`:
    - Cho phép query toàn bộ users (hỗ trợ filter theo role: `ALL`, `CUSTOMER`, `STAFF`, `ADMIN`, filter status: `ALL`, `ACTIVE`, `BLOCKED`, search query).
    - Thêm handler `PATCH`: Cho phép Admin đổi vai trò (`role`), Khóa/Mở khóa tài khoản (`isBlocked`), Kích hoạt xác thực thủ công (`isVerified`).
    - Validate an toàn: Admin không được tự khóa hoặc hạ quyền của chính mình.

---

### Gói công việc F: Frontend & UI/UX Specialist (`fe-coder`)
- **F1**: Cập nhật `src/client/components/auth/LoginForm.tsx`:
  - Bổ sung liên kết "Quên mật khẩu?" cạnh nhãn Mật khẩu dẫn tới `/forgot-password`.
  - Hiển thị thông báo rõ ràng khi tài khoản bị khóa nếu đăng nhập trả về lỗi liên quan.
- **F2**: Tạo Giao diện Quên & Đặt lại mật khẩu:
  - Tạo `src/client/components/auth/ForgotPasswordForm.tsx` (hoặc 2 bước trực quan: Bước 1 gửi mã OTP về email, Bước 2 nhập mã OTP 6 số + Mật khẩu mới + Xác nhận mật khẩu mới kèm countdown 60s resend).
  - Tạo `src/client/views/auth/ForgotPasswordView.tsx`.
  - Tạo trang route `src/app/(auth)/forgot-password/page.tsx`.
- **F3**: Nâng cấp Giao diện Quản trị Người dùng & Phân quyền (`AdminCustomersView.tsx` / `CustomerManager`):
  - Đổi tên tiêu đề thành "Quản lý Người dùng & Phân quyền Hệ thống".
  - Thêm thẻ KPI: Tổng người dùng, Khách hàng, Nhân viên/Admin, Tài khoản bị khóa.
  - Bổ sung thanh lọc Role (`Tất cả`, `Khách hàng`, `Nhân viên`, `Quản trị viên`) và Trạng thái (`Tất cả`, `Đang hoạt động`, `Đã bị khóa`).
  - Hiển thị cột Vai trò (Badge rõ màu: Xanh dương cho ADMIN, Tím cho STAFF, Xám cho CUSTOMER) và Trạng thái khóa (Đỏ nếu Bị khóa).
  - Modal hoặc Popover hành động cho từng tài khoản:
    - Nút / Select chuyển đổi vai trò (Customer <-> Staff <-> Admin).
    - Nút chuyển trạng thái Khóa / Mở khóa tài khoản (có cảnh báo).
    - Nút kích hoạt xác thực email thủ công.
- **F4**: Cập nhật `AdminDashboardView.tsx`:
  - Cập nhật card "Quản lý người dùng & phân quyền" trên bảng điều khiển với icon ShieldCheck / Users và mô tả quyền hạn đầy đủ.

---

### Gói công việc Q: QA & Test Automation (`tester`)
- **Q1**: Xây dựng test suite `tests/password-reset.test.ts`:
  - Test validation email và format đầu vào.
  - Test sinh OTP với type `PASSWORD_RESET` và giới hạn cooldown 60s.
  - Test verify OTP với giới hạn tối đa 5 lần thử sai.
  - Test đổi mật khẩu thành công và hash mật khẩu mới đúng chuẩn bcrypt.
- **Q2**: Xây dựng test suite `tests/rbac-user-management.test.ts`:
  - Test logic phân quyền: Admin có quyền đổi role, khóa/mở khóa tài khoản.
  - Test chặn admin tự khóa chính mình hoặc tự hạ quyền của chính mình.
  - Test kiểm tra tài khoản `isBlocked = true` bị chặn đăng nhập và giao dịch.
- **Q3**: Chạy xác minh toàn bộ test suite (`npm test`) và build (`npm run build`), đảm bảo 100% test pass không có lỗi biên dịch.
