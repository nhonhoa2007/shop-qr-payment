# THIẾT KẾ HỆ THỐNG: QUÊN MẬT KHẨU & QUẢN LÝ PHÂN QUYỀN ADMIN (RBAC)

Dự án: **Shop QR Payment**  
Tác giả: **Tech Lead / System Architect**  
Thời điểm: Tháng 09/2026  
Mục tiêu: Đặc tả chi tiết 2 phân hệ còn thiếu:
1. Phân hệ Quên & Đặt lại mật khẩu an toàn (OTP qua Email).
2. Phân hệ Quản trị Phân quyền & Điều hành Tài khoản (Role-Based Access Control - RBAC).

---

## I. KIẾN TRÚC TỔNG THỂ & DATA MODEL

### 1.1. Cập nhật Model User & Role
- **Enums**:
  ```prisma
  enum Role {
    CUSTOMER      // Khách mua hàng thông thường
    STAFF         // Nhân viên vận hành (đơn hàng, kho hàng, vận chuyển GHN, chat hỗ trợ, kiểm duyệt đánh giá)
    ADMIN         // Quản trị viên tối cao (toàn quyền hệ thống, sửa giá, coupon, đối soát tài chính, quản lý phân quyền & tài khoản)
  }

  enum OtpType {
    REGISTRATION    // Xác thực tài khoản khi đăng ký
    PASSWORD_RESET  // Xác thực đặt lại mật khẩu khi quên
  }
  ```
- **Fields bổ sung trong User**:
  - `isBlocked Boolean @default(false)`: Chặn truy cập tức thời khi tài khoản có dấu hiệu gian lận/spam.
  - `role Role @default(CUSTOMER)`: Phân định quyền hạn rõ ràng.

### 1.2. Luồng bảo mật: Quên mật khẩu (Password Reset Flow)
```
[Khách hàng]                     [Next.js API]                    [Database / Resend]
     │                                │                                    │
     │ 1. Nhập email yêu cầu quên MK  │                                    │
     ├───────────────────────────────►│ 2. POST /api/auth/forgot-password  │
     │                                │    - Validate email                │
     │                                │    - Check user tồn tại & blocked  │
     │                                │    - Sinh OTP, hash bcrypt         │
     │                                │    - Lưu OtpCode (PASSWORD_RESET)  │
     │                                │    - Gửi email qua Resend ────────►│
     │                                │◄───────────────────────────────────┤
     │◄───────────────────────────────┤ (Trả về 200: Đã gửi mã xác nhận)   │
     │                                │                                    │
     │ 3. Nhập OTP + MK mới           │                                    │
     ├───────────────────────────────►│ 4. POST /api/auth/reset-password   │
     │                                │    - Validate password length      │
     │                                │    - Verify OtpCode & attempts     │
     │                                │    - Hash new password (bcrypt)    │
     │                                │    - Update User.passwordHash      │
     │                                │    - Mark OtpCode used=true        │
     │◄───────────────────────────────┤ (200: Đổi mật khẩu thành công)     │
     │                                │                                    │
     │ 5. Chuyển hướng sang /login    │                                    │
```

### 1.3. Luồng Quản trị Phân quyền (RBAC Matrix)

| Chức năng & Phân hệ | CUSTOMER | STAFF | ADMIN |
| :--- | :---: | :---: | :---: |
| Mua hàng, Giỏ hàng, VietQR, Ví | ✅ | ✅ | ✅ |
| Xem lịch sử đơn, Chat hỗ trợ | ✅ | ✅ | ✅ |
| Quản lý Đơn hàng (`/admin/orders`) | ❌ | ✅ (Xử lý đơn) | ✅ (Toàn quyền) |
| Vận đơn GHN (`/admin/shipments`) | ❌ | ✅ (Theo dõi) | ✅ (Tạo/Hủy đơn) |
| Chat với khách (`/admin/chat`) | ❌ | ✅ | ✅ |
| Kiểm duyệt Review (`/admin/reviews`) | ❌ | ✅ | ✅ |
| Quản lý Sản phẩm (`/admin/products`) | ❌ | ❌ | ✅ |
| Quản lý Coupon (`/admin/coupons`) | ❌ | ❌ | ✅ |
| Đối soát Giao dịch (`/admin/transactions`) | ❌ | ❌ | ✅ |
| Báo cáo Doanh thu (`/admin/analytics`)| ❌ | ❌ | ✅ |
| **Quản lý Tài khoản & Phân quyền (`/admin/customers` / `/admin/users`)** | ❌ | ❌ | ✅ (Đổi Role, Khóa, Mở khóa, Xác thực) |

---

## II. ĐẶC TẢ API CONTRACTS

### 2.1. Auth Endpoints
1. `POST /api/auth/forgot-password`
   - **Body**: `{ "email": "user@example.com" }`
   - **Response 200**: `{ "success": true, "message": "Mã xác thực đã được gửi tới email" }`
   - **Response 400/404**: `{ "error": "Email không tồn tại hoặc chưa kích hoạt" }`
   - **Response 429**: `{ "error": "Vui lòng đợi 60 giây trước khi gửi lại" }`

2. `POST /api/auth/reset-password`
   - **Body**: `{ "email": "user@example.com", "otp": "123456", "newPassword": "secretpassword" }`
   - **Response 200**: `{ "success": true, "message": "Đặt lại mật khẩu thành công" }`
   - **Response 400**: `{ "error": "Mã xác thực không hợp lệ hoặc đã hết hạn" }`

### 2.2. Admin User & Permission Endpoints
1. `GET /api/admin/customers` (hoặc mở rộng `GET /api/admin/users`)
   - **Query**: `?role=ALL|CUSTOMER|STAFF|ADMIN&status=ALL|ACTIVE|BLOCKED&search=...`
   - **Response 200**: `{ "users": [UserAccount] }`
   - **Guards**: Phải có session `ADMIN`.

2. `PATCH /api/admin/customers`
   - **Body**:
     ```json
     {
       "userId": "cuid...",
       "role": "CUSTOMER" | "STAFF" | "ADMIN",     // Optional
       "isBlocked": true | false,                   // Optional
       "isVerified": true | false                   // Optional
     }
     ```
   - **Business Rules**:
     - Admin không thể tự khóa chính mình (`userId === session.user.id`).
     - Admin không thể tự hạ quyền chính mình nếu là Admin duy nhất.
     - Cập nhật tức thời vào cơ sở dữ liệu.
   - **Response 200**: `{ "success": true, "user": UpdatedUser }`
   - **Guards**: Yêu cầu quyền `ADMIN`.

---

## III. BẢO VỆ ĐĂNG NHẬP & SESSION
- Trong `src/server/modules/auth/auth-options.ts`:
  - Khi user đăng nhập bằng credentials hoặc Google:
    - Nếu `user.isBlocked === true`: Từ chối đăng nhập với message `"Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ quản trị viên."`
  - Token JWT và Session được gán thêm:
    ```ts
    token.role = user.role;
    token.isBlocked = user.isBlocked;
    ```
