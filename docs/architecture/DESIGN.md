# Giao diện và token thiết kế

Tài liệu tóm tắt token đang khai báo trong [`src/app/globals.css`](../../src/app/globals.css). Đây là nền tảng dùng chung cho storefront và trang quản trị; component có thể dùng màu trạng thái/phân hệ phù hợp với nghiệp vụ.

## Màu

| Token Tailwind | Giá trị | Vai trò |
| --- | --- | --- |
| `canvas-mist` | `#f2f4f5` | Nền trang |
| `pure-white` | `#ffffff` | Bề mặt chính |
| `ink-black` | `#000000` | Nội dung chính |
| `faint-border` | `#ebebeb` | Viền nhẹ |
| `muted-gray` | `#787574` | Nội dung phụ |
| `cool-stone` | `#cccccc` | Trạng thái trung tính/disabled |
| `warm-fog` | `#acb0aa` | Sắc độ nền phụ |
| `shop-violet` | `#5433eb` | Màu thương hiệu và hành động chính |
| `shop-violet-deep` | `#4428d4` | Sắc độ tím đậm |
| `violet-ink` | `#3327a8` | Sắc độ tím tối |
| `violet-wash` | `#c0b5f3` | Nền tím nhạt |
| `slate-ink` | `#332f2d` | Bề mặt/chữ tối phụ |
| `ash-veil` | `#665a54` | Sắc độ xám ấm |

Tailwind có thêm màu semantic như `red-*`, `emerald-*` và `amber-*` để hiển thị lỗi, thành công hoặc cảnh báo; không thay các màu trạng thái đó bằng màu thương hiệu.

## Chữ và bố cục

- `body` dùng Inter qua `--font-inter`, sau đó fallback về system UI (`src/app/globals.css`). Không có font GT Standard/Shopify Sans trong source hiện tại.
- Các utility `tracking-tight-display`, `tracking-tight-body` và `tracking-tight-meta` hỗ trợ tracking chặt cho tiêu đề, nội dung và nhãn.
- Nền ứng dụng là `canvas-mist`; thẻ thường dùng bề mặt trắng, bo góc lớn và bóng mềm. Radius/gap cụ thể thuộc component, không phải quy chuẩn bắt buộc cho mọi phần tử.
- Có focus ring tím, skip link cho bàn phím và `prefers-reduced-motion` để hạn chế chuyển động.

## Shadow tokens

| Token | Cách dùng |
| --- | --- |
| `shadow-soft-sm` | Nâng nhẹ cho control |
| `shadow-card` | Thẻ nội dung |
| `shadow-card-hover` | Hover thẻ |
| `shadow-lg-soft` | Bề mặt nổi |
| `shadow-violet` | Nhấn hành động thương hiệu |

Khi cập nhật giao diện, ưu tiên dùng token hiện có và kiểm tra khả năng đọc, focus bàn phím, tương phản trạng thái, kích thước màn hình nhỏ và tùy chọn giảm chuyển động. Tham khảo các component đang chạy trước khi dùng các mẫu minh họa trong tài liệu thiết kế cũ.
