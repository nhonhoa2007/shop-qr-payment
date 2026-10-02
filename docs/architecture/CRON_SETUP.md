# Hướng Dẫn Cấu Hình Cron Job Tự Động (Hoàn Toàn Miễn Phí)

## Bối cảnh và vấn đề
- **Vercel Hobby (Free Tier)** giới hạn Cron Job chỉ được chạy **tối đa 1 lần / ngày** (ví dụ: `0 0 * * *`).
- Nếu cấu hình tần suất dày hơn (như `*/5 * * * *`) trong `vercel.json`, Vercel sẽ cảnh báo hoặc từ chối deploy.
- Đối với hệ thống Shop QR Payment, đơn hàng chưa thanh toán cần được tự động hết hạn (sau 15 phút) và hoàn lại số lượng tồn kho (stock) liên tục, lý tưởng nhất là quét định kỳ mỗi **5 phút/lần**.

Endpoint thực hiện nhiệm vụ này:
```http
GET /api/cron/expire-orders
POST /api/cron/expire-orders
```

---

## Cơ chế Xác thực Endpoint (`CRON_SECRET`)
Endpoint hỗ trợ 2 phương thức xác thực linh hoạt:
1. **Authorization Header**:
   ```http
   Authorization: Bearer <CRON_SECRET>
   ```
2. **Query Parameter** (thuận tiện cho các webhook/cron service bên ngoài):
   ```http
   GET https://your-domain.vercel.app/api/cron/expire-orders?secret=<CRON_SECRET>
   ```

*Lưu ý: Thiết lập biến môi trường `CRON_SECRET` trên Vercel Dashboard (Settings -> Environment Variables) và trên các dịch vụ trigger.*

---

## 3 Phương Án Thay Thế Vercel Cron Miễn Phí 100%

### Phương án 1: Dùng cron-job.org (Khuyên dùng - Đơn giản & Ổn định nhất)
[cron-job.org](https://cron-job.org) là dịch vụ chạy cron miễn phí nổi tiếng, hỗ trợ ping URL mỗi phút/5 phút và gửi email cảnh báo khi thất bại.

1. Đăng ký tài khoản miễn phí tại [https://cron-job.org](https://cron-job.org).
2. Vào mục **Cronjobs** -> Chọn **Create Cronjob**.
3. Điền các thông tin sau:
   - **Title**: `Expire Shop Orders`
   - **URL**: `https://your-domain.vercel.app/api/cron/expire-orders?secret=YOUR_CRON_SECRET`
   - **Schedule**: Chọn **User-defined** -> Chọn **Every 5 minutes** (hoặc `*/5 * * * *`).
   - **Request Method**: `GET` hoặc `POST`.
   - **Request Headers** (tùy chọn nếu không truyền qua URL):
     - `Authorization: Bearer YOUR_CRON_SECRET`
4. Tại tab **Notifications**: Bật thông báo qua email khi job bị lỗi liên tiếp.
5. Nhấn **Save**. Job sẽ tự động kích hoạt đều đặn mỗi 5 phút.

---

### Phương án 2: Dùng GitHub Actions Workflow (Có sẵn trong Repository)
Repository đã được tích hợp sẵn workflow `.github/workflows/expire-orders-cron.yml`.

1. Vào repository trên GitHub -> Chọn tab **Settings** -> **Secrets and variables** -> **Actions**.
2. Thêm 2 Repository Secrets:
   - `APP_URL`: URL triển khai thực tế của bạn (ví dụ: `https://shop-qr.vercel.app`).
   - `CRON_SECRET`: Mã bí mật bạn đã thiết lập trong biến môi trường Vercel.
3. Workflow sẽ tự động kích hoạt theo lịch `*/5 * * * *`.
4. Bạn cũng có thể kích hoạt thủ công (Manual Run) trong tab **Actions** -> **Expire Unpaid Orders Cron** -> **Run workflow** để kiểm tra ngay lập tức.

*Lưu ý: GitHub Actions scheduler đôi khi có thể bị trễ vài phút tùy tải hệ thống của GitHub, nhưng hoàn toàn miễn phí.*

---

### Phương án 3: Dùng Upstash QStash (Serverless Message Queue & Cron)
[Upstash QStash](https://upstash.com/docs/qstash/features/schedules) cung cấp 500 tin nhắn/ngày miễn phí, cực kỳ phù hợp cho serverless.

1. Tạo tài khoản tại [console.upstash.com](https://console.upstash.com).
2. Vào **QStash** -> **Schedules** -> **Create Schedule**.
3. Cấu hình:
   - **Destination**: `https://your-domain.vercel.app/api/cron/expire-orders`
   - **Cron Expression**: `*/5 * * * *`
   - **Headers**: Thêm header:
     - Header: `Authorization`
     - Value: `Bearer YOUR_CRON_SECRET`
4. Lưu schedule. QStash sẽ gửi request định kỳ tới Vercel endpoint.

---

## Cấu hình Vercel (`vercel.json`)
File `vercel.json` trong dự án đã được điều chỉnh về `0 0 * * *` (chạy 1 lần/ngày lúc nửa đêm) để đóng vai trò fallback và hoàn toàn tuân thủ giới hạn của Vercel Free tier:
```json
{
  "crons": [
    {
      "path": "/api/cron/expire-orders",
      "schedule": "0 0 * * *"
    }
  ]
}
```
