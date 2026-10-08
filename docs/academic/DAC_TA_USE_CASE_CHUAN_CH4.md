# BẢN ĐẶC TẢ USE CASE CHUẨN MÔ HÌNH HÓA YÊU CẦU (REQUIREMENTS MODELING)
## HỆ THỐNG THƯƠNG MẠI ĐIỆN TỬ SHOP-QR-PAYMENT (SHOP.)

> **Tài liệu tham chiếu chuẩn:** Giáo trình & Bài giảng *System Analysis and Design - Chapter 4: Requirements Modeling (Khoa Khoa học Máy tính)*.  
> **Cấu trúc đặc tả:** Tuân thủ mẫu đặc tả chuẩn UML tại **Slide 48 – 53** (Bao gồm: *Use-case name, Actors, Objective, References, Pre-conditions, Post-conditions, Description, và Kịch bản Scenarios chia tách rạch ròi thành Main interactions & Exceptional interactions theo bảng 2 cột Actions of actor / Actions of system*).

---

## MỤC LỤC BẢN ĐẶC TẢ

### PHẦN I: PHÂN HỆ MUA SẮM & KHÁCH HÀNG (STOREFRONT)
1. [UC01: Đăng ký tài khoản mới](#uc01-đăng-ký-tài-khoản-mới)
2. [UC02: Khôi phục mật khẩu](#uc02-khôi-phục-mật-khẩu)
3. [UC03: Đăng nhập & Đăng xuất hệ thống](#uc03-đăng-nhập--đăng-xuất-hệ-thống)
4. [UC04: Tìm kiếm & xem sản phẩm](#uc04-tìm-kiếm--xem-sản-phẩm)
5. [UC05: Xem chi tiết & chọn biến thể SKU](#uc05-xem-chi-tiết--chọn-biến-thể-sku)
6. [UC06: Quản lý giỏ hàng](#uc06-quản-lý-giỏ-hàng)
7. [UC07: Đặt hàng sản phẩm (Checkout Hub)](#uc07-đặt-hàng-sản-phẩm-checkout-hub)
8. [UC08: Thanh toán đơn bằng Ví Shop](#uc08-thanh-toán-đơn-bằng-ví-shop)
9. [UC09: Nạp tiền vào Ví qua VietQR](#uc09-nạp-tiền-vào-ví-qua-vietqr)
10. [UC10: Hủy đơn hàng](#uc10-hủy-đơn-hàng)
11. [UC11: Quản lý danh sách Wishlist](#uc11-quản-lý-danh-sách-wishlist)
12. [UC12: Đánh giá & nhận xét sản phẩm](#uc12-đánh-giá--nhận-xét-sản-phẩm)
13. [UC13: Chat tư vấn trực tuyến Realtime](#uc13-chat-tư-vấn-trực-tuyến-realtime)

### PHẦN II: PHÂN HỆ QUẢN TRỊ SAAS BENTO & TỰ ĐỘNG HÓA (ADMIN PORTAL & GATEWAYS)
14. [UC14: Quản lý đơn hàng & duyệt FSM](#uc14-quản-lý-đơn-hàng--duyệt-fsm)
15. [UC15: Quản lý sản phẩm & kho hàng](#uc15-quản-lý-sản-phẩm--kho-hàng)
16. [UC16: Trực chat tư vấn khách hàng](#uc16-trực-chat-tư-vấn-khách-hàng)
17. [UC17: Kiểm duyệt đánh giá Review](#uc17-kiểm-duyệt-đánh-giá-review)
18. [UC18: Giám sát doanh thu Dashboard Bento Grid](#uc18-giám-sát-doanh-thu-dashboard-bento-grid)
19. [UC19: Đối soát thủ công giao dịch VietQR](#uc19-đối-soát-thủ-công-giao-dịch-vietqr)
20. [UC20: Phân quyền RBAC & quản lý người dùng](#uc20-phân-quyền-rbac--quản-lý-người-dùng)
21. [UC21: Xử lý Webhook số dư VietQR](#uc21-xử-lý-webhook-số-dư-vietqr)
22. [UC22: Đồng bộ bưu kiện qua Webhook GHN](#uc22-đồng-bộ-bưu-kiện-qua-webhook-ghn)
23. [UC23: Hủy đơn & nhả kho quá hạn tự động](#uc23-hủy-đơn--nhả-kho-quá-hạn-tự-động)

### PHẦN III: CÁC CA SỬ DỤNG PHỤ TRỢ (INCLUDED & EXTENDED USE CASES)
- [UI01: Xác thực mã OTP qua Email](#ui01-xác-thực-mã-otp-qua-email)
- [UI02: Kiểm tra & giữ tồn kho nguyên tử](#ui02-kiểm-tra--giữ-tồn-kho-nguyên-tử)
- [UI03: Tính phí vận chuyển tự động](#ui03-tính-phí-vận-chuyển-tự-động)
- [UI04: Tạo mã VietQR thanh toán động](#ui04-tạo-mã-vietqr-thanh-toán-động)
- [UI05: Hoàn tiền 100% vào Ví Shop](#ui05-hoàn-tiền-100-vào-ví-shop)
- [UI06: Tạo vận đơn GHN tự động](#ui06-tạo-vận-đơn-ghn-tự-động)
- [UI07: Khớp tiền tự động (Idempotent Worker)](#ui07-khớp-tiền-tự-động-idempotent-worker)
- [UE01: Áp dụng mã giảm giá Coupon](#ue01-áp-dụng-mã-giảm-giá-coupon)
- [UE02: Tự động điền địa chỉ qua GPS](#ue02-tự-động-điền-địa-chỉ-qua-gps)

---

# PHẦN I: PHÂN HỆ MUA SẮM & KHÁCH HÀNG (STOREFRONT)

### UC01: Đăng ký tài khoản mới

- **Use-case**: Đăng ký tài khoản mới (`Register Account`)
- **Actors**: Khách hàng (`Customer`)
- **Objective**: Tạo hồ sơ tài khoản khách hàng mới trên hệ thống để tham gia mua sắm và lưu lịch sử giao dịch.
- **References**: R1.1, R1.2 (Quản lý định danh người dùng)
- **Pre-conditions**: Khách hàng đang ở trạng thái khách vãng lai (chưa đăng nhập).
- **Post-conditions**: Bản ghi người dùng được khởi tạo với trạng thái chưa kích hoạt (`isVerified = false`), mã OTP xác thực được phát hành và gửi đến email của khách hàng.
- **Description**: Khách hàng cung cấp thông tin cá nhân (họ tên, email, số điện thoại, mật khẩu). Hệ thống kiểm tra hợp lệ, lưu trữ mật khẩu mã hóa BCrypt, phát hành mã OTP xác thực và gọi chức năng bao hàm UI01 để xác minh quyền sở hữu hòm thư.

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Khách hàng mở trang Đăng ký tài khoản. | |
| 2. Nhập họ và tên, email, số điện thoại và mật khẩu. | |
| 3. Nhấn nút "Đăng ký tài khoản". | 4. Kiểm tra hợp lệ dữ liệu đầu vào (email đúng cú pháp RFC 5322, mật khẩu $\ge$ 8 ký tự). |
| | 5. Kiểm tra email chưa tồn tại trong cơ sở dữ liệu. |
| | 6. Mã hóa mật khẩu an toàn bằng giải thuật BCrypt (Salt rounds = 12). |
| | 7. Tạo bản ghi `User` mới với cờ `isVerified: false`. |
| | 8. Thực thi ca sử dụng bao hàm `UI01: Xác thực mã OTP qua Email`. |
| | 9. Chuyển hướng khách hàng sang màn hình nhập mã OTP kích hoạt tài khoản. |

##### 2. Exceptional interactions (Luồng ngoại lệ)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 3a. Dữ liệu nhập vào để trống hoặc sai định dạng. | 3b. Hệ thống hiển thị thông báo lỗi tại các trường tương ứng (ví dụ: "Email không hợp lệ", "Mật khẩu tối thiểu 8 ký tự"). |
| 5a. Email đã tồn tại trên hệ thống. | 5b. Hệ thống từ chối đăng ký, thông báo "Địa chỉ email đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác". |
| 8a. Dịch vụ gửi email gặp sự cố mạng tạm thời. | 8b. Hệ thống ghi log cảnh báo, thông báo cho người dùng "Lỗi gửi email xác thực, vui lòng bấm nút Gửi lại OTP sau 60 giây". |

---

### UC02: Khôi phục mật khẩu

- **Use-case**: Khôi phục mật khẩu (`Reset Password`)
- **Actors**: Khách hàng (`Customer`), Nhân viên (`Staff`), Quản trị viên (`Admin`)
- **Objective**: Cho phép người dùng lấy lại quyền truy cập tài khoản khi bị quên mật khẩu thông qua mã xác thực một lần OTP.
- **References**: R1.3 (An toàn định danh & Quản lý phiên)
- **Pre-conditions**: Tài khoản của người dùng đã tồn tại trong hệ thống.
- **Post-conditions**: Mật khẩu mới được cập nhật vào CSDL, phiên làm việc cũ bị vô hiệu hóa.
- **Description**: Người dùng yêu cầu đặt lại mật khẩu bằng cách cung cấp email. Hệ thống kiểm tra tài khoản, gửi mã OTP khôi phục qua email (`UI01`). Sau khi xác thực thành công, hệ thống cập nhật mật khẩu mới.

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Người dùng bấm liên kết "Quên mật khẩu" tại trang đăng nhập. | |
| 2. Nhập email đã đăng ký tài khoản và nhấn "Gửi mã xác nhận". | 3. Kiểm tra email có tồn tại và tài khoản không bị khóa. |
| | 4. Gọi ca sử dụng bao hàm `UI01: Xác thực mã OTP qua Email` (loại `PASSWORD_RESET`). |
| | 5. Hiển thị màn hình nhập mã OTP và mật khẩu mới. |
| 6. Nhập mã OTP 6 số và mật khẩu mới (xác nhận lại mật khẩu). | |
| 7. Nhấn nút "Đặt lại mật khẩu". | 8. Xác thực mã OTP hợp lệ và chưa quá hạn. |
| | 9. Băm mật khẩu mới bằng BCrypt và cập nhật trường `passwordHash`. |
| | 10. Đánh dấu mã OTP đã sử dụng, thông báo đổi mật khẩu thành công và chuyển hướng về trang Đăng nhập. |

##### 2. Exceptional interactions (Luồng ngoại lệ)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 3a. Email không tồn tại trong hệ thống. | 3b. Hệ thống thông báo lỗi "Không tìm thấy tài khoản với email này". |
| 3c. Tài khoản đang bị quản trị viên khóa (`isBlocked: true`). | 3d. Hệ thống từ chối thực hiện, hiển thị "Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ ban quản trị". |
| 8a. Mã OTP nhập sai hoặc đã quá hạn 5 phút. | 8b. Hệ thống tăng số lần thử sai, thông báo mã OTP không chính xác. Nếu sai quá 5 lần, hủy hiệu lực mã OTP. |

---

### UC03: Đăng nhập & Đăng xuất hệ thống

- **Use-case**: Đăng nhập & Đăng xuất (`Authentication & Session Management`)
- **Actors**: Khách hàng (`Customer`), Nhân viên (`Staff`), Quản trị viên (`Admin`)
- **Objective**: Xác thực định danh người dùng và cấp phát phiên làm việc (JWT session); hoặc chấm dứt phiên làm việc an toàn.
- **References**: R1.4, R1.5 (Kiểm soát truy cập & Phân quyền)
- **Pre-conditions**: Người dùng đã có tài khoản kích hoạt trên hệ thống.
- **Post-conditions**: Cấp phát `HttpOnly Secure Cookie` chứa JWT token mang thông tin vai trò (`role`) và quyền hạn (`permissions`); hoặc xóa sạch cookie khi đăng xuất.
- **Description**: Người dùng gửi cặp định danh email và mật khẩu. Hệ thống xác thực bằng so sánh băm BCrypt, tạo token và chuyển hướng tới không gian làm việc phù hợp (`/` cho Customer, `/admin` cho Staff/Admin).

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Người dùng mở trang Đăng nhập, nhập email và mật khẩu. | |
| 2. Nhấn nút "Đăng nhập". | 3. Kiểm tra định dạng dữ liệu đầu vào. |
| | 4. Truy vấn tìm tài khoản người dùng theo email. |
| | 5. So khớp mật khẩu với `passwordHash` trong CSDL bằng BCrypt compare. |
| | 6. Kiểm tra tài khoản đã kích hoạt (`isVerified: true`) và không bị khóa (`isBlocked: false`). |
| | 7. Ký số JSON Web Token (JWT) có thời hạn 7 ngày, đặt vào `HttpOnly Cookie`. |
| | 8. Điều hướng người dùng về trang đích theo vai trò tương ứng. |
| 9. (Khi đăng xuất) Người dùng nhấn nút "Đăng xuất" trên thanh điều hướng. | 10. Hệ thống xóa JWT cookie, hủy session và đưa người dùng về trang chủ. |

##### 2. Exceptional interactions (Luồng ngoại lệ)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 4a. Email không tồn tại hoặc 5a. Mật khẩu không trùng khớp. | 5b. Hệ thống phản hồi mã lỗi 401: "Email hoặc mật khẩu không chính xác". |
| 6a. Tài khoản chưa xác thực email (`isVerified: false`). | 6b. Hệ thống yêu cầu xác thực OTP trước khi cho phép đăng nhập. |
| 6c. Tài khoản bị quản trị viên khóa (`isBlocked: true`). | 6d. Trả về mã lỗi 403 Forbidden: "Tài khoản của bạn đã bị khóa do vi phạm quy chế". |

---

### UC04: Tìm kiếm & xem sản phẩm

- **Use-case**: Tìm kiếm & xem sản phẩm (`Browse & Search Products`)
- **Actors**: Khách hàng (`Customer`)
- **Objective**: Khám phá danh mục, tìm kiếm và lọc sản phẩm theo nhu cầu mua sắm.
- **References**: R2.1 (Quản lý danh mục & Catalog sản phẩm)
- **Pre-conditions**: Cơ sở dữ liệu có sản phẩm đang ở trạng thái hiển thị (`isActive: true`).
- **Post-conditions**: Danh sách sản phẩm phù hợp được kết xuất có phân trang trên giao diện.
- **Description**: Khách hàng nhập từ khóa tìm kiếm, chọn bộ lọc danh mục, mức giá hoặc thứ tự sắp xếp. Hệ thống thực hiện truy vấn tối ưu và trả về danh sách sản phẩm.

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Khách hàng truy cập trang chủ hoặc trang danh mục sản phẩm. | 2. Hệ thống tải danh mục và hiển thị lưới sản phẩm nổi bật có phân trang. |
| 3. Nhập từ khóa tìm kiếm vào ô tìm kiếm (hoặc chọn bộ lọc giá/danh mục). | |
| 4. Nhấn Enter hoặc nút "Tìm kiếm". | 5. Hệ thống truy vấn CSDL theo điều kiện tìm kiếm, tính toán tổng số trang. |
| | 6. Hiển thị danh sách sản phẩm tương ứng kèm hình ảnh, tên, mức giá và số sao đánh giá. |

##### 2. Exceptional interactions (Luồng ngoại lệ)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 5a. Không tìm thấy sản phẩm nào khớp với từ khóa tìm kiếm. | 5b. Hệ thống hiển thị thông báo "Không tìm thấy sản phẩm phù hợp" kèm gợi ý từ khóa phổ biến. |

---

### UC05: Xem chi tiết & chọn biến thể SKU

- **Use-case**: Xem chi tiết & chọn biến thể SKU (`View Product Details & Select SKU`)
- **Actors**: Khách hàng (`Customer`)
- **Objective**: Xem thông số kỹ thuật chi tiết của sản phẩm và lựa chọn biến thể màu sắc, kích thước (SKU) phù hợp trước khi đưa vào giỏ hàng.
- **References**: R2.2 (Mô hình ma trận biến thể Matrix Variant)
- **Pre-conditions**: Khách hàng nhấp chọn một sản phẩm từ danh sách sản phẩm.
- **Post-conditions**: Thông tin giá, tồn kho tức thời và hình ảnh biến thể được cập nhật theo lựa chọn SKU của khách hàng.
- **Description**: Khách hàng xem trang chi tiết sản phẩm. Khi lựa chọn các thuộc tính (ví dụ: Màu đen, Size XL), hệ thống tự động dò ma trận SKU, hiển thị giá bán và trạng thái còn hàng tương ứng.

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Khách hàng bấm chọn một sản phẩm để xem chi tiết. | 2. Hệ thống tải toàn bộ thông tin sản phẩm: mô tả, bộ sưu tập ảnh, danh sách tùy chọn thuộc tính và đánh giá. |
| 3. Chọn tùy chọn màu sắc và kích cỡ mong muốn. | 4. Hệ thống tra cứu mã SKU tương ứng trong bảng `ProductVariant`. |
| | 5. Cập nhật giá bán, số lượng tồn kho khả dụng và thư viện ảnh theo biến thể đã chọn. |
| 6. Nhập số lượng dự định mua và chọn "Thêm vào giỏ hàng" hoặc "Mua ngay". | 7. Hệ thống cập nhật sản phẩm vào giỏ hàng (`UC06`) hoặc chuyển thẳng đến màn hình thanh toán (`UC07`). |

##### 2. Exceptional interactions (Luồng ngoại lệ)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 4a. Biến thể được chọn đã hết hàng trong kho (`stock = 0`). | 4b. Hệ thống làm mờ nút "Thêm vào giỏ hàng", hiển thị nhãn "Hết hàng" và gợi ý chọn biến thể khác. |

---

### UC06: Quản lý giỏ hàng

- **Use-case**: Quản lý giỏ hàng (`Manage Shopping Cart`)
- **Actors**: Khách hàng (`Customer`)
- **Objective**: Quản lý danh sách các mặt hàng dự định mua: điều chỉnh số lượng, xóa sản phẩm và xem tổng giá trị tạm tính.
- **References**: R3.1 (Giỏ hàng & Quản lý phiên mua sắm)
- **Pre-conditions**: Khách hàng đã thêm ít nhất 1 sản phẩm vào giỏ hàng.
- **Post-conditions**: Dữ liệu giỏ hàng được đồng bộ và lưu trữ nhất quán (trong CSDL với khách đã đăng nhập hoặc Cookie/LocalStorage với khách vãng lai).
- **Description**: Khách hàng mở giỏ hàng, thực hiện tăng/giảm số lượng từng mặt hàng hoặc xóa mặt hàng không có nhu cầu. Hệ thống tính toán lại tổng tiền hàng tức thời.

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Khách hàng mở biểu tượng Giỏ hàng trên thanh công cụ. | 2. Hệ thống hiển thị danh sách các mục hàng: ảnh, tên, biến thể SKU, đơn giá, số lượng và tổng tiền tạm tính. |
| 3. Khách hàng thay đổi số lượng (bấm nút +/- hoặc nhập số lượng). | 4. Hệ thống kiểm tra số lượng yêu cầu so với tồn kho khả dụng. |
| | 5. Tính toán lại tổng số tiền hàng và hiển thị số tiền mới. |
| 6. Khách hàng bấm nút "Tiến hành Đặt hàng". | 7. Hệ thống chuyển hướng khách hàng sang màn hình đặt hàng (`UC07`). |

##### 2. Exceptional interactions (Luồng ngoại lệ)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 4a. Số lượng khách hàng nhập vượt quá số lượng tồn kho khả dụng. | 4b. Hệ thống tự động giới hạn số lượng bằng mức tồn kho tối đa và hiển thị cảnh báo "Kho chỉ còn [N] sản phẩm". |
| 3a. Khách hàng nhấn nút "Xóa" một mục hàng. | 3b. Hệ thống xóa mặt hàng khỏi giỏ và cập nhật lại tổng tiền. |

---

### UC07: Đặt hàng sản phẩm (Checkout Hub)

- **Use-case**: Đặt hàng sản phẩm (`Place Order / Checkout`)
- **Actors**: Khách hàng (`Customer`), Ngân hàng VietQR (`Bank Gateway`), GHN Logistics (`Logistics Partner`)
- **Objective**: Tạo đơn hàng chính thức trên hệ thống, khóa giữ tồn kho tạm thời, tính cước vận chuyển và cung cấp phương thức thanh toán chuyển khoản VietQR động.
- **References**: R3.2, R3.3, R4.1 (Quy trình Checkout & Giữ kho nguyên tử)
- **Pre-conditions**: Giỏ hàng có ít nhất một sản phẩm hợp lệ, khách hàng đã cung cấp thông tin người nhận (tên, số điện thoại, địa chỉ nhận hàng).
- **Post-conditions**: Đơn hàng được tạo trong CSDL ở trạng thái `PENDING`, tồn kho bị khóa trong 15 phút, mã VietQR động được tạo sẵn sàng quét thanh toán.
- **Description**: Đây là ca sử dụng trung tâm của phân hệ Storefront. Quá trình đặt hàng bắt buộc thực hiện các ca sử dụng bao hàm: kiểm tra giữ tồn kho (`UI02`), tính phí vận chuyển GHN (`UI03`), tạo mã VietQR (`UI04`). Đồng thời có thể được mở rộng tùy chọn bởi các ca sử dụng: áp dụng mã giảm giá (`UE01`) và tự động điền địa chỉ GPS (`UE02`).

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Khách hàng nhấn nút "Thanh toán" từ giỏ hàng. | 2. Hệ thống tải giao diện Đặt hàng, hiển thị danh sách sản phẩm và thông tin người nhận. |
| 3. Nhập địa chỉ giao hàng (Tỉnh/Thành, Quận/Huyện, Phường/Xã, địa chỉ chi tiết). *(Có thể kích hoạt mở rộng `UE02: Tự động điền địa chỉ qua GPS`)*. | 4. Gọi ca sử dụng bao hàm `UI03: Tính phí vận chuyển tự động` thông qua API của GHN Logistics. |
| 5. (Tùy chọn) Nhập mã giảm giá voucher. | 6. (Nếu có) Kích hoạt mở rộng `UE01: Áp dụng mã giảm giá Coupon` để chiết khấu tổng tiền. |
| 7. Chọn phương thức thanh toán: "Chuyển khoản VietQR qua ngân hàng". | |
| 8. Kiểm tra lại thông tin và bấm nút "Xác nhận Đặt hàng". | 9. Thực thi ca sử dụng bao hàm `UI02: Kiểm tra & giữ tồn kho nguyên tử` trong Prisma Database Transaction. |
| | 10. Tạo bản ghi `Order` với trạng thái `PENDING`, hạn thanh toán 15 phút. |
| | 11. Thực thi ca sử dụng bao hàm `UI04: Tạo mã VietQR thanh toán động`. |
| | 12. Hiển thị màn hình chi tiết đơn hàng kèm mã VietQR chứa nội dung chuyển khoản độc nhất. |
| 13. Khách hàng mở ứng dụng ngân hàng, quét mã QR và xác nhận chuyển tiền. | 14. Hệ thống lắng nghe biến động số dư qua Webhook (`UC21`) để tự động khớp tiền và chuyển trạng thái đơn hàng sang `PAID`. |

##### 2. Exceptional interactions (Luồng ngoại lệ)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 9a. Tồn kho của một mặt hàng không đủ tại thời điểm đặt lệnh (Race condition). | 9b. Hệ thống rollback transaction, thông báo "Sản phẩm [Tên SP] vừa hết hàng, vui lòng cập nhật lại giỏ hàng". |
| 4a. API tính phí GHN gặp sự cố không phản hồi. | 4b. Hệ thống áp dụng bảng cước vận chuyển mặc định dự phòng theo vùng miền (30.000đ nội tỉnh, 45.000đ liên tỉnh). |
| 14a. Khách hàng không chuyển khoản trong vòng 15 phút. | 14b. Hệ thống tiến trình quét tự động Cron (`UC23`) sẽ tự động hủy đơn hàng và hoàn trả lại số lượng tồn kho khả dụng. |

---

### UC08: Thanh toán đơn bằng Ví Shop

- **Use-case**: Thanh toán đơn bằng Ví Shop (`Pay Order with Internal Wallet`)
- **Actors**: Khách hàng (`Customer`)
- **Objective**: Thanh toán đơn hàng tức thì trong 1 chạm bằng số dư ví điện tử nội bộ tích hợp.
- **References**: R4.3 (Hệ thống ví nội bộ & Giao dịch CAS nguyên tử)
- **Pre-conditions**: Khách hàng đã đăng nhập, tài khoản đã có ví nội bộ với số dư khả dụng $\ge$ tổng giá trị đơn hàng.
- **Post-conditions**: Số dư ví bị trừ chính xác số tiền đơn hàng qua giải thuật CAS (Compare-And-Swap), trạng thái đơn hàng lập tức chuyển thành `PAID`.
- **Description**: Khách hàng lựa chọn phương thức "Thanh toán bằng Ví Shop" tại màn hình đặt hàng. Hệ thống kiểm tra số dư và thực hiện giao dịch trừ tiền nguyên tử trong CSDL.

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Tại bước chọn phương thức thanh toán của `UC07`, khách hàng chọn "Ví Shop". | 2. Hệ thống kiểm tra số dư khả dụng của ví khách hàng và hiển thị trên màn hình. |
| 3. Khách hàng nhấn nút "Xác nhận Thanh toán". | 4. Kiểm tra số dư ví $\ge$ Tổng tiền đơn hàng. |
| | 5. Bắt đầu Database Transaction: Trừ tiền ví bằng truy vấn CAS (`WHERE balance >= amount`), ghi lịch sử `WalletTransaction`, cập nhật đơn hàng thành `PAID`. |
| | 6. Khóa giữ tồn kho chuyển thành trừ tồn kho chính thức. |
| | 7. Thông báo "Thanh toán bằng Ví Shop thành công!" và chuyển sang trạng thái chờ nhân viên đóng gói. |

##### 2. Exceptional interactions (Luồng ngoại lệ)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 4a. Số dư ví nhỏ hơn tổng số tiền cần thanh toán. | 4b. Hệ thống thông báo "Số dư ví không đủ (Số dư hiện tại: [X]đ, cần thanh toán: [Y]đ)", hiển thị nút "Nạp tiền vào ví" (`UC09`). |
| 5a. Xảy ra xung đột giao dịch đồng thời (Optimistic lock conflict). | 5b. Hệ thống tự động retry tối đa 3 lần. Nếu vẫn thất bại, rollback và yêu cầu người dùng thử lại. |

---

### UC09: Nạp tiền vào Ví qua VietQR

- **Use-case**: Nạp tiền vào Ví qua VietQR (`Top-up Wallet via VietQR`)
- **Actors**: Khách hàng (`Customer`), Ngân hàng VietQR (`NAPAS 247 / Casso`)
- **Objective**: Nạp thêm tiền vào số dư ví nội bộ bằng chuyển khoản ngân hàng tự động qua mã VietQR động.
- **References**: R4.2, R4.4 (Nạp tiền ví & Đối soát ngân hàng)
- **Pre-conditions**: Khách hàng đã đăng nhập tài khoản.
- **Post-conditions**: Yêu cầu nạp tiền được tạo; sau khi ngân hàng báo có tiền qua Webhook, số dư ví khách hàng được cộng 100% giá trị nạp.
- **Description**: Khách hàng nhập số tiền muốn nạp. Hệ thống tạo mã VietQR chứa nội dung chuyển khoản độc nhất (cú pháp: `TOPUP [Mã Giao Dịch]`). Khi khách hàng chuyển khoản, Webhook ngân hàng khớp tiền và ghi nhận số dư ví tức thời.

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Khách hàng truy cập trang Quản lý Ví, nhấn nút "Nạp tiền". | 2. Hệ thống hiển thị hộp thoại nạp tiền với các mốc gợi ý (50k, 100k, 200k, 500k...). |
| 3. Nhập số tiền muốn nạp (tối thiểu 10.000đ) và bấm "Tạo mã QR Nạp tiền". | 4. Tạo bản ghi giao dịch nạp tiền `WalletTransaction` với trạng thái `PENDING`. |
| | 5. Sinh mã VietQR động chứa số tài khoản thụ hưởng, số tiền nạp và cú pháp nội dung chuyển khoản chuẩn. |
| | 6. Hiển thị mã QR và hướng dẫn khách hàng quét mã. |
| 7. Khách hàng thực hiện chuyển khoản trên App ngân hàng. | 8. Ngân hàng gửi Webhook biến động số dư về hệ thống (`UC21`). |
| | 9. Hệ thống kiểm tra hợp lệ, cộng tiền vào `UserWallet` qua CAS, chuyển trạng thái giao dịch nạp thành `SUCCESS`. |
| | 10. Gửi thông báo realtime qua Pusher/WebSocket tới trình duyệt của khách: "Nạp tiền thành công [X]đ". |

##### 2. Exceptional interactions (Luồng ngoại lệ)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 3a. Số tiền nạp nhỏ hơn hạn mức tối thiểu (< 10.000đ). | 3b. Hệ thống báo lỗi "Số tiền nạp tối thiểu là 10.000 VNĐ". |
| 8a. Khách hàng chuyển khoản sai cú pháp nội dung. | 8b. Webhook ghi nhận giao dịch vào hàng chờ đối soát thủ công (`UC19`) để Admin kiểm tra và khớp tay. |

---

### UC10: Hủy đơn hàng

- **Use-case**: Hủy đơn hàng (`Cancel Order`)
- **Actors**: Khách hàng (`Customer`), Nhân viên (`Staff`), Quản trị viên (`Admin`)
- **Objective**: Cho phép hủy đơn hàng khi đơn chưa chuyển sang trạng thái đang giao vận, tự động giải phóng tồn kho và hoàn tiền 100% vào ví nội bộ nếu đơn đã được thanh toán.
- **References**: R3.4 (Vòng đời đơn hàng FSM & Chính sách hoàn tiền)
- **Pre-conditions**: Đơn hàng đang ở trạng thái `PENDING` (chưa thanh toán) hoặc `PAID` (đã thanh toán nhưng chưa xuất kho `SHIPPING`).
- **Post-conditions**: Trạng thái đơn hàng chuyển thành `CANCELLED`, số lượng tồn kho được cộng hoàn trả, số tiền đã trả (nếu có) được hoàn trả 100% vào Ví Shop của khách.
- **Description**: Khách hàng mở chi tiết đơn hàng và bấm "Hủy đơn hàng". Hệ thống kiểm tra điều kiện FSM, hoàn lại số lượng tồn kho cho các SKU, khôi phục mã giảm giá (nếu có) và gọi ca sử dụng bao hàm `UI05: Hoàn tiền 100% vào Ví Shop`.

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Khách hàng mở mục Lịch sử đơn hàng, chọn đơn hàng cần hủy. | 2. Hệ thống kiểm tra trạng thái đơn: hợp lệ nếu là `PENDING` hoặc `PAID`. |
| 3. Khách hàng bấm nút "Hủy đơn hàng" và chọn lý do hủy. | 4. Hiển thị hộp thoại xác nhận hủy đơn và chính sách hoàn tiền. |
| 5. Bấm "Xác nhận hủy đơn". | 6. Bắt đầu Database Transaction: Chuyển trạng thái đơn sang `CANCELLED`. |
| | 7. Hoàn trả số lượng tồn kho cho các biến thể SKU tương ứng trong bảng `ProductVariant`. |
| | 8. Khôi phục lượt sử dụng mã giảm giá Coupon (nếu có áp dụng). |
| | 9. (Nếu đơn đã thanh toán) Kích hoạt ca sử dụng bao hàm `UI05: Hoàn tiền 100% vào Ví Shop`. |
| | 10. Gửi thông báo xác nhận hủy đơn thành công đến khách hàng. |

##### 2. Exceptional interactions (Luồng ngoại lệ)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 2a. Đơn hàng đã được bàn giao vận chuyển (`SHIPPING`) hoặc đã hoàn tất (`COMPLETED`). | 2b. Hệ thống ẩn nút Hủy đơn, thông báo "Đơn hàng đã được bàn giao cho đơn vị vận chuyển, không thể hủy trực tiếp. Vui lòng liên hệ hỗ trợ". |

---

### UC11: Quản lý danh sách Wishlist

- **Use-case**: Quản lý danh sách Wishlist (`Manage Wishlist`)
- **Actors**: Khách hàng (`Customer`)
- **Objective**: Lưu trữ và quản lý danh sách các sản phẩm ưa thích để tiện theo dõi giá và mua sắm trong tương lai.
- **References**: R2.3 (Tương tác khách hàng & Cá nhân hóa)
- **Pre-conditions**: Khách hàng đã đăng nhập tài khoản.
- **Post-conditions**: Sản phẩm được thêm vào hoặc xóa bỏ khỏi bảng `Wishlist` của người dùng.
- **Description**: Khách hàng nhấn biểu tượng trái tim tại sản phẩm để đánh dấu yêu thích hoặc mở trang Wishlist để xem lại các sản phẩm đã lưu.

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Khách hàng nhấn vào biểu tượng Trái tim tại một sản phẩm. | 2. Kiểm tra trạng thái yêu thích hiện tại của sản phẩm đối với tài khoản. |
| | 3. Nếu chưa có, thêm bản ghi mới vào `WishlistItem`. Nếu đã có, xóa bản ghi khỏi danh sách. |
| | 4. Cập nhật trạng thái biểu tượng trái tim (tô đỏ/bỏ tô) và hiển thị thông báo phản hồi. |
| 5. Khách hàng mở trang "Danh sách Yêu thích" từ menu tài khoản. | 6. Hệ thống hiển thị toàn bộ các sản phẩm đã lưu kèm tình trạng tồn kho tức thời. |

##### 2. Exceptional interactions (Luồng ngoại lệ)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1a. Khách hàng chưa đăng nhập khi bấm yêu thích. | 1b. Hệ thống chuyển hướng khách hàng sang trang Đăng nhập và lưu URL hiện tại để chuyển tiếp lại sau khi đăng nhập. |

---

### UC12: Đánh giá & nhận xét sản phẩm

- **Use-case**: Đánh giá & nhận xét sản phẩm (`Review & Rate Products`)
- **Actors**: Khách hàng (`Customer`)
- **Objective**: Gửi điểm đánh giá (1 - 5 sao) và nhận xét phản hồi về chất lượng sản phẩm sau khi đã mua và nhận hàng thành công.
- **References**: R2.4 (Hệ thống Review có kiểm chứng - Verified Purchase)
- **Pre-conditions**: Khách hàng đã mua sản phẩm đó và đơn hàng đang ở trạng thái `COMPLETED` (Đã giao hàng thành công).
- **Post-conditions**: Bản ghi `ProductReview` được lưu trữ ở trạng thái chờ duyệt hoặc hiển thị công khai.
- **Description**: Khách hàng mở lịch sử mua hàng, chọn đơn hàng đã hoàn tất để viết nhận xét, chấm điểm số sao và đính kèm hình ảnh thực tế.

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Khách hàng truy cập danh sách đơn hàng đã mua, chọn đơn hàng có trạng thái `COMPLETED`. | 2. Hệ thống kiểm tra sản phẩm chưa từng được người dùng đánh giá trong đơn hàng này. |
| 3. Nhấn nút "Đánh giá sản phẩm". | 4. Hiển thị form đánh giá gồm số sao (1-5 sao), tiêu đề, nội dung nhận xét và nút tải ảnh. |
| 5. Chọn số sao, nhập lời nhận xét và bấm "Gửi đánh giá". | 6. Kiểm tra nội dung hợp lệ (độ dài $\ge$ 10 ký tự, không chứa từ ngữ vi phạm). |
| | 7. Lưu bản ghi `ProductReview` kèm nhãn `Verified Purchase: true`. |
| | 8. Tính toán lại điểm số sao trung bình của sản phẩm trong bảng `Product`. |
| | 9. Hiển thị thông báo "Cảm ơn bạn đã gửi đánh giá sản phẩm!". |

##### 2. Exceptional interactions (Luồng ngoại lệ)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 2a. Khách hàng chưa từng mua sản phẩm hoặc đơn hàng chưa hoàn tất giao hàng. | 2b. Hệ thống khóa chức năng đánh giá, hiển thị thông báo "Chỉ khách hàng đã nhận hàng thành công mới có thể gửi đánh giá". |

---

### UC13: Chat tư vấn trực tuyến Realtime

- **Use-case**: Chat tư vấn trực tuyến Realtime (`Realtime Live Customer Support`)
- **Actors**: Khách hàng (`Customer`), Nhân viên (`Staff`), Quản trị viên (`Admin`)
- **Objective**: Trao đổi tin nhắn trực tiếp giữa khách hàng và nhân viên hỗ trợ theo ngữ cảnh đơn hàng qua kênh WebSocket/Pusher.
- **References**: R5.1 (Tương tác thời gian thực & Kênh hỗ trợ)
- **Pre-conditions**: Khách hàng và nhân viên có kết nối mạng ổn định.
- **Post-conditions**: Tin nhắn được lưu vào cơ sở dữ liệu và truyền phát tức thời tới đối phương.
- **Description**: Khách hàng bấm vào widget chat góc phải màn hình để gửi câu hỏi. Hệ thống định tuyến tới phiên chat của nhân viên trực quầy (`UC16`), trao đổi dữ liệu hai chiều thời gian thực.

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Khách hàng bấm vào biểu tượng Widget Chat ở góc dưới màn hình. | 2. Hệ thống khởi tạo kết nối kênh WebSocket (Pusher channel riêng biệt `chat-room-[UserID]`). |
| 3. Khách hàng nhập nội dung tin nhắn và nhấn Gửi. | 4. Lưu bản ghi tin nhắn vào bảng `ChatMessage`. |
| | 5. Bắn sự kiện realtime `new-message` đến phòng trực chat của Nhân viên (`UC16`). |
| 6. Nhân viên nhập câu trả lời và nhấn Gửi. | 7. Lưu tin nhắn nhân viên và bắn sự kiện realtime về widget chat của Khách hàng. |
| 8. Khách hàng nhận được tin nhắn tức thời mà không cần tải lại trang. | |

##### 2. Exceptional interactions (Luồng ngoại lệ)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 2a. Mất kết nối mạng Internet hoặc kênh Pusher bị gián đoạn. | 2b. Hệ thống hiển thị thông báo "Mất kết nối, đang thử kết nối lại..." và tự động reconnect theo thuật toán exponential backoff. |

---

# PHẦN II: PHÂN HỆ QUẢN TRỊ SAAS BENTO & TỰ ĐỘNG HÓA

### UC14: Quản lý đơn hàng & duyệt FSM

- **Use-case**: Quản lý đơn hàng & duyệt FSM (`Manage Orders & Transition FSM`)
- **Actors**: Nhân viên (`Staff`), Quản trị viên (`Admin`), GHN Logistics (`Logistics Partner`)
- **Objective**: Quản lý vòng đời đơn hàng, xác nhận đóng gói và chuyển dịch trạng thái theo mô hình máy trạng thái hữu hạn (FSM), tự động đẩy vận đơn sang đối tác GHN.
- **References**: R3.4, R6.1 (Máy trạng thái đơn hàng & Quản trị SaaS)
- **Pre-conditions**: Nhân viên có quyền truy cập module `orders` trong ma trận phân quyền RBAC.
- **Post-conditions**: Trạng thái đơn hàng chuyển dịch hợp lệ; mã vận đơn GHN được sinh và liên kết tự động (`UI06`).
- **Description**: Nhân viên mở danh sách đơn hàng, xem chi tiết và duyệt đơn `PAID` sang trạng thái đóng gói và xuất kho. Khi duyệt xuất kho, hệ thống tự động gọi ca sử dụng bao hàm `UI06: Tạo vận đơn GHN tự động`.

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Nhân viên truy cập trang Quản lý đơn hàng `/admin/orders`. | 2. Hệ thống hiển thị bảng danh sách đơn hàng có phân loại theo trạng thái (Pending, Paid, Shipping, Completed, Cancelled). |
| 3. Nhân viên chọn một đơn hàng đang ở trạng thái `PAID` (Đã thanh toán) để kiểm tra. | 4. Hiển thị thông tin người nhận, danh sách SKU đóng gói, bằng chứng thanh toán QR. |
| 5. Nhân viên xác nhận đóng gói và bấm "Đẩy đơn sang GHN". | 6. Kích hoạt ca sử dụng bao hàm `UI06: Tạo vận đơn GHN tự động`. |
| | 7. Cập nhật mã vận đơn `trackingCode` nhận được từ GHN vào đơn hàng. |
| | 8. Chuyển trạng thái đơn hàng FSM từ `PAID` $ightarrow$ `SHIPPING`. |
| | 9. Gửi thông báo email và thông báo đẩy cho khách hàng: "Đơn hàng của bạn đang được vận chuyển". |

##### 2. Exceptional interactions (Luồng ngoại lệ)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 5a. Chuyển trạng thái vi phạm quy tắc FSM (ví dụ: chuyển từ `PENDING` trực tiếp sang `COMPLETED`). | 5b. Hệ thống ném lỗi FSM Invalid State Transition: "Không được phép chuyển đổi trạng thái không hợp lệ". |
| 6a. API tạo vận đơn của GHN trả về lỗi (do sai mã bưu cục hoặc thiếu địa chỉ). | 6b. Hệ thống giữ nguyên trạng thái đơn là `PAID`, hiển thị chi tiết lỗi của GHN để nhân viên chỉnh sửa địa chỉ và đẩy lại. |

---

### UC15: Quản lý sản phẩm & kho hàng

- **Use-case**: Quản lý sản phẩm & kho hàng (`Manage Products & Inventory`)
- **Actors**: Nhân viên (`Staff`), Quản trị viên (`Admin`)
- **Objective**: Thực hiện tạo mới, cập nhật thông tin sản phẩm, quản lý ma trận biến thể (màu sắc/kích thước) và điều chỉnh số lượng tồn kho.
- **References**: R2.1, R2.2 (CRUD Catalog & Quản trị kho)
- **Pre-conditions**: Nhân viên có quyền `products` trong ma trận phân quyền.
- **Post-conditions**: Dữ liệu sản phẩm và tồn kho các biến thể SKU được cập nhật nhất quán vào cơ sở dữ liệu.
- **Description**: Nhân viên quản trị nhập thông tin sản phẩm, tạo các biến thể màu/size, thiết lập đơn giá và số lượng nhập kho tương ứng.

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Nhân viên mở màn hình Quản lý sản phẩm `/admin/products`. | 2. Hệ thống kết xuất danh sách sản phẩm, bộ lọc danh mục và trạng thái tồn kho. |
| 3. Bấm "Thêm sản phẩm mới" (hoặc chọn sửa một sản phẩm hiện có). | 4. Hiển thị form nhập liệu: tên, slug, mô tả, danh mục, giá gốc, hình ảnh đại diện. |
| 5. Khai báo các thuộc tính biến thể (ví dụ: Màu: Đen, Trắng; Size: M, L, XL). | 6. Hệ thống tự động sinh ma trận các biến thể SKU (Matrix Generator: $2 	imes 3 = 6$ SKUs). |
| 7. Nhập giá bán và số lượng tồn kho cho từng SKU. | |
| 8. Bấm nút "Lưu sản phẩm". | 9. Kiểm tra tính hợp lệ dữ liệu, bắt đầu Transaction lưu bảng `Product` và các bản ghi `ProductVariant`. |
| | 10. Thông báo "Lưu sản phẩm thành công" và cập nhật danh sách. |

##### 2. Exceptional interactions (Luồng ngoại lệ)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 8a. Tên sản phẩm bị trùng lặp slug URL với sản phẩm khác. | 8b. Hệ thống tự động thêm hậu tố ngẫu nhiên vào slug hoặc yêu cầu nhân viên đổi tên để đảm bảo tính duy nhất. |

---

### UC16: Trực chat tư vấn khách hàng

- **Use-case**: Trực chat tư vấn khách hàng (`Staff Live Chat Desk`)
- **Actors**: Nhân viên (`Staff`), Quản trị viên (`Admin`)
- **Objective**: Tiếp nhận các cuộc hội thoại từ khách hàng, giải đáp thắc mắc về sản phẩm và xử lý khiếu nại đơn hàng trong thời gian thực.
- **References**: R5.1 (Bàn trực chat quản trị Realtime)
- **Pre-conditions**: Nhân viên đăng nhập vào hệ thống quản trị và có quyền `chat`.
- **Post-conditions**: Lịch sử hội thoại được lưu vết đầy đủ trong hệ thống.
- **Description**: Giao diện bàn trực chat hiển thị danh sách các phòng chat đang hoạt động của khách hàng. Nhân viên chọn phòng chat, xem lịch sử đơn hàng của khách và trả lời tin nhắn tức thì.

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Nhân viên mở trang Bàn trực chat `/admin/chat`. | 2. Hệ thống tải danh sách các cuộc hội thoại khách hàng, đánh dấu tin nhắn chưa đọc và thời gian nhắn gần nhất. |
| 3. Nhấp chọn một cuộc hội thoại của khách hàng. | 4. Hiển thị khung chat lịch sử kèm thông tin tóm tắt của khách (tên, email, các đơn hàng gần nhất). |
| 5. Nhập nội dung câu trả lời và nhấn nút Gửi (hoặc bấm Enter). | 6. Lưu tin nhắn vào CSDL và phát sóng (broadcast) sự kiện realtime đến trình duyệt của khách qua Pusher (`UC13`). |
| | 7. Đánh dấu cuộc hội thoại đã được phản hồi. |

---

### UC17: Kiểm duyệt đánh giá Review

- **Use-case**: Kiểm duyệt đánh giá Review (`Moderate Product Reviews`)
- **Actors**: Quản trị viên (`Admin`)
- **Objective**: Phê duyệt các đánh giá hợp lệ của khách hàng để hiển thị công khai hoặc ẩn các đánh giá chứa nội dung phản cảm, spam.
- **References**: R2.4 (Kiểm duyệt nội dung người dùng)
- **Pre-conditions**: Quản trị viên đăng nhập với quyền Admin.
- **Post-conditions**: Trạng thái `isApproved` của bản ghi đánh giá được cập nhật.
- **Description**: Admin duyệt danh sách các đánh giá sản phẩm mới gửi, kiểm tra hình ảnh và nội dung phản hồi của khách trước khi cho phép xuất hiện trên trang sản phẩm công khai.

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Admin truy cập màn hình `/admin/reviews`. | 2. Hệ thống liệt kê các đánh giá mới gửi: số sao, nội dung bình luận, người gửi, sản phẩm và ảnh đính kèm. |
| 3. Admin kiểm tra nội dung và bấm "Duyệt hiển thị" (hoặc "Ẩn đánh giá"). | 4. Hệ thống cập nhật trường `isApproved: true` (hoặc `false`). |
| | 5. Tính toán lại số sao đánh giá trung bình hiển thị ngoài trang Storefront. |
| | 6. Thông báo "Cập nhật trạng thái đánh giá thành công". |

---

### UC18: Giám sát doanh thu Dashboard Bento Grid

- **Use-case**: Giám sát doanh thu Dashboard Bento Grid (`Monitor Revenue & SaaS Bento Dashboard`)
- **Actors**: Quản trị viên (`Admin`)
- **Objective**: Theo dõi trực quan toàn bộ các chỉ số vận hành then chốt: doanh thu theo ngày/tháng, số lượng đơn hàng, biến động tiền nạp ví và tỷ lệ hủy đơn trên giao diện Bento Grid hiện đại.
- **References**: R6.2 (Bento Grid Business Intelligence & Analytics)
- **Pre-conditions**: Quản trị viên đăng nhập hệ thống với vai trò `ADMIN`.
- **Post-conditions**: Dữ liệu tài chính và hoạt động được tổng hợp chính xác theo thời gian thực.
- **Description**: Admin truy cập trang chủ quản trị `/admin`. Hệ thống tự động tổng hợp số liệu từ các bảng `Order`, `WalletTransaction`, `User` và kết xuất các thẻ Bento widget trực quan.

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Admin mở trang Tổng quan `/admin`. | 2. Hệ thống thực hiện các truy vấn aggregate dữ liệu tài chính trong CSDL. |
| | 3. Hiển thị khối Bento 1: Tổng doanh thu hôm nay và tỷ lệ tăng trưởng so với hôm qua. |
| | 4. Hiển thị khối Bento 2: Biểu đồ doanh thu 30 ngày gần nhất (doanh thu QR vs doanh thu Ví Shop). |
| | 5. Hiển thị khối Bento 3: Số đơn hàng mới cần xử lý (`PENDING` và `PAID`). |
| | 6. Hiển thị khối Bento 4: Cảnh báo đơn quá hạn và các giao dịch VietQR cần đối soát thủ công. |
| 7. Admin chọn khoảng thời gian tùy biến (7 ngày, tháng này, quý này). | 8. Hệ thống tính toán lại và làm mới các biểu đồ không cần tải lại toàn trang. |

---

### UC19: Đối soát thủ công giao dịch VietQR

- **Use-case**: Đối soát thủ công giao dịch VietQR (`Manual VietQR Payment Reconciliation`)
- **Actors**: Quản trị viên (`Admin`)
- **Objective**: Xử lý khớp tay các khoản tiền chuyển khoản của khách hàng bị sai lệch nội dung chuyển khoản hoặc hệ thống ngân hàng bắn Webhook chậm.
- **References**: R4.4 (Đối soát dòng tiền & Xử lý sai lệch thanh toán)
- **Pre-conditions**: Có giao dịch ngân hàng phát sinh nhưng chưa được hệ thống tự động khớp vào đơn hàng hoặc yêu cầu nạp ví.
- **Post-conditions**: Giao dịch được gán chính xác vào mã đơn hàng hoặc tài khoản ví, số tiền được xác nhận hợp lệ.
- **Description**: Admin xem danh sách biến động số dư ngân hàng trong bảng `PaymentTransaction` có trạng thái `UNMATCHED`. Admin tra cứu mã đơn hàng, đối chiếu số tiền và bấm "Khớp thủ công".

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Admin truy cập màn hình `/admin/reconcile`. | 2. Hệ thống liệt kê danh sách giao dịch ngân hàng chưa được khớp (kèm số tài khoản gửi, số tiền, nội dung chuyển khoản gốc). |
| 3. Admin kiểm tra nội dung chuyển khoản, tìm kiếm đơn hàng hoặc mã tài khoản ví tương ứng. | 4. Hiển thị thông tin đơn hàng đối chiếu (mã đơn, số tiền phải thanh toán, người đặt). |
| 5. Kiểm tra số tiền nhận $\ge$ số tiền đơn hàng, bấm "Xác nhận Khớp đơn". | 6. Bắt đầu Database Transaction: Cập nhật `PaymentTransaction.isMatched = true`. |
| | 7. Chuyển trạng thái đơn hàng sang `PAID`, hủy hạn giờ thanh toán. |
| | 8. Ghi log kiểm toán (`AuditLog`) lưu vết Admin đã thực hiện khớp thủ công. |
| | 9. Thông báo thành công và xóa giao dịch khỏi hàng chờ chưa khớp. |

##### 2. Exceptional interactions (Luồng ngoại lệ)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 5a. Số tiền khách hàng chuyển nhỏ hơn tổng số tiền của đơn hàng. | 5b. Hệ thống cảnh báo "Số tiền chuyển khoản thiếu [X]đ so với đơn hàng", yêu cầu Admin xác nhận có chấp nhận hay chuyển sang trạng thái chờ khách chuyển bổ sung. |

---

### UC20: Phân quyền RBAC & quản lý người dùng

- **Use-case**: Phân quyền RBAC & quản lý người dùng (`RBAC & User Management`)
- **Actors**: Quản trị viên (`Admin`)
- **Objective**: Quản lý danh sách tài khoản người dùng, phân cấp vai trò (`CUSTOMER`, `STAFF`, `ADMIN`), cấu hình ma trận quyền hạn chi tiết cho nhân viên và khóa các tài khoản vi phạm.
- **References**: R1.5 (Ma trận phân quyền RBAC & Bất biến an ninh)
- **Pre-conditions**: Người thực hiện là Quản trị viên cấp cao (`ADMIN`).
- **Post-conditions**: Vai trò, quyền hạn hoặc trạng thái hoạt động của tài khoản được cập nhật an toàn.
- **Description**: Admin mở danh sách người dùng, chọn tài khoản để phân vai trò. Nếu chọn vai trò `STAFF`, Admin tích chọn các module được phép truy cập (`orders`, `products`, `shipments`, `chat`, `reviews`). Hệ thống đảm bảo bất biến không cho phép Admin tự hạ quyền của chính mình nếu là Admin duy nhất.

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Admin mở trang `/admin/users`. | 2. Hệ thống hiển thị danh sách người dùng, vai trò hiện tại, ngày tạo và trạng thái hoạt động. |
| 3. Chọn tài khoản cần phân quyền và bấm "Chỉnh sửa". | 4. Hiển thị form chọn vai trò (`CUSTOMER`, `STAFF`, `ADMIN`) và ma trận các nhóm quyền cho Staff. |
| 5. Chọn vai trò `STAFF`, tích chọn các nhóm quyền: `orders`, `products`, `chat`. | |
| 6. Bấm "Lưu thay đổi". | 7. Kiểm tra các bất biến bảo mật an ninh (Security Invariants):<br>- **Chống tự hạ quyền:** Admin không được tự hạ quyền nếu là Admin duy nhất.<br>- **Bảo vệ Root:** Không được khóa tài khoản Admin duy nhất. |
| | 8. Cập nhật `role` và `permissions` của User trong cơ sở dữ liệu. |
| | 9. Vô hiệu hóa JWT token cũ của user đó để buộc áp dụng quyền mới ở phiên kế tiếp. |
| | 10. Thông báo "Cập nhật phân quyền thành công". |

##### 2. Exceptional interactions (Luồng ngoại lệ)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 7a. Admin cố gắng đổi vai trò của chính mình thành `STAFF` hoặc `CUSTOMER` khi hệ thống chỉ còn 1 tài khoản Admin. | 7b. Hệ thống ném lỗi 403 Forbidden: "Không thể tự hạ quyền của Quản trị viên duy nhất trong hệ thống". |

---

### UC21: Xử lý Webhook số dư VietQR

- **Use-case**: Xử lý Webhook số dư VietQR (`Process Bank Webhook`)
- **Actors**: Ngân hàng VietQR (`NAPAS 247 / Casso`)
- **Objective**: Tiếp nhận thông báo biến động số dư từ cổng ngân hàng theo thời gian thực, xác thực chữ ký bảo mật và tự động khớp tiền cho đơn hàng hoặc giao dịch nạp ví.
- **References**: R4.1, R4.2, R4.4 (Kiến trúc Webhook Idempotency 8 cổng chặn)
- **Pre-conditions**: Cổng thanh toán VietQR/Casso cấu hình Webhook URL trỏ tới `/api/webhooks/casso`.
- **Post-conditions**: Giao dịch ngân hàng được lưu vết, đơn hàng được chuyển sang `PAID` hoặc ví được cộng tiền, phản hồi HTTP 200 OK cho đối tác.
- **Description**: Ngân hàng bắn payload biến động số dư. Hệ thống thực hiện chuỗi kiểm tra an ninh (Secure Token header), phân tích cú pháp nội dung chuyển khoản và gọi ca sử dụng bao hàm `UI07: Khớp tiền tự động (Idempotent Worker)` để xử lý an toàn, chống lặp tiền.

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Cổng ngân hàng gửi HTTP POST request chứa danh sách giao dịch biến động số dư kèm `secure-token` header. | 2. Kiểm tra xác thực Token bảo mật khớp với khóa bí mật `CASSO_WEBHOOK_SECRET`. |
| | 3. Phân tách danh sách các giao dịch trong payload. |
| | 4. Với từng giao dịch, gọi ca sử dụng bao hàm `UI07: Khớp tiền tự động (Idempotent Worker)`. |
| | 5. Kiểm tra mã giao dịch ngân hàng `tid` chưa từng được xử lý (tránh duplicate). |
| | 6. Trích xuất mã đơn hàng hoặc mã nạp ví từ nội dung chuyển khoản (`description`). |
| | 7. Khớp số tiền và thực thi cập nhật trạng thái đơn sang `PAID` hoặc cộng số dư ví. |
| | 8. Bắn sự kiện realtime cập nhật giao diện người dùng. |
| | 9. Phản hồi HTTP 200 `{"error": 0, "message": "Webhook processed successfully"}` cho ngân hàng. |

##### 2. Exceptional interactions (Luồng ngoại lệ)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 2a. Header `secure-token` bị thiếu hoặc sai lệch. | 2b. Hệ thống lập tức trả về HTTP 401 Unauthorized, từ chối xử lý và ghi log cảnh báo an ninh. |
| 5a. Giao dịch đã được xử lý trước đó (Ngân hàng retry webhook). | 5b. Nhờ cơ chế Idempotency, hệ thống bỏ qua bước cộng tiền lặp, trả về HTTP 200 OK ngay lập tức. |
| 6a. Nội dung chuyển khoản không chứa mã đơn hàng hợp lệ. | 6b. Hệ thống lưu giao dịch vào bảng `PaymentTransaction` với trạng thái `UNMATCHED` và đẩy vào hàng chờ đối soát thủ công (`UC19`). |

---

### UC22: Đồng bộ bưu kiện qua Webhook GHN

- **Use-case**: Đồng bộ bưu kiện qua Webhook GHN (`Sync GHN Shipment Webhook`)
- **Actors**: Đơn vị Vận chuyển (`GHN Logistics`)
- **Objective**: Tiếp nhận các cập nhật hành trình bưu kiện (đang lấy hàng, đang giao, giao thành công, giao thất bại/hoàn hàng) từ GHN để tự động cập nhật trạng thái đơn hàng.
- **References**: R3.4 (Đồng bộ hành trình Logistics FSM)
- **Pre-conditions**: Đơn hàng đã có mã vận đơn GHN hợp lệ (`trackingCode`).
- **Post-conditions**: Trạng thái vận chuyển và trạng thái đơn hàng được đồng bộ hóa tức thì.
- **Description**: GHN gửi webhook trạng thái bưu kiện. Hệ thống cập nhật bảng `Shipment`, nếu trạng thái là `delivered` (Giao thành công), hệ thống tự động hoàn tất đơn hàng sang `COMPLETED`.

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. GHN gửi HTTP POST request thông báo trạng thái vận đơn (ví dụ: `Status: "delivered"`). | 2. Xác thực webhook token từ GHN. |
| | 3. Tra cứu bưu kiện theo mã vận đơn `OrderCode`. |
| | 4. Cập nhật nhật ký hành trình vào bảng `Shipment`. |
| | 5. Nếu trạng thái là `delivered`, cập nhật đơn hàng thành `COMPLETED`, mở khóa tính năng viết Đánh giá sản phẩm (`UC12`) cho khách hàng. |
| | 6. Phản hồi HTTP 200 OK cho GHN. |

---

### UC23: Hủy đơn & nhả kho quá hạn tự động

- **Use-case**: Hủy đơn & nhả kho quá hạn tự động (`Auto Cancel Expired Orders Cron`)
- **Actors**: Hệ thống Quét Tự động (`Cron Scheduler`)
- **Objective**: Tự động rà soát định kỳ các đơn hàng ở trạng thái `PENDING` đã quá thời hạn thanh toán (15 phút), tự động hủy đơn và nhả tồn kho đã khóa trả lại cho kho hàng.
- **References**: R3.2 (Giải phóng tồn kho & Chống giữ kho ảo)
- **Pre-conditions**: Tiến trình Cron Job chạy định kỳ mỗi 1 - 5 phút.
- **Post-conditions**: Các đơn hàng quá hạn được chuyển sang `CANCELLED`, số lượng tồn kho khả dụng được hoàn trả đầy đủ.
- **Description**: Tác nhân Cron tự động quét bảng `Order` tìm các đơn `PENDING` có `expiresAt < NOW()`. Với mỗi đơn, hệ thống cập nhật trạng thái hủy và hoàn trả tồn kho nguyên tử.

#### Scenarios (Kịch bản)

##### 1. Main interactions (Luồng sự kiện chính)
| Actions of actor (Hành động của tác nhân) | Actions of system (Hành động của hệ thống) |
| :--- | :--- |
| 1. Hệ thống Cron Scheduler kích hoạt tiến trình quét định kỳ. | 2. Truy vấn CSDL tìm các đơn hàng thỏa mãn: `status == PENDING` VÀ `expiresAt <= NOW()`. |
| | 3. Nếu không có đơn quá hạn, kết thúc lượt quét. |
| | 4. Với mỗi đơn quá hạn, mở Transaction: |
| | - Chuyển `Order.status = CANCELLED`. |
| | - Hoàn trả tồn kho cho từng biến thể SKU trong chi tiết đơn hàng (`ProductVariant.stock += quantity`). |
| | - Khôi phục mã giảm giá Coupon nếu có áp dụng. |
| | 5. Ghi log kiểm toán: "Tự động hủy đơn hàng [ID] do hết hạn thanh toán 15 phút". |
| | 6. Hoàn tất chu kỳ quét. |

---

# PHẦN III: CÁC CA SỬ DỤNG PHỤ TRỢ (INCLUDED & EXTENDED USE CASES)

### UI01: Xác thực mã OTP qua Email

- **Use-case**: Xác thực mã OTP qua Email (`Verify OTP via Email`)
- **Actors**: Khách hàng (`Customer`)
- **Objective**: Xác minh quyền sở hữu hòm thư điện tử bằng mã số bí mật 6 chữ số có hiệu lực 5 phút.
- **References**: R1.2 (Bảo mật OTP 2 lớp)
- **Pre-conditions**: Ca sử dụng gọi (`UC01: Đăng ký` hoặc `UC02: Khôi phục mật khẩu`) đã phát hành mã OTP.
- **Post-conditions**: Mã OTP được xác nhận đúng, đánh dấu đã dùng (`used: true`), tài khoản được xác minh.
- **Description**: Ca sử dụng bao hàm (`«include»`). Hệ thống tạo mã 6 số ngẫu nhiên, mã hóa hash lưu vào bảng `OtpCode`, gửi thư qua dịch vụ Resend. Khách hàng nhập mã, hệ thống so khớp và giới hạn tối đa 5 lần thử sai.

---

### UI02: Kiểm tra & giữ tồn kho nguyên tử

- **Use-case**: Kiểm tra & giữ tồn kho nguyên tử (`Atomic Stock Verification & Hold`)
- **Actors**: Khách hàng (`Customer`)
- **Objective**: Khóa số lượng hàng tồn trong kho cho đơn hàng trong 15 phút một cách nguyên tử, chống bán vượt tồn (Overselling).
- **References**: R3.2 (Bất biến tồn kho nguyên tử)
- **Pre-conditions**: Được gọi tự động trong luồng `UC07: Đặt hàng sản phẩm`.
- **Post-conditions**: Số lượng tồn kho khả dụng bị tạm trừ, nếu quá hạn 15 phút sẽ được nhả lại bởi `UC23`.
- **Description**: Ca sử dụng bao hàm (`«include»`). Sử dụng transaction cơ sở dữ liệu với điều kiện `WHERE stock >= requested_quantity`, đảm bảo an toàn tuyệt đối ngay cả khi hàng trăm người cùng bấm mua 1 sản phẩm cuối cùng tại một thời điểm.

---

### UI03: Tính phí vận chuyển tự động

- **Use-case**: Tính phí vận chuyển tự động (`Calculate Shipping Fee via GHN`)
- **Actors**: Khách hàng (`Customer`), GHN Logistics (`Logistics Partner`)
- **Objective**: Tự động tính cước vận chuyển giao hàng dựa trên tọa độ/địa chỉ giao nhận và trọng lượng bưu kiện qua API của Giao Hàng Nhanh.
- **References**: R3.3 (Tích hợp API Logistics)
- **Pre-conditions**: Khách hàng đã cung cấp đủ thông tin Tỉnh/Thành, Quận/Huyện, Phường/Xã.
- **Post-conditions**: Cước phí vận chuyển chính xác được cộng vào tổng giá trị đơn hàng.
- **Description**: Ca sử dụng bao hàm (`«include»`) trong luồng `UC07: Đặt hàng`. Hệ thống ánh xạ địa chỉ của khách sang `district_id` và `ward_code` của GHN, gọi API `fee` để nhận số tiền cước chuẩn xác.

---

### UI04: Tạo mã VietQR thanh toán động

- **Use-case**: Tạo mã VietQR thanh toán động (`Generate Dynamic VietQR Code`)
- **Actors**: Khách hàng (`Customer`), Ngân hàng VietQR (`NAPAS 247 / Casso`)
- **Objective**: Tạo mã QR thanh toán chuẩn NAPAS 247 / VietQR chứa sẵn số tài khoản ngân hàng, số tiền chính xác từng đồng và nội dung chuyển khoản độc nhất.
- **References**: R4.1 (Chuẩn thanh toán VietQR động)
- **Pre-conditions**: Đơn hàng đã được tạo thành công với mã đơn hàng cụ thể.
- **Post-conditions**: Ảnh mã QR chuẩn VietQR được kết xuất hiển thị cho khách hàng quét.
- **Description**: Ca sử dụng bao hàm (`«include»`) trong luồng `UC07: Đặt hàng`. Sinh URL ảnh QR theo cú pháp VietQR (`https://img.vietqr.io/image/[BankID]-[AccountNo]-compact2.png?amount=[Total]&addInfo=[OrderCode]`), giúp khách hàng không cần nhập tay bất kỳ thông tin nào, tránh hoàn toàn sai sót khi chuyển tiền.

---

### UI05: Hoàn tiền 100% vào Ví Shop

- **Use-case**: Hoàn tiền 100% vào Ví Shop (`Full Refund to Internal Wallet`)
- **Actors**: Khách hàng (`Customer`)
- **Objective**: Tự động hoàn lại 100% số tiền đơn hàng đã thanh toán vào số dư Ví Shop của khách hàng ngay sau khi hủy đơn thành công.
- **References**: R3.4, R4.3 (Chính sách hoàn tiền tự động)
- **Pre-conditions**: Đơn hàng bị hủy (`UC10`) đã ở trạng thái thanh toán thành công (`PAID`).
- **Post-conditions**: Số dư ví nội bộ của khách hàng được cộng đủ 100% tiền đơn, lịch sử giao dịch ghi nhận `REFUND`.
- **Description**: Ca sử dụng bao hàm (`«include»`) trong luồng `UC10: Hủy đơn hàng`. Giúp khách hàng nhận lại tiền tức thì trong 1 giây mà không cần chờ đợi thủ tục hoàn tiền ngân hàng kéo dài nhiều ngày.

---

### UI06: Tạo vận đơn GHN tự động

- **Use-case**: Tạo vận đơn GHN tự động (`Auto Create GHN Shipping Order`)
- **Actors**: Nhân viên (`Staff`), GHN Logistics (`Logistics Partner`)
- **Objective**: Tự động gọi API đẩy đơn hàng sang hệ thống Giao Hàng Nhanh khi nhân viên duyệt đơn xuất kho, lấy về mã vận đơn và in phiếu giao hàng.
- **References**: R6.1 (Tự động hóa vận đơn đối tác)
- **Pre-conditions**: Nhân viên bấm xác nhận giao hàng tại `UC14: Quản lý đơn hàng`.
- **Post-conditions**: Vận đơn GHN được khởi tạo, mã `trackingCode` được liên kết với đơn hàng.
- **Description**: Ca sử dụng bao hàm (`«include»`) trong luồng `UC14: Quản lý đơn hàng`.

---

### UI07: Khớp tiền tự động (Idempotent Worker)

- **Use-case**: Khớp tiền tự động (`Idempotent Payment Matching Worker`)
- **Actors**: Ngân hàng VietQR (`NAPAS 247 / Casso`)
- **Objective**: Thuật toán so khớp đối soát biến động số dư ngân hàng với đơn hàng một cách an toàn tuyệt đối, chống xử lý trùng lặp giao dịch (Idempotency).
- **References**: R4.1, R4.4 (Cơ chế Idempotent Worker)
- **Pre-conditions**: Được gọi từ `UC21: Xử lý Webhook số dư VietQR`.
- **Post-conditions**: Đơn hàng được cập nhật thành `PAID` duy nhất 1 lần, các webhook gửi lặp lại bị bỏ qua an toàn.
- **Description**: Ca sử dụng bao hàm (`«include»`) trong luồng `UC21: Xử lý Webhook`. Dựa trên bảng `PaymentTransaction` với chỉ mục `unique` trên mã giao dịch ngân hàng `transactionId`.

---

### UE01: Áp dụng mã giảm giá Coupon

- **Use-case**: Áp dụng mã giảm giá Coupon (`Apply Discount Coupon`)
- **Actors**: Khách hàng (`Customer`)
- **Objective**: Cho phép người mua nhập mã ưu đãi (voucher/coupon) để được giảm trừ trực tiếp vào tổng tiền thanh toán đơn hàng.
- **References**: R3.2 (Chính sách khuyến mại & Chiết khấu)
- **Pre-conditions**: Khách hàng đang ở màn hình đặt hàng `UC07: Đặt hàng sản phẩm`.
- **Post-conditions**: Tổng số tiền thanh toán của đơn hàng được chiết khấu theo quy định của mã giảm giá.
- **Description**: Ca sử dụng mở rộng (`«extend»`) cho `UC07: Đặt hàng sản phẩm`. Là hành vi tùy chọn và có điều kiện: khách hàng chỉ thực hiện khi có mã giảm giá. Hệ thống kiểm tra điều kiện mã: thời hạn hiệu lực, giá trị đơn hàng tối thiểu, số lượt sử dụng còn lại trước khi áp dụng chiết khấu.

---

### UE02: Tự động điền địa chỉ qua GPS

- **Use-case**: Tự động điền địa chỉ qua GPS (`Auto Geolocation Address Fill`)
- **Actors**: Khách hàng (`Customer`)
- **Objective**: Lấy tọa độ địa lý hiện tại của thiết bị người dùng để tự động nhận diện và điền nhanh Tỉnh/Thành, Quận/Huyện, Phường/Xã vào đơn hàng.
- **References**: R3.3 (Định vị Geolocation & Điền địa chỉ thông minh)
- **Pre-conditions**: Khách hàng đang ở màn hình đặt hàng `UC07: Đặt hàng sản phẩm` và trình duyệt được cấp quyền truy cập vị trí.
- **Post-conditions**: Các ô chọn địa giới hành chính được điền tự động chính xác.
- **Description**: Ca sử dụng mở rộng (`«extend»`) cho `UC07: Đặt hàng sản phẩm`. Là hành vi tùy chọn giúp tăng tốc độ checkout. Hệ thống gọi API HTML5 Geolocation lấy kinh độ/vĩ độ, thực hiện Reverse Geocoding qua OpenStreetMap/Nominatim và ánh xạ sang mã địa giới tương ứng của GHN.

---

*(Bản đặc tả đã được đối chiếu toàn diện và khớp 100% với Bộ 3 sơ đồ Use Case UML chuẩn đen trắng trong file `01-use-case.drawio`).*
