# BẢN ĐẶC TẢ USE CASE CHUẨN MÔ HÌNH HÓA YÊU CẦU
## HỆ THỐNG THƯƠNG MẠI ĐIỆN TỬ BÁN LẺ VÀ THANH TOÁN TỰ ĐỘNG

> **Tài liệu tham chiếu:** Giáo trình và Bài giảng Phân tích và Thiết kế Hệ thống - Chương 4: Mô hình hóa yêu cầu.  
> **Quy chuẩn ngôn ngữ học thuật:** Văn bản tuân thủ tuyệt đối quy định: các từ ngữ tiếng Anh duy nhất được phép sử dụng trong toàn bộ tài liệu là **use case**, **actor**, **actions of human** và **actions of system**. Toàn bộ các tiêu đề, cấu trúc thuộc tính, tên tác nhân và diễn giải quy trình đều được chuẩn hóa hoàn toàn bằng tiếng Việt.

---

## MỤC LỤC BẢN ĐẶC TẢ

### PHẦN I: PHÂN HỆ MUA SẮM VÀ KHÁCH HÀNG
1. [UC01: Đăng ký tài khoản mới](#uc01-đăng-ký-tài-khoản-mới)
2. [UC02: Khôi phục mật khẩu](#uc02-khôi-phục-mật-khẩu)
3. [UC03: Đăng nhập và đăng xuất hệ thống](#uc03-đăng-nhập-và-đăng-xuất-hệ-thống)
4. [UC04: Tìm kiếm và xem sản phẩm](#uc04-tìm-kiếm-và-xem-sản-phẩm)
5. [UC05: Xem chi tiết và chọn biến thể sản phẩm](#uc05-xem-chi-tiết-và-chọn-biến-thể-sản-phẩm)
6. [UC06: Quản lý giỏ hàng](#uc06-quản-lý-giỏ-hàng)
7. [UC07: Đặt hàng sản phẩm (Trung tâm đặt hàng)](#uc07-đặt-hàng-sản-phẩm-trung-tâm-đặt-hàng)
8. [UC08: Thanh toán đơn bằng Ví nội bộ](#uc08-thanh-toán-đơn-bằng-ví-nội-bộ)
9. [UC09: Nạp tiền vào Ví qua mã thanh toán QR](#uc09-nạp-tiền-vào-ví-qua-mã-thanh-toán-qr)
10. [UC10: Hủy đơn hàng](#uc10-hủy-đơn-hàng)
11. [UC11: Quản lý danh sách yêu thích](#uc11-quản-lý-danh-sách-yêu-thích)
12. [UC12: Đánh giá và nhận xét sản phẩm](#uc12-đánh-giá-và-nhận-xét-sản-phẩm)
13. [UC13: Trò chuyện tư vấn trực tuyến thời gian thực](#uc13-trò-chuyện-tư-vấn-trực-tuyến-thời-gian-thực)

### PHẦN II: PHÂN HỆ QUẢN TRỊ VÀ TỰ ĐỘNG HÓA
14. [UC14: Quản lý đơn hàng và duyệt chuyển trạng thái](#uc14-quản-lý-đơn-hàng-và-duyệt-chuyển-trạng-thái)
15. [UC15: Quản lý sản phẩm và kho hàng](#uc15-quản-lý-sản-phẩm-và-kho-hàng)
16. [UC16: Trực bàn tư vấn khách hàng](#uc16-trực-bàn-tư-vấn-khách-hàng)
17. [UC17: Kiểm duyệt đánh giá sản phẩm](#uc17-kiểm-duyệt-đánh-giá-sản-phẩm)
18. [UC18: Giám sát doanh thu và bảng điều khiển tổng quan](#uc18-giám-sát-doanh-thu-và-bảng-điều-khiển-tổng-quan)
19. [UC19: Đối soát thủ công giao dịch chuyển khoản ngân hàng](#uc19-đối-soát-thủ-công-giao-dịch-chuyển-khoản-ngân-hàng)
20. [UC20: Phân quyền theo vai trò và quản lý người dùng](#uc20-phân-quyền-theo-vai-trò-và-quản-lý-người-dùng)
21. [UC21: Tiếp nhận và xử lý biến động số dư ngân hàng](#uc21-tiếp-nhận-và-xử-lý-biến-động-số-dư-ngân-hàng)
22. [UC22: Đồng bộ hành trình bưu kiện Giao Hàng Nhanh](#uc22-đồng-bộ-hành-trình-bưu-kiện-giao-hàng-nhanh)
23. [UC23: Hủy đơn và hoàn tồn kho quá hạn tự động](#uc23-hủy-đơn-và-hoàn-tồn-kho-quá-hạn-tự-động)

### PHẦN III: CÁC USE CASE PHỤ TRỢ (BAO HÀM VÀ MỞ RỘNG)
- [UI01: Xác thực mã số một lần qua thư điện tử](#ui01-xác-thực-mã-số-một-lần-qua-thư-điện-tử)
- [UI02: Kiểm tra và giữ tồn kho nguyên tử](#ui02-kiểm-tra-và-giữ-tồn-kho-nguyên-tử)
- [UI03: Tính phí vận chuyển tự động](#ui03-tính-phí-vận-chuyển-tự-động)
- [UI04: Tạo mã phản hồi nhanh QR thanh toán động](#ui04-tạo-mã-phản-hồi-nhanh-qr-thanh-toán-động)
- [UI05: Hoàn trả toàn bộ tiền vào Ví nội bộ](#ui05-hoàn-trả-toàn-bộ-tiền-vào-ví-nội-bộ)
- [UI06: Tạo vận đơn giao hàng tự động](#ui06-tạo-vận-đơn-giao-hàng-tự-động)
- [UI07: Khớp tiền tự động chống trùng lặp](#ui07-khớp-tiền-tự-động-chống-trùng-lặp)
- [UE01: Áp dụng mã giảm giá](#ue01-áp-dụng-mã-giảm-giá)
- [UE02: Tự động điền địa chỉ qua định vị vệ tinh](#ue02-tự-động-điền-địa-chỉ-qua-định-vị-vệ-tinh)

---

# PHẦN I: PHÂN HỆ MUA SẮM VÀ KHÁCH HÀNG

### UC01: Đăng ký tài khoản mới

- **Use case**: Đăng ký tài khoản mới
- **Actor**: Khách hàng
- **Mục tiêu**: Khởi tạo hồ sơ tài khoản người dùng mới trên hệ thống để thực hiện mua sắm và theo dõi lịch sử giao dịch.
- **Tài liệu tham chiếu**: Yêu cầu R1.1, R1.2 (Quản lý định danh người dùng)
- **Tiền điều kiện**: Khách hàng chưa đăng nhập vào hệ thống.
- **Hậu điều kiện**: Hồ sơ người dùng được tạo mới ở trạng thái chờ xác thực, mã xác nhận một lần được cấp phát và gửi vào hòm thư điện tử của khách hàng.
- **Mô tả**: Khách hàng điền thông tin cá nhân bao gồm họ tên, thư điện tử, số điện thoại và mật khẩu. Hệ thống kiểm tra hợp lệ, mã hóa bảo mật mật khẩu, tạo mã xác thực một lần và gọi use case bao hàm UI01 để xác thực hòm thư điện tử.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Khách hàng truy cập giao diện Đăng ký tài khoản. | |
| 2. Nhập họ tên, địa chỉ thư điện tử, số điện thoại và mật khẩu. | |
| 3. Nhấn nút xác nhận đăng ký tài khoản. | 4. Kiểm tra tính hợp lệ của dữ liệu đầu vào (cú pháp thư điện tử chuẩn, mật khẩu tối thiểu 8 ký tự). |
| | 5. Kiểm tra địa chỉ thư điện tử chưa từng được đăng ký trong cơ sở dữ liệu. |
| | 6. Băm mật khẩu bảo mật bằng giải thuật băm một chiều an toàn. |
| | 7. Tạo bản ghi người dùng mới với trạng thái chưa kích hoạt. |
| | 8. Thực thi use case bao hàm UI01: Xác thực mã số một lần qua thư điện tử. |
| | 9. Chuyển hướng giao diện sang màn hình nhập mã xác nhận kích hoạt tài khoản. |

##### 2. Luồng ngoại lệ
| Actions of human | Actions of system |
| :--- | :--- |
| 3a. Dữ liệu nhập vào bị bỏ trống hoặc sai định dạng. | 3b. Hệ thống thông báo lỗi chi tiết tại các trường tương ứng (ví dụ: Thư điện tử không đúng định dạng, Mật khẩu quá ngắn). |
| 5a. Địa chỉ thư điện tử đã tồn tại trên hệ thống. | 5b. Hệ thống từ chối đăng ký và hiển thị thông báo địa chỉ thư điện tử đã được sử dụng. |
| 8a. Dịch vụ chuyển phát thư điện tử gặp sự cố mạng tạm thời. | 8b. Hệ thống ghi nhật ký cảnh báo và hướng dẫn người dùng nhấn nút gửi lại mã sau 60 giây. |

---

### UC02: Khôi phục mật khẩu

- **Use case**: Khôi phục mật khẩu
- **Actor**: Khách hàng, Nhân viên, Quản trị viên
- **Mục tiêu**: Cấp lại quyền truy cập tài khoản khi người dùng quên mật khẩu thông qua mã xác thực một lần gửi qua thư điện tử.
- **Tài liệu tham chiếu**: Yêu cầu R1.3 (An toàn định danh và quản lý phiên)
- **Tiền điều kiện**: Tài khoản người dùng đã tồn tại trên hệ thống và không ở trạng thái bị khóa.
- **Hậu điều kiện**: Mật khẩu mới được cập nhật vào cơ sở dữ liệu, các phiên làm việc trước đó bị hủy bỏ an toàn.
- **Mô tả**: Người dùng yêu cầu cấp lại mật khẩu bằng địa chỉ thư điện tử. Hệ thống kiểm tra tài khoản, gửi mã xác thực một lần qua thư điện tử theo use case bao hàm UI01. Sau khi người dùng xác nhận mã chính xác, hệ thống cho phép thiết lập mật khẩu mới.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Người dùng bấm liên kết quên mật khẩu tại màn hình đăng nhập. | |
| 2. Nhập địa chỉ thư điện tử đã đăng ký và nhấn gửi mã xác nhận. | 3. Kiểm tra địa chỉ thư điện tử tồn tại trong cơ sở dữ liệu và tài khoản đang hoạt động bình thường. |
| | 4. Kích hoạt use case bao hàm UI01: Xác thực mã số một lần qua thư điện tử. |
| | 5. Hiển thị màn hình nhập mã xác thực và thiết lập mật khẩu mới. |
| 6. Nhập mã xác thực gồm 6 chữ số và mật khẩu mới hai lần. | |
| 7. Nhấn nút xác nhận đặt lại mật khẩu. | 8. Kiểm tra mã xác thực chính xác và còn trong thời hạn hiệu lực 5 phút. |
| | 9. Băm mật khẩu mới và cập nhật vào cơ sở dữ liệu. |
| | 10. Đánh dấu mã xác thực đã hoàn tất sử dụng, thông báo cập nhật thành công và chuyển về màn hình đăng nhập. |

##### 2. Luồng ngoại lệ
| Actions of human | Actions of system |
| :--- | :--- |
| 3a. Địa chỉ thư điện tử không tồn tại trong hệ thống. | 3b. Hệ thống thông báo không tìm thấy tài khoản tương ứng với thông tin đã nhập. |
| 3c. Tài khoản đang trong tình trạng bị khóa bởi quản trị viên. | 3d. Hệ thống từ chối thao tác và hiển thị thông báo tài khoản đang bị tạm khóa. |
| 8a. Mã xác thực nhập không chính xác hoặc đã hết thời gian hiệu lực. | 8b. Hệ thống tăng số lần thử sai, nếu vượt quá 5 lần sẽ tự động hủy hiệu lực mã xác thực. |

---

### UC03: Đăng nhập và đăng xuất hệ thống

- **Use case**: Đăng nhập và đăng xuất hệ thống
- **Actor**: Khách hàng, Nhân viên, Quản trị viên
- **Mục tiêu**: Xác thực danh tính người dùng, khởi tạo phiên làm việc bảo mật theo đúng vai trò hoặc chấm dứt phiên làm việc an toàn.
- **Tài liệu tham chiếu**: Yêu cầu R1.4, R1.5 (Kiểm soát truy cập và phân quyền vai trò)
- **Tiền điều kiện**: Người dùng đã sở hữu tài khoản hợp lệ đã kích hoạt trên hệ thống.
- **Hậu điều kiện**: Thiết lập phiên làm việc lưu trữ an toàn chứa thông tin quyền hạn của người dùng, hoặc xóa sạch phiên khi người dùng đăng xuất.
- **Mô tả**: Người dùng cung cấp địa chỉ thư điện tử và mật khẩu. Hệ thống đối chiếu chuỗi băm mật khẩu, tạo mã định danh phiên an toàn và điều hướng người dùng tới khu vực làm việc phù hợp với vai trò được giao.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Người dùng mở trang đăng nhập, điền thư điện tử và mật khẩu. | |
| 2. Nhấn nút đăng nhập. | 3. Kiểm tra tính đầy đủ và định dạng của dữ liệu nhập vào. |
| | 4. Tra cứu thông tin người dùng trong cơ sở dữ liệu theo thư điện tử. |
| | 5. Đối chiếu mật khẩu nhập vào với mật khẩu băm đã lưu trữ. |
| | 6. Kiểm tra tài khoản đã xác thực và không bị áp dụng biện pháp khóa tài khoản. |
| | 7. Tạo phiên làm việc bảo mật có thời hạn 7 ngày và gắn cờ bảo vệ an toàn. |
| | 8. Điều hướng người dùng tới giao diện mua sắm hoặc không gian quản trị tùy theo vai trò. |
| 9. (Khi đăng xuất) Người dùng nhấn nút đăng xuất trên thanh công cụ. | 10. Hệ thống xóa phiên làm việc và chuyển hướng về giao diện trang chủ. |

##### 2. Luồng ngoại lệ
| Actions of human | Actions of system |
| :--- | :--- |
| 4a. Không tìm thấy tài khoản hoặc mật khẩu không trùng khớp. | 4b. Hệ thống từ chối đăng nhập và thông báo thông tin xác thực không chính xác. |
| 6a. Tài khoản chưa hoàn tất xác thực kích hoạt qua thư điện tử. | 6b. Hệ thống thông báo và yêu cầu người dùng xác thực mã kích hoạt trước khi đăng nhập. |
| 6c. Tài khoản đang bị khóa do vi phạm quy chế hoạt động. | 6d. Hệ thống từ chối truy cập và thông báo tài khoản đang bị tạm ngưng hoạt động. |

---

### UC04: Tìm kiếm và xem sản phẩm

- **Use case**: Tìm kiếm và xem sản phẩm
- **Actor**: Khách hàng
- **Mục tiêu**: Cho phép người mua tra cứu danh mục, tìm kiếm theo tên và áp dụng các bộ lọc để chọn lựa sản phẩm phù hợp.
- **Tài liệu tham chiếu**: Yêu cầu R2.1 (Quản lý danh mục hàng hóa)
- **Tiền điều kiện**: Trong cơ sở dữ liệu có các sản phẩm đang được bật trạng thái kinh doanh công khai.
- **Hậu điều kiện**: Danh sách sản phẩm tương ứng được hiển thị phân trang trên màn hình của khách hàng.
- **Mô tả**: Khách hàng nhập từ khóa tìm kiếm hoặc bấm chọn các tiêu chí lọc về danh mục, khoảng giá, thứ tự sắp xếp. Hệ thống xử lý truy vấn và kết xuất danh sách sản phẩm trực quan.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Khách hàng truy cập trang chủ hoặc trang danh mục sản phẩm. | 2. Hệ thống tải dữ liệu và hiển thị danh sách sản phẩm nổi bật có phân trang. |
| 3. Nhập từ khóa cần tìm vào ô tìm kiếm hoặc chọn bộ lọc danh mục và mức giá. | |
| 4. Nhấn nút tìm kiếm hoặc chọn sắp xếp kết quả. | 5. Hệ thống truy vấn cơ sở dữ liệu theo các điều kiện lọc và tính toán số lượng trang kết quả. |
| | 6. Hiển thị danh sách sản phẩm gồm hình ảnh, tên sản phẩm, mức giá và điểm đánh giá trung bình. |

##### 2. Luồng ngoại lệ
| Actions of human | Actions of system |
| :--- | :--- |
| 5a. Không có sản phẩm nào thỏa mãn điều kiện lọc hoặc từ khóa tìm kiếm. | 5b. Hệ thống hiển thị thông báo không tìm thấy kết quả phù hợp và gợi ý các danh mục phổ biến. |

---

### UC05: Xem chi tiết và chọn biến thể sản phẩm

- **Use case**: Xem chi tiết và chọn biến thể sản phẩm
- **Actor**: Khách hàng
- **Mục tiêu**: Xem toàn bộ thông tin chi tiết, thư viện hình ảnh và lựa chọn biến thể màu sắc, kích cỡ phù hợp trước khi đưa vào giỏ hàng.
- **Tài liệu tham chiếu**: Yêu cầu R2.2 (Mô hình ma trận biến thể hàng hóa)
- **Tiền điều kiện**: Khách hàng nhấn chọn một sản phẩm từ danh mục hoặc kết quả tìm kiếm.
- **Hậu điều kiện**: Thông tin đơn giá, hình ảnh đại diện và số lượng tồn kho khả dụng được làm mới theo biến thể khách hàng vừa chọn.
- **Mô tả**: Khách hàng xem trang chi tiết sản phẩm. Khi lựa chọn các thuộc tính màu sắc và kích cỡ, hệ thống tự động xác định biến thể tương ứng, hiển thị giá bán và tình trạng còn hàng của mặt hàng đó.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Khách hàng nhấn chọn một sản phẩm để xem chi tiết. | 2. Hệ thống tải dữ liệu sản phẩm: mô tả, bộ ảnh, các tùy chọn thuộc tính và danh sách nhận xét. |
| 3. Bấm chọn màu sắc và kích cỡ mong muốn. | 4. Hệ thống tra cứu biến thể tương ứng trong cơ sở dữ liệu. |
| | 5. Cập nhật mức giá, số lượng tồn kho khả dụng và ảnh minh họa theo đúng lựa chọn. |
| 6. Nhập số lượng cần mua và nhấn nút thêm vào giỏ hàng hoặc nút mua ngay. | 7. Hệ thống cập nhật hàng vào giỏ theo use case UC06 hoặc chuyển thẳng tới giao diện đặt hàng theo use case UC07. |

##### 2. Luồng ngoại lệ
| Actions of human | Actions of system |
| :--- | :--- |
| 4a. Biến thể được chọn đã hết hàng trong kho. | 4b. Hệ thống làm mờ nút thêm vào giỏ hàng, hiển thị nhãn hết hàng và hướng dẫn khách chọn biến thể khác. |

---

### UC06: Quản lý giỏ hàng

- **Use case**: Quản lý giỏ hàng
- **Actor**: Khách hàng
- **Mục tiêu**: Điều chỉnh số lượng hàng hóa dự định mua, loại bỏ mặt hàng không có nhu cầu và kiểm tra tổng tiền tạm tính.
- **Tài liệu tham chiếu**: Yêu cầu R3.1 (Quản lý phiên mua sắm và giỏ hàng)
- **Tiền điều kiện**: Khách hàng đã thêm tối thiểu một sản phẩm vào giỏ hàng.
- **Hậu điều kiện**: Dữ liệu giỏ hàng được cập nhật đồng bộ và lưu trữ nhất quán trong cơ sở dữ liệu hoặc phiên làm việc của khách hàng.
- **Mô tả**: Khách hàng mở giỏ hàng, tăng giảm số lượng hoặc xóa bớt mặt hàng. Hệ thống kiểm tra số lượng tồn kho và tự động tính toán lại tổng số tiền hàng.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Khách hàng nhấn biểu tượng giỏ hàng trên thanh điều hướng. | 2. Hệ thống hiển thị danh sách các mặt hàng: ảnh, tên, biến thể đã chọn, đơn giá, số lượng và tổng tiền tạm tính. |
| 3. Khách hàng thay đổi số lượng từng món hàng bằng nút tăng giảm hoặc nhập số lượng mới. | 4. Hệ thống kiểm tra số lượng yêu cầu so với tồn kho khả dụng thực tế. |
| | 5. Tính toán lại tổng tiền hàng và cập nhật tức thì trên giao diện. |
| 6. Khách hàng nhấn nút tiến hành đặt hàng. | 7. Hệ thống chuyển hướng khách hàng sang quy trình đặt hàng theo use case UC07. |

##### 2. Luồng ngoại lệ
| Actions of human | Actions of system |
| :--- | :--- |
| 4a. Số lượng khách hàng yêu cầu vượt quá số lượng hàng có sẵn trong kho. | 4b. Hệ thống tự động giới hạn số lượng bằng mức tồn kho tối đa và hiển thị thông báo số lượng tồn kho có hạn. |
| 3a. Khách hàng nhấn nút xóa một mặt hàng khỏi giỏ. | 3b. Hệ thống loại bỏ mặt hàng ra khỏi giỏ và tính toán lại tổng tiền. |

---

### UC07: Đặt hàng sản phẩm (Trung tâm đặt hàng)

- **Use case**: Đặt hàng sản phẩm (Trung tâm đặt hàng)
- **Actor**: Khách hàng, Cổng thanh toán ngân hàng, Đơn vị vận chuyển Giao Hàng Nhanh
- **Mục tiêu**: Tạo lập đơn hàng chính thức, tạm khóa số lượng tồn kho nguyên tử, tự động tính cước giao hàng và cung cấp mã thanh toán QR động.
- **Tài liệu tham chiếu**: Yêu cầu R3.2, R3.3, R4.1 (Quy trình đặt hàng và giữ tồn kho nguyên tử)
- **Tiền điều kiện**: Giỏ hàng có ít nhất một mặt hàng hợp lệ, khách hàng đã cung cấp thông tin người nhận (họ tên, số điện thoại, địa chỉ nhận hàng).
- **Hậu điều kiện**: Đơn hàng được tạo trong cơ sở dữ liệu ở trạng thái chờ thanh toán, tồn kho bị tạm khóa 15 phút, mã thanh toán QR động được khởi tạo sẵn sàng cho việc thanh toán.
- **Mô tả**: Đây là use case trung tâm của phân hệ mua sắm. Quá trình đặt hàng bắt buộc thực hiện các use case bao hàm: kiểm tra giữ tồn kho nguyên tử (UI02), tính phí vận chuyển tự động (UI03), tạo mã phản hồi nhanh QR thanh toán động (UI04). Đồng thời được mở rộng tùy chọn bởi các use case: áp dụng mã giảm giá (UE01) và tự động điền địa chỉ qua định vị vệ tinh (UE02).

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Khách hàng bấm nút đặt hàng từ giỏ hàng. | 2. Hệ thống tải giao diện thông tin đơn hàng và danh sách sản phẩm. |
| 3. Điền địa chỉ nhận hàng (hoặc chọn kích hoạt use case mở rộng UE02: Tự động điền địa chỉ qua định vị vệ tinh). | 4. Gọi use case bao hàm UI03: Tính phí vận chuyển tự động thông qua kết nối với Đơn vị vận chuyển Giao Hàng Nhanh. |
| 5. Nhập mã giảm giá nếu có. | 6. (Nếu có mã) Kích hoạt use case mở rộng UE01: Áp dụng mã giảm giá để tính toán chiết khấu. |
| 7. Chọn phương thức thanh toán chuyển khoản qua mã phản hồi nhanh QR ngân hàng. | |
| 8. Kiểm tra lại toàn bộ thông tin và nhấn nút xác nhận đặt hàng. | 9. Thực thi use case bao hàm UI02: Kiểm tra và giữ tồn kho nguyên tử trong một giao dịch cơ sở dữ liệu an toàn. |
| | 10. Tạo bản ghi đơn hàng với trạng thái chờ thanh toán kèm thời hạn hiệu lực 15 phút. |
| | 11. Thực thi use case bao hàm UI04: Tạo mã phản hồi nhanh QR thanh toán động. |
| | 12. Hiển thị màn hình chi tiết đơn hàng cùng mã thanh toán QR mang nội dung chuyển khoản định danh riêng biệt. |
| 13. Khách hàng mở ứng dụng ngân hàng quét mã QR và hoàn tất chuyển khoản. | 14. Hệ thống tiếp nhận thông báo biến động số dư từ ngân hàng theo use case UC21 để tự động xác nhận chuyển đơn hàng sang trạng thái đã thanh toán. |

##### 2. Luồng ngoại lệ
| Actions of human | Actions of system |
| :--- | :--- |
| 9a. Số lượng tồn kho của một mặt hàng không còn đủ tại thời điểm đặt hàng do có người mua trước. | 9b. Hệ thống hoàn tác giao dịch, thông báo mặt hàng vừa hết và yêu cầu cập nhật lại giỏ hàng. |
| 4a. Kết nối tính cước vận chuyển đến đối tác gặp sự cố. | 4b. Hệ thống áp dụng bảng giá cước vận chuyển dự phòng mặc định để không làm gián đoạn việc mua sắm của khách hàng. |
| 14a. Khách hàng không chuyển khoản thanh toán trong thời hạn 15 phút. | 14b. Hệ thống kích hoạt tiến trình tự động theo use case UC23 để hủy đơn hàng và hoàn trả số lượng tồn kho khả dụng. |

---

### UC08: Thanh toán đơn bằng Ví nội bộ

- **Use case**: Thanh toán đơn bằng Ví nội bộ
- **Actor**: Khách hàng
- **Mục tiêu**: Thanh toán đơn hàng tức thì bằng số dư ví điện tử nội bộ đã tích hợp sẵn trong tài khoản.
- **Tài liệu tham chiếu**: Yêu cầu R4.3 (Hệ thống ví nội bộ và trừ tiền nguyên tử)
- **Tiền điều kiện**: Khách hàng đã đăng nhập và số dư khả dụng trong ví lớn hơn hoặc bằng tổng giá trị đơn hàng.
- **Hậu điều kiện**: Số dư ví bị trừ chính xác số tiền đơn hàng bằng cơ chế so sánh và cập nhật nguyên tử, đơn hàng chuyển ngay sang trạng thái đã thanh toán.
- **Mô tả**: Khách hàng chọn phương thức thanh toán bằng ví nội bộ tại bước đặt hàng. Hệ thống xác nhận số dư và thực hiện trừ tiền nguyên tử trong cơ sở dữ liệu để hoàn tất thanh toán ngay lập tức.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Tại bước lựa chọn thanh toán của use case UC07, khách hàng chọn thanh toán qua Ví nội bộ. | 2. Hệ thống kiểm tra và hiển thị số dư khả dụng hiện có của ví trên giao diện. |
| 3. Khách hàng nhấn nút xác nhận thanh toán bằng ví. | 4. Kiểm tra số dư ví lớn hơn hoặc bằng tổng tiền đơn hàng. |
| | 5. Bắt đầu giao dịch cơ sở dữ liệu: trừ tiền ví bằng cơ chế so sánh và cập nhật nguyên tử, ghi nhận nhật ký giao dịch ví, đổi trạng thái đơn hàng sang đã thanh toán. |
| | 6. Chuyển trạng thái tồn kho từ tạm khóa sang chính thức xuất bán. |
| | 7. Hiển thị thông báo thanh toán thành công và chuyển đơn hàng sang trạng thái chờ chuẩn bị đóng gói. |

##### 2. Luồng ngoại lệ
| Actions of human | Actions of system |
| :--- | :--- |
| 4a. Số dư trong ví nhỏ hơn tổng số tiền cần thanh toán. | 4b. Hệ thống thông báo số dư không đủ và cung cấp nút chuyển sang nạp tiền ví theo use case UC09. |
| 5a. Xảy ra xung đột tranh chấp dữ liệu khi nhiều thao tác diễn ra cùng lúc. | 5b. Hệ thống tự động thực hiện lại tối đa 3 lần; nếu không thành công sẽ hoàn tác và thông báo người dùng thực hiện lại. |

---

### UC09: Nạp tiền vào Ví qua mã thanh toán QR

- **Use case**: Nạp tiền vào Ví qua mã thanh toán QR
- **Actor**: Khách hàng, Cổng thanh toán ngân hàng
- **Mục tiêu**: Gia tăng số dư ví nội bộ bằng phương thức chuyển khoản ngân hàng tự động quét mã phản hồi nhanh QR.
- **Tài liệu tham chiếu**: Yêu cầu R4.2, R4.4 (Nạp tiền ví và đối soát ngân hàng)
- **Tiền điều kiện**: Khách hàng đã đăng nhập tài khoản trên hệ thống.
- **Hậu điều kiện**: Bản ghi yêu cầu nạp tiền được tạo lập; sau khi nhận thông báo có tiền từ ngân hàng, số dư ví khách hàng được cộng đủ 100% số tiền nạp.
- **Mô tả**: Khách hàng nhập số tiền cần nạp. Hệ thống tạo mã phản hồi nhanh QR động chứa thông tin tài khoản đích và cú pháp chuyển khoản riêng biệt. Khi khách hàng chuyển khoản, hệ thống tự động tiếp nhận dữ liệu đối soát và cộng tiền tức thời vào ví.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Khách hàng mở trang Quản lý Ví và chọn nút nạp tiền. | 2. Hệ thống hiển thị hộp thoại nạp tiền kèm các hạn mức gợi ý. |
| 3. Khách hàng nhập số tiền muốn nạp (tối thiểu 10.000 đồng) và bấm tạo mã nạp tiền. | 4. Tạo bản ghi giao dịch nạp tiền ở trạng thái chờ xử lý. |
| | 5. Khởi tạo mã phản hồi nhanh QR thanh toán động chứa số tài khoản, số tiền và nội dung chuyển khoản định danh. |
| | 6. Hiển thị mã QR và hướng dẫn thao tác quét mã cho khách hàng. |
| 7. Khách hàng mở ứng dụng ngân hàng quét mã và xác nhận chuyển khoản. | 8. Ngân hàng gửi dữ liệu biến động số dư tự động về hệ thống theo use case UC21. |
| | 9. Hệ thống kiểm tra hợp lệ, cộng tiền vào số dư ví và cập nhật trạng thái giao dịch nạp thành thành công. |
| | 10. Gửi thông báo trực tiếp theo thời gian thực tới giao diện của khách hàng xác nhận nạp tiền thành công. |

##### 2. Luồng ngoại lệ
| Actions of human | Actions of system |
| :--- | :--- |
| 3a. Số tiền nạp nhỏ hơn hạn mức tối thiểu cho phép. | 3b. Hệ thống thông báo lỗi số tiền nạp phải từ 10.000 đồng trở lên. |
| 8a. Khách hàng chuyển khoản sai cú pháp nội dung định danh. | 8b. Giao dịch được lưu vào hàng đợi chờ đối soát thủ công theo use case UC19 để quản trị viên kiểm tra và xử lý. |

---

### UC10: Hủy đơn hàng

- **Use case**: Hủy đơn hàng
- **Actor**: Khách hàng, Nhân viên, Quản trị viên
- **Mục tiêu**: Chấm dứt thực hiện đơn hàng khi đơn chưa bàn giao cho đơn vị vận chuyển, tự động giải phóng tồn kho và hoàn trả 100% tiền vào ví nội bộ nếu đơn đã được thanh toán.
- **Tài liệu tham chiếu**: Yêu cầu R3.4 (Vòng đời máy trạng thái đơn hàng và chính sách hoàn tiền)
- **Tiền điều kiện**: Đơn hàng đang ở trạng thái chờ thanh toán hoặc đã thanh toán nhưng chưa chuyển sang trạng thái đang giao hàng.
- **Hậu điều kiện**: Trạng thái đơn hàng chuyển sang đã hủy, số lượng hàng hóa được cộng hoàn trả lại kho, tiền thanh toán (nếu có) được cộng trả lại vào ví nội bộ của khách hàng.
- **Mô tả**: Người dùng xem chi tiết đơn hàng và bấm yêu cầu hủy đơn. Hệ thống kiểm tra tính hợp lệ theo máy trạng thái, hoàn trả tồn kho, khôi phục mã giảm giá và kích hoạt use case bao hàm UI05 để hoàn trả tiền vào ví nội bộ.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Khách hàng mở mục Lịch sử đơn hàng và chọn đơn cần hủy. | 2. Hệ thống kiểm tra trạng thái đơn: hợp lệ nếu đang ở trạng thái chờ thanh toán hoặc đã thanh toán. |
| 3. Khách hàng bấm nút hủy đơn hàng và chọn lý do hủy. | 4. Hiển thị hộp thoại xác nhận hủy đơn cùng thông tin chính sách hoàn trả. |
| 5. Nhấn xác nhận hoàn tất hủy đơn. | 6. Khởi chạy giao dịch cơ sở dữ liệu: chuyển trạng thái đơn hàng sang đã hủy. |
| | 7. Hoàn trả số lượng tồn kho khả dụng cho các biến thể hàng hóa tương ứng. |
| | 8. Khôi phục lượt sử dụng của mã giảm giá đã áp dụng (nếu có). |
| | 9. (Nếu đơn đã thanh toán) Kích hoạt use case bao hàm UI05: Hoàn trả toàn bộ tiền vào Ví nội bộ. |
| | 10. Gửi thông báo xác nhận hủy đơn thành công tới khách hàng. |

##### 2. Luồng ngoại lệ
| Actions of human | Actions of system |
| :--- | :--- |
| 2a. Đơn hàng đã được bàn giao vận chuyển hoặc đã hoàn tất giao nhận. | 2b. Hệ thống ẩn nút hủy đơn và thông báo đơn hàng đang được vận chuyển nên không thể tự hủy trực tiếp. |

---

### UC11: Quản lý danh sách yêu thích

- **Use case**: Quản lý danh sách yêu thích
- **Actor**: Khách hàng
- **Mục tiêu**: Lưu lại danh mục các sản phẩm quan tâm để tiện theo dõi giá bán và thực hiện mua hàng trong tương lai.
- **Tài liệu tham chiếu**: Yêu cầu R2.3 (Cá nhân hóa trải nghiệm người dùng)
- **Tiền điều kiện**: Khách hàng đã đăng nhập tài khoản.
- **Hậu điều kiện**: Mặt hàng được bổ sung hoặc loại bỏ khỏi danh sách yêu thích của người dùng.
- **Mô tả**: Khách hàng nhấn biểu tượng hình trái tim tại thẻ sản phẩm để lưu lại hoặc mở trang danh sách yêu thích để quản lý các sản phẩm đã đánh dấu.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Khách hàng nhấn vào biểu tượng trái tim tại một sản phẩm. | 2. Hệ thống kiểm tra trạng thái yêu thích hiện tại của sản phẩm đối với tài khoản. |
| | 3. Nếu chưa có, tạo bản ghi mới vào danh sách yêu thích; nếu đã có, thực hiện xóa khỏi danh sách. |
| | 4. Cập nhật trạng thái đổi màu biểu tượng và hiển thị thông báo phản hồi. |
| 5. Khách hàng bấm mở trang danh sách yêu thích từ thanh điều hướng cá nhân. | 6. Hệ thống hiển thị toàn bộ các sản phẩm đã đánh dấu kèm thông tin tồn kho tức thời. |

##### 2. Luồng ngoại lệ
| Actions of human | Actions of system |
| :--- | :--- |
| 1a. Khách hàng chưa đăng nhập khi bấm biểu tượng yêu thích. | 1b. Hệ thống yêu cầu chuyển sang màn hình đăng nhập và lưu lại trang hiện tại để quay lại sau khi hoàn tất. |

---

### UC12: Đánh giá và nhận xét sản phẩm

- **Use case**: Đánh giá và nhận xét sản phẩm
- **Actor**: Khách hàng
- **Mục tiêu**: Gửi điểm đánh giá từ 1 đến 5 sao kèm ý kiến nhận xét và hình ảnh phản hồi về chất lượng mặt hàng sau khi đã mua và nhận hàng thành công.
- **Tài liệu tham chiếu**: Yêu cầu R2.4 (Hệ thống đánh giá mua hàng có xác thực)
- **Tiền điều kiện**: Khách hàng đã mua sản phẩm đó và đơn hàng đang ở trạng thái đã hoàn tất giao hàng.
- **Hậu điều kiện**: Bản ghi đánh giá được ghi nhận vào cơ sở dữ liệu kèm huy hiệu người mua đã xác thực.
- **Mô tả**: Khách hàng mở lịch sử mua sắm, chọn đơn hàng đã hoàn tất giao hàng để chấm điểm số sao, viết nội dung nhận xét và đính kèm hình ảnh thực tế của sản phẩm.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Khách hàng vào danh sách đơn hàng đã mua, chọn đơn có trạng thái đã hoàn tất. | 2. Hệ thống kiểm tra mặt hàng trong đơn chưa từng được gửi đánh giá trước đó. |
| 3. Nhấn nút đánh giá sản phẩm. | 4. Hiển thị biểu mẫu đánh giá gồm thanh chọn số sao, ô nhập nhận xét và nút đính kèm ảnh. |
| 5. Chọn số sao, viết cảm nhận thực tế và nhấn gửi đánh giá. | 6. Kiểm tra tính hợp lệ của nội dung (độ dài tối thiểu 10 ký tự, không chứa từ ngữ phản cảm). |
| | 7. Lưu bản ghi nhận xét kèm nhãn xác thực đã mua hàng. |
| | 8. Tính toán lại điểm số sao trung bình của sản phẩm trong hệ thống. |
| | 9. Hiển thị thông báo cảm ơn khách hàng đã đóng góp ý kiến đánh giá. |

##### 2. Luồng ngoại lệ
| Actions of human | Actions of system |
| :--- | :--- |
| 2a. Khách hàng chưa mua sản phẩm hoặc đơn hàng chưa hoàn tất giao hàng. | 2b. Hệ thống khóa chức năng đánh giá và thông báo chỉ người mua đã nhận hàng thành công mới được gửi nhận xét. |

---

### UC13: Trò chuyện tư vấn trực tuyến thời gian thực

- **Use case**: Trò chuyện tư vấn trực tuyến thời gian thực
- **Actor**: Khách hàng, Nhân viên, Quản trị viên
- **Mục tiêu**: Trao đổi tin nhắn trực tiếp hai chiều giữa người mua và nhân viên chăm sóc khách hàng theo thời gian thực để hỗ trợ tư vấn và giải đáp thắc mắc.
- **Tài liệu tham chiếu**: Yêu cầu R5.1 (Kênh tương tác hỗ trợ khách hàng thời gian thực)
- **Tiền điều kiện**: Người dùng có kết nối mạng ổn định tới hệ thống máy chủ.
- **Hậu điều kiện**: Tin nhắn được lưu trữ đầy đủ trong cơ sở dữ liệu và hiển thị ngay lập tức trên màn hình của hai bên.
- **Mô tả**: Khách hàng bấm mở khung trò chuyện ở góc giao diện để đặt câu hỏi. Hệ thống kết nối tới phòng trực của nhân viên theo use case UC16 để trao đổi tin nhắn trực tiếp tức thì.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Khách hàng nhấn mở biểu tượng trò chuyện trên màn hình. | 2. Hệ thống thiết lập kênh kết nối dữ liệu thời gian thực riêng biệt cho người dùng. |
| 3. Khách hàng soạn nội dung tin nhắn và bấm nút gửi. | 4. Lưu bản ghi tin nhắn vào cơ sở dữ liệu. |
| | 5. Truyền phát sự kiện tin nhắn mới thời gian thực tới bàn trực tư vấn của nhân viên theo use case UC16. |
| 6. Nhân viên soạn câu trả lời và nhấn nút gửi. | 7. Hệ thống lưu tin nhắn phản hồi và truyền dữ liệu tức thì về khung trò chuyện của khách hàng. |
| 8. Khách hàng nhìn thấy tin nhắn trả lời ngay trên màn hình mà không cần tải lại trang. | |

##### 2. Luồng ngoại lệ
| Actions of human | Actions of system |
| :--- | :--- |
| 2a. Đường truyền kết nối mạng bị gián đoạn. | 2b. Hệ thống hiển thị thông báo đang thử kết nối lại và tự động phục hồi kết nối ngầm. |

---

# PHẦN II: PHÂN HỆ QUẢN TRỊ VÀ TỰ ĐỘNG HÓA

### UC14: Quản lý đơn hàng và duyệt chuyển trạng thái

- **Use case**: Quản lý đơn hàng và duyệt chuyển trạng thái
- **Actor**: Nhân viên, Quản trị viên, Đơn vị vận chuyển Giao Hàng Nhanh
- **Mục tiêu**: Giám sát toàn bộ đơn hàng, duyệt đóng gói, chuyển dịch trạng thái theo đúng quy tắc máy trạng thái và tự động liên kết với đối tác vận chuyển.
- **Tài liệu tham chiếu**: Yêu cầu R3.4, R6.1 (Quy trình quản lý đơn hàng và tự động hóa vận đơn)
- **Tiền điều kiện**: Nhân viên được cấp quyền truy cập phân hệ quản lý đơn hàng.
- **Hậu điều kiện**: Trạng thái đơn hàng chuyển dịch hợp lệ; mã vận đơn giao hàng được sinh và gán tự động thông qua use case bao hàm UI06.
- **Mô tả**: Nhân viên mở danh sách đơn, kiểm tra các đơn đã thanh toán để tiến hành đóng gói. Khi xác nhận xuất kho giao hàng, hệ thống tự động kích hoạt use case bao hàm UI06 để đẩy đơn sang Đơn vị vận chuyển Giao Hàng Nhanh và cập nhật trạng thái đơn sang đang giao hàng.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Nhân viên truy cập phân hệ Quản lý đơn hàng. | 2. Hệ thống tải bảng dữ liệu đơn hàng phân loại theo các trạng thái (chờ thanh toán, đã thanh toán, đang giao, đã hoàn tất, đã hủy). |
| 3. Chọn xem một đơn hàng đang ở trạng thái đã thanh toán. | 4. Hiển thị thông tin người nhận, danh sách hàng hóa cần đóng gói và bằng chứng thanh toán. |
| 5. Sau khi hoàn tất đóng gói, nhân viên nhấn nút duyệt giao hàng sang đối tác vận chuyển. | 6. Kích hoạt use case bao hàm UI06: Tạo vận đơn giao hàng tự động. |
| | 7. Lưu trữ mã vận đơn do đối tác giao hàng cấp phát vào thông tin đơn hàng. |
| | 8. Cập nhật trạng thái đơn hàng từ đã thanh toán sang đang giao hàng theo đúng quy tắc máy trạng thái. |
| | 9. Gửi thông báo qua thư điện tử và thông báo nổi cho khách hàng biết đơn hàng đang được vận chuyển. |

##### 2. Luồng ngoại lệ
| Actions of human | Actions of system |
| :--- | :--- |
| 5a. Thao tác chuyển đổi trạng thái vi phạm quy tắc máy trạng thái (ví dụ: chuyển từ chờ thanh toán thẳng sang hoàn tất). | 5b. Hệ thống từ chối thao tác và hiển thị cảnh báo chuyển đổi trạng thái không hợp lệ. |
| 6a. Kết nối tới đối tác giao hàng gặp lỗi hoặc địa chỉ nhận hàng không hợp lệ. | 6b. Hệ thống giữ nguyên trạng thái đơn hàng là đã thanh toán, hiển thị nguyên nhân lỗi để nhân viên kiểm tra và điều chỉnh. |

---

### UC15: Quản lý sản phẩm và kho hàng

- **Use case**: Quản lý sản phẩm và kho hàng
- **Actor**: Nhân viên, Quản trị viên
- **Mục tiêu**: Thêm mới, chỉnh sửa thông tin sản phẩm, quản lý ma trận biến thể màu sắc, kích thước và điều chỉnh số lượng hàng hóa trong kho.
- **Tài liệu tham chiếu**: Yêu cầu R2.1, R2.2 (Quản trị danh mục và ma trận biến thể)
- **Tiền điều kiện**: Người dùng có quyền truy cập nhóm tính năng sản phẩm trong hệ thống quản trị.
- **Hậu điều kiện**: Dữ liệu sản phẩm và số lượng tồn kho từng biến thể được lưu trữ nhất quán trong cơ sở dữ liệu.
- **Mô tả**: Nhân viên nhập thông tin sản phẩm mới, thiết lập các tùy chọn biến thể màu sắc và kích cỡ. Hệ thống tự động tạo ma trận biến thể hàng hóa để nhân viên điền giá bán và số lượng tồn kho tương ứng.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Nhân viên mở giao diện Quản lý sản phẩm. | 2. Hệ thống kết xuất bảng danh sách sản phẩm kèm bộ lọc danh mục và tình trạng tồn kho. |
| 3. Nhấn nút thêm sản phẩm mới (hoặc chọn chỉnh sửa sản phẩm có sẵn). | 4. Hiển thị biểu mẫu nhập liệu: tên sản phẩm, đường dẫn thân thiện, mô tả, danh mục, giá niêm yết, ảnh đại diện. |
| 5. Thiết lập danh sách thuộc tính biến thể (ví dụ: Màu sắc, Kích cỡ). | 6. Hệ thống tự động sinh ma trận các biến thể hàng hóa tương ứng. |
| 7. Nhập giá bán và số lượng nhập kho cho từng biến thể cụ thể. | |
| 8. Nhấn nút lưu thông tin sản phẩm. | 9. Kiểm tra tính hợp lệ của dữ liệu, thực hiện giao dịch lưu thông tin sản phẩm và các biến thể vào cơ sở dữ liệu. |
| | 10. Thông báo lưu sản phẩm thành công và cập nhật lại danh sách hiển thị. |

##### 2. Luồng ngoại lệ
| Actions of human | Actions of system |
| :--- | :--- |
| 8a. Tên sản phẩm bị trùng lặp đường dẫn định danh với sản phẩm đã có. | 8b. Hệ thống tự động sinh đuôi mã ngẫu nhiên bổ sung hoặc yêu cầu nhân viên đổi tên để đảm bảo tính duy nhất. |

---

### UC16: Trực bàn tư vấn khách hàng

- **Use case**: Trực bàn tư vấn khách hàng
- **Actor**: Nhân viên, Quản trị viên
- **Mục tiêu**: Tiếp nhận yêu cầu hỗ trợ từ khách hàng, giải đáp thắc mắc về sản phẩm và xử lý các vấn đề phát sinh của đơn hàng qua kênh trò chuyện trực tiếp.
- **Tài liệu tham chiếu**: Yêu cầu R5.1 (Giao diện bàn trực tư vấn thời gian thực)
- **Tiền điều kiện**: Nhân viên đăng nhập vào hệ thống và được phân quyền trực tư vấn.
- **Hậu điều kiện**: Nội dung trao đổi được ghi nhận đầy đủ vào nhật ký hội thoại.
- **Mô tả**: Giao diện hiển thị danh sách các phòng trò chuyện của khách hàng. Nhân viên nhấp chọn phòng, theo dõi lịch sử mua hàng của khách và phản hồi tin nhắn tức thời.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Nhân viên mở màn hình Bàn trực tư vấn. | 2. Hệ thống tải danh sách các cuộc hội thoại, hiển thị số tin nhắn chưa đọc và thời gian tin nhắn gần nhất. |
| 3. Nhấn chọn cuộc trò chuyện của một khách hàng cụ thể. | 4. Tải lịch sử trao đổi kèm thẻ tóm tắt thông tin khách hàng (họ tên, thư điện tử, đơn hàng gần đây). |
| 5. Nhập câu trả lời và nhấn nút gửi tin nhắn. | 6. Hệ thống lưu tin nhắn vào cơ sở dữ liệu và truyền trực tiếp thời gian thực tới màn hình của khách hàng theo use case UC13. |
| | 7. Đánh dấu cuộc hội thoại đã được xử lý phản hồi. |

---

### UC17: Kiểm duyệt đánh giá sản phẩm

- **Use case**: Kiểm duyệt đánh giá sản phẩm
- **Actor**: Quản trị viên
- **Mục tiêu**: Duyệt hiển thị các đánh giá hợp lệ của khách hàng hoặc ẩn các nhận xét có chứa ngôn từ phản cảm, quảng cáo không đúng quy định.
- **Tài liệu tham chiếu**: Yêu cầu R2.4 (Kiểm duyệt nội dung người dùng)
- **Tiền điều kiện**: Người thực hiện đăng nhập với vai trò Quản trị viên.
- **Hậu điều kiện**: Trạng thái kiểm duyệt của đánh giá được cập nhật vào cơ sở dữ liệu.
- **Mô tả**: Quản trị viên kiểm tra danh sách các đánh giá mới gửi, xem xét nội dung và ảnh đính kèm trước khi quyết định phê duyệt hiển thị công khai trên trang sản phẩm.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Quản trị viên mở trang Kiểm duyệt đánh giá. | 2. Hệ thống liệt kê các đánh giá mới nhận: số sao chấm điểm, nội dung nhận xét, người gửi, sản phẩm liên quan và ảnh đính kèm. |
| 3. Quản trị viên xem xét nội dung và nhấn nút duyệt hiển thị (hoặc nút ẩn nhận xét). | 4. Hệ thống cập nhật cờ trạng thái kiểm duyệt của bản ghi trong cơ sở dữ liệu. |
| | 5. Tính toán lại số sao đánh giá trung bình hiển thị ngoài trang sản phẩm công khai. |
| | 6. Thông báo cập nhật trạng thái kiểm duyệt thành công. |

---

### UC18: Giám sát doanh thu và bảng điều khiển tổng quan

- **Use case**: Giám sát doanh thu và bảng điều khiển tổng quan
- **Actor**: Quản trị viên
- **Mục tiêu**: Theo dõi trực quan toàn diện các chỉ số kinh doanh then chốt gồm doanh thu theo ngày và tháng, số lượng đơn hàng, biến động số dư và tỷ lệ đơn hủy trên bảng điều khiển lưới trực quan.
- **Tài liệu tham chiếu**: Yêu cầu R6.2 (Báo cáo kinh doanh và phân tích dữ liệu tổng quan)
- **Tiền điều kiện**: Người dùng đăng nhập với quyền hạn Quản trị viên.
- **Hậu điều kiện**: Toàn bộ dữ liệu doanh thu và vận hành được tổng hợp đầy đủ theo thời gian thực.
- **Mô tả**: Quản trị viên vào trang tổng quan quản trị. Hệ thống tổng hợp số liệu từ các bảng đơn hàng, giao dịch ví và hiển thị các khối tiện ích thông tin trực quan.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Quản trị viên mở trang Tổng quan quản trị. | 2. Hệ thống tổng hợp dữ liệu doanh số và hoạt động từ cơ sở dữ liệu. |
| | 3. Hiển thị khối tiện ích 1: Tổng doanh thu trong ngày và tỷ lệ tăng trưởng so với ngày trước. |
| | 4. Hiển thị khối tiện ích 2: Biểu đồ doanh thu 30 ngày (phân tách giữa nguồn chuyển khoản ngân hàng và nguồn thanh toán bằng ví). |
| | 5. Hiển thị khối tiện ích 3: Thống kê số lượng đơn hàng mới đang chờ xử lý và đã thanh toán. |
| | 6. Hiển thị khối tiện ích 4: Cảnh báo các giao dịch chuyển khoản chưa khớp cần đối soát thủ công. |
| 7. Quản trị viên chọn mốc thời gian lọc dữ liệu (7 ngày, tháng này, quý này). | 8. Hệ thống tính toán lại và làm mới các biểu đồ số liệu mà không cần tải lại toàn bộ trang. |

---

### UC19: Đối soát thủ công giao dịch chuyển khoản ngân hàng

- **Use case**: Đối soát thủ công giao dịch chuyển khoản ngân hàng
- **Actor**: Quản trị viên
- **Mục tiêu**: Xử lý khớp tay các khoản tiền chuyển khoản của khách hàng khi bị sai lệch nội dung định danh hoặc do thông báo từ ngân hàng bị trễ.
- **Tài liệu tham chiếu**: Yêu cầu R4.4 (Đối soát tài chính và xử lý sai lệch thanh toán)
- **Tiền điều kiện**: Tồn tại giao dịch tiền vào từ ngân hàng nhưng chưa được hệ thống tự động nhận diện khớp với đơn hàng hoặc yêu cầu nạp ví.
- **Hậu điều kiện**: Giao dịch ngân hàng được gán chính xác vào mã đơn hàng hoặc tài khoản ví, số tiền được xác nhận hợp lệ.
- **Mô tả**: Quản trị viên xem danh sách các giao dịch chuyển khoản chưa được khớp. Quản trị viên đối chiếu số tiền, tìm kiếm mã đơn hoặc số điện thoại của khách và bấm xác nhận khớp thủ công.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Quản trị viên truy cập màn hình Đối soát thanh toán. | 2. Hệ thống liệt kê danh sách các món tiền chưa được khớp tự động (kèm số tài khoản chuyển, số tiền và nội dung chuyển gốc). |
| 3. Quản trị viên tra cứu nội dung chuyển, tìm mã đơn hàng hoặc tài khoản ví cần khớp. | 4. Hiển thị thông tin đơn hàng đối ứng (mã đơn, người mua, số tiền phải thanh toán). |
| 5. Kiểm tra số tiền nhận đủ và nhấn nút xác nhận khớp thanh toán. | 6. Bắt đầu giao dịch cơ sở dữ liệu: đánh dấu giao dịch đã được khớp chính xác. |
| | 7. Chuyển trạng thái đơn hàng sang đã thanh toán và gỡ bỏ hạn giờ đếm ngược. |
| | 8. Ghi nhận nhật ký kiểm toán lưu vết danh tính quản trị viên đã thực hiện thao tác. |
| | 9. Thông báo thành công và đưa giao dịch ra khỏi danh sách chờ đối soát. |

##### 2. Luồng ngoại lệ
| Actions of human | Actions of system |
| :--- | :--- |
| 5a. Số tiền khách hàng chuyển khoản thiếu so với giá trị đơn hàng. | 5b. Hệ thống cảnh báo số tiền bị thiếu và yêu cầu quản trị viên xác nhận liên hệ khách hàng để chuyển bổ sung trước khi khớp đơn. |

---

### UC20: Phân quyền theo vai trò và quản lý người dùng

- **Use case**: Phân quyền theo vai trò và quản lý người dùng
- **Actor**: Quản trị viên
- **Mục tiêu**: Quản lý danh sách tài khoản, thiết lập vai trò (Khách hàng, Nhân viên, Quản trị viên), phân chia chi tiết các nhóm quyền hạn cho nhân viên và khóa các tài khoản vi phạm.
- **Tài liệu tham chiếu**: Yêu cầu R1.5 (Ma trận phân quyền vai trò và an ninh hệ thống)
- **Tiền điều kiện**: Người thực hiện là Quản trị viên cao nhất của hệ thống.
- **Hậu điều kiện**: Vai trò, quyền hạn hoặc trạng thái tài khoản của người dùng được cập nhật an toàn.
- **Mô tả**: Quản trị viên mở danh sách người dùng để phân công vai trò. Nếu chọn vai trò Nhân viên, Quản trị viên được tích chọn các nhóm quyền được phép truy cập (đơn hàng, sản phẩm, vận chuyển, trò chuyện, đánh giá). Hệ thống đảm bảo quy tắc an ninh không cho phép Quản trị viên tự tước quyền của chính mình khi là người quản trị duy nhất.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Quản trị viên mở trang Quản lý người dùng. | 2. Hệ thống hiển thị danh sách người dùng, vai trò hiện tại, ngày tạo và trạng thái hoạt động. |
| 3. Chọn tài khoản cần điều chỉnh và nhấn nút chỉnh sửa phân quyền. | 4. Hiển thị biểu mẫu chọn vai trò cùng bảng danh sách các nhóm quyền cụ thể dành cho nhân viên. |
| 5. Chọn vai trò Nhân viên và tích chọn các nhóm quyền cần phân công (ví dụ: đơn hàng, sản phẩm, trò chuyện). | |
| 6. Nhấn nút lưu thay đổi phân quyền. | 7. Kiểm tra các quy tắc an toàn bảo mật: Không cho phép Quản trị viên tự hạ quyền của bản thân khi là quản trị viên duy nhất, và không cho phép khóa tài khoản quản trị viên duy nhất. |
| | 8. Cập nhật vai trò và danh sách quyền hạn vào cơ sở dữ liệu. |
| | 9. Thu hồi các phiên làm việc cũ của tài khoản đó để bắt buộc áp dụng quyền hạn mới ở lần thao tác tiếp theo. |
| | 10. Thông báo cập nhật phân quyền thành công. |

##### 2. Luồng ngoại lệ
| Actions of human | Actions of system |
| :--- | :--- |
| 7a. Quản trị viên cố gắng tự đổi vai trò của bản thân khi hệ thống chỉ còn một tài khoản quản trị duy nhất. | 7b. Hệ thống từ chối thao tác và hiển thị cảnh báo không thể tự hạ quyền của quản trị viên duy nhất. |

---

### UC21: Tiếp nhận và xử lý biến động số dư ngân hàng

- **Use case**: Tiếp nhận và xử lý biến động số dư ngân hàng
- **Actor**: Cổng thanh toán ngân hàng
- **Mục tiêu**: Tiếp nhận thông báo tiền về từ hệ thống ngân hàng theo thời gian thực, xác thực mã an toàn và tự động khớp tiền cho đơn hàng hoặc nạp ví.
- **Tài liệu tham chiếu**: Yêu cầu R4.1, R4.2, R4.4 (Cơ chế tiếp nhận thanh toán và chống xử lý trùng lặp)
- **Tiền điều kiện**: Cổng thanh toán ngân hàng được cấu hình gửi thông báo dữ liệu tự động tới địa chỉ tiếp nhận của hệ thống.
- **Hậu điều kiện**: Giao dịch ngân hàng được lưu vết, đơn hàng chuyển sang đã thanh toán hoặc ví được cộng tiền, phản hồi kết quả xác nhận cho phía đối tác ngân hàng.
- **Mô tả**: Ngân hàng gửi gói dữ liệu báo có tiền. Hệ thống tiến hành xác thực mã an toàn, bóc tách nội dung chuyển khoản và kích hoạt use case bao hàm UI07 để xử lý khớp tiền tự động chống trùng lặp.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Phía đối tác ngân hàng phát tín hiệu truyền gửi danh sách các giao dịch chuyển khoản mới kèm mã bảo mật an toàn. | 2. Kiểm tra mã bảo mật an toàn khớp với khóa bí mật đã cấu hình. |
| | 3. Trích xuất danh sách từng giao dịch chuyển tiền. |
| | 4. Đối với mỗi giao dịch, gọi use case bao hàm UI07: Khớp tiền tự động chống trùng lặp. |
| | 5. Kiểm tra mã giao dịch ngân hàng chưa từng được xử lý nhằm ngăn chặn xử lý lặp lại. |
| | 6. Nhận diện mã đơn hàng hoặc mã nạp ví từ nội dung chuyển tiền. |
| | 7. Đối chiếu số tiền khớp đúng và cập nhật trạng thái đơn hàng sang đã thanh toán hoặc cộng số dư ví. |
| | 8. Truyền phát thông tin cập nhật tức thời về giao diện người dùng. |
| | 9. Phản hồi thông điệp tiếp nhận xử lý thành công cho phía đối tác ngân hàng. |

##### 2. Luồng ngoại lệ
| Actions of human | Actions of system |
| :--- | :--- |
| 2a. Mã bảo mật trong gói dữ liệu bị thiếu hoặc không chính xác. | 2b. Hệ thống lập tức từ chối tiếp nhận và ghi nhận cảnh báo an ninh. |
| 5a. Mã giao dịch đã được ghi nhận xử lý hoàn tất trước đó do đối tác gửi lặp. | 5b. Nhờ cơ chế chống trùng lặp, hệ thống bỏ qua bước cộng tiền và phản hồi kết quả thành công ngay để đối tác không gửi lại. |
| 6a. Nội dung chuyển khoản không tìm thấy mã đơn hàng hoặc mã ví hợp lệ. | 6b. Hệ thống lưu món tiền vào danh sách chờ đối soát thủ công theo use case UC19 để quản trị viên kiểm tra và xử lý. |

---

### UC22: Đồng bộ hành trình bưu kiện Giao Hàng Nhanh

- **Use case**: Đồng bộ hành trình bưu kiện Giao Hàng Nhanh
- **Actor**: Đơn vị vận chuyển Giao Hàng Nhanh
- **Mục tiêu**: Tiếp nhận cập nhật tiến độ vận chuyển (đang lấy hàng, đang giao hàng, giao thành công, giao thất bại) từ đối tác vận chuyển để tự động làm mới trạng thái đơn hàng.
- **Tài liệu tham chiếu**: Yêu cầu R3.4 (Đồng bộ hành trình giao nhận theo máy trạng thái)
- **Tiền điều kiện**: Đơn hàng đã có mã vận đơn giao hàng hợp lệ liên kết với đối tác.
- **Hậu điều kiện**: Tiến trình vận chuyển và trạng thái đơn hàng được cập nhật đồng bộ tức thời.
- **Mô tả**: Đối tác vận chuyển gửi dữ liệu cập nhật trạng thái gói hàng. Hệ thống lưu hành trình, nếu trạng thái là giao hàng thành công thì tự động chuyển đơn hàng sang trạng thái đã hoàn tất.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Phía Đơn vị vận chuyển Giao Hàng Nhanh gửi dữ liệu cập nhật hành trình bưu kiện (ví dụ: giao hàng thành công). | 2. Kiểm tra tính xác thực của dữ liệu từ đối tác vận chuyển. |
| | 3. Tra cứu bưu kiện trong hệ thống theo mã vận đơn tương ứng. |
| | 4. Ghi nhận lịch sử hành trình vận chuyển mới vào cơ sở dữ liệu. |
| | 5. Nếu trạng thái là giao hàng thành công, tự động chuyển đơn hàng sang đã hoàn tất và mở quyền cho khách hàng gửi đánh giá sản phẩm theo use case UC12. |
| | 6. Phản hồi xác nhận tiếp nhận thông tin thành công cho phía đối tác giao hàng. |

---

### UC23: Hủy đơn và hoàn tồn kho quá hạn tự động

- **Use case**: Hủy đơn và hoàn tồn kho quá hạn tự động
- **Actor**: Hệ thống lập lịch tự động
- **Mục tiêu**: Định kỳ rà soát các đơn hàng đang ở trạng thái chờ thanh toán đã vượt quá thời hạn 15 phút, tự động hủy đơn và giải phóng số lượng tồn kho đã tạm khóa trả về cho kho hàng.
- **Tài liệu tham chiếu**: Yêu cầu R3.2 (Giải phóng tồn kho và chống chiếm dụng kho hàng)
- **Tiền điều kiện**: Tiến trình lập lịch tự động chạy ngầm định kỳ theo chu kỳ thiết lập sẵn.
- **Hậu điều kiện**: Các đơn hàng quá hạn được chuyển sang trạng thái đã hủy, số lượng hàng hóa được hoàn trả nguyên vẹn về kho.
- **Mô tả**: Tác nhân lập lịch tự động quét cơ sở dữ liệu tìm các đơn hàng chờ thanh toán đã quá hạn. Với mỗi đơn tìm thấy, hệ thống thực hiện hủy đơn và hoàn trả tồn kho nguyên tử.

#### Kịch bản

##### 1. Luồng sự kiện chính
| Actions of human | Actions of system |
| :--- | :--- |
| 1. Hệ thống lập lịch tự động kích hoạt chu kỳ rà soát định kỳ. | 2. Truy vấn cơ sở dữ liệu tìm các đơn hàng đang ở trạng thái chờ thanh toán có thời gian hết hạn nhỏ hơn thời điểm hiện tại. |
| | 3. Nếu không có đơn hàng nào quá hạn, kết thúc chu kỳ quét. |
| | 4. Với mỗi đơn hàng quá hạn, mở giao dịch cơ sở dữ liệu để chuyển trạng thái đơn hàng sang đã hủy, hoàn trả số lượng hàng tồn kho cho từng biến thể sản phẩm trong đơn và khôi phục lượt sử dụng của mã giảm giá nếu có áp dụng. |
| | 5. Ghi nhận nhật ký: Tự động hủy đơn do quá thời hạn thanh toán 15 phút. |
| | 6. Hoàn tất chu kỳ rà soát. |

---

# PHẦN III: CÁC USE CASE PHỤ TRỢ (BAO HÀM VÀ MỞ RỘNG)

### UI01: Xác thực mã số một lần qua thư điện tử

- **Use case**: Xác thực mã số một lần qua thư điện tử
- **Actor**: Khách hàng
- **Mục tiêu**: Xác minh quyền sở hữu hòm thư điện tử bằng mã số bí mật gồm 6 chữ số có thời hạn hiệu lực 5 phút.
- **Tài liệu tham chiếu**: Yêu cầu R1.2 (Bảo mật định danh hai lớp)
- **Tiền điều kiện**: Được gọi từ use case UC01: Đăng ký tài khoản mới hoặc use case UC02: Khôi phục mật khẩu.
- **Hậu điều kiện**: Mã số bí mật được xác thực chính xác, đánh dấu đã hoàn tất sử dụng và kích hoạt trạng thái xác minh cho tài khoản.
- **Mô tả**: Đây là use case bao hàm. Hệ thống sinh ngẫu nhiên mã số gồm 6 chữ số, lưu trữ mã băm an toàn và chuyển phát thư điện tử tới khách hàng. Khách hàng nhập mã số, hệ thống đối chiếu và giới hạn tối đa 5 lần thử sai để chống dò mã.

---

### UI02: Kiểm tra và giữ tồn kho nguyên tử

- **Use case**: Kiểm tra và giữ tồn kho nguyên tử
- **Actor**: Khách hàng
- **Mục tiêu**: Tạm khóa số lượng hàng hóa trong kho cho đơn hàng trong thời hạn 15 phút một cách nguyên tử, ngăn chặn tuyệt đối tình trạng bán vượt quá số lượng hàng có thực trong kho.
- **Tài liệu tham chiếu**: Yêu cầu R3.2 (Bảo toàn số lượng tồn kho nguyên tử)
- **Tiền điều kiện**: Được gọi tự động trong quy trình use case UC07: Đặt hàng sản phẩm.
- **Hậu điều kiện**: Số lượng tồn kho khả dụng bị tạm trừ an toàn; nếu quá hạn 15 phút mà chưa thanh toán sẽ được hoàn lại bởi use case UC23.
- **Mô tả**: Đây là use case bao hàm. Thực thi trong một giao dịch cơ sở dữ liệu có điều kiện kiểm tra số lượng tồn lớn hơn hoặc bằng số lượng yêu cầu, bảo đảm tính toàn vẹn dữ liệu ngay cả khi có hàng trăm yêu cầu mua hàng diễn ra đồng thời.

---

### UI03: Tính phí vận chuyển tự động

- **Use case**: Tính phí vận chuyển tự động
- **Actor**: Khách hàng, Đơn vị vận chuyển Giao Hàng Nhanh
- **Mục tiêu**: Tự động tính toán chi phí vận chuyển bưu kiện dựa trên địa chỉ nhận hàng và khối lượng hàng hóa thông qua kết nối với Đơn vị vận chuyển Giao Hàng Nhanh.
- **Tài liệu tham chiếu**: Yêu cầu R3.3 (Tích hợp tính cước vận chuyển đối tác)
- **Tiền điều kiện**: Khách hàng đã cung cấp đủ thông tin Tỉnh/Thành phố, Quận/Huyện và Phường/Xã nhận hàng.
- **Hậu điều kiện**: Cước phí vận chuyển chính xác được cộng vào tổng số tiền thanh toán của đơn hàng.
- **Mô tả**: Đây là use case bao hàm trong luồng use case UC07: Đặt hàng sản phẩm. Hệ thống ánh xạ địa chỉ của khách hàng sang mã bưu cục tương ứng của đối tác vận chuyển và lấy về số tiền cước chuẩn xác.

---

### UI04: Tạo mã phản hồi nhanh QR thanh toán động

- **Use case**: Tạo mã phản hồi nhanh QR thanh toán động
- **Actor**: Khách hàng, Cổng thanh toán ngân hàng
- **Mục tiêu**: Tạo lập mã phản hồi nhanh QR thanh toán chứa sẵn số tài khoản thụ hưởng, số tiền chính xác từng đồng và nội dung chuyển khoản định danh riêng biệt.
- **Tài liệu tham chiếu**: Yêu cầu R4.1 (Quy chuẩn mã thanh toán nhanh ngân hàng)
- **Tiền điều kiện**: Đơn hàng hoặc giao dịch nạp ví đã được khởi tạo thành công kèm mã số cụ thể.
- **Hậu điều kiện**: Hình ảnh mã QR thanh toán được kết xuất hiển thị cho người mua thực hiện quét mã.
- **Mô tả**: Đây là use case bao hàm trong luồng use case UC07: Đặt hàng sản phẩm và use case UC09: Nạp tiền vào Ví. Mã QR được sinh tự động giúp khách hàng không phải nhập tay số tiền hay nội dung chuyển khoản, loại bỏ hoàn toàn các lỗi sai sót khi thực hiện thanh toán ngân hàng.

---

### UI05: Hoàn trả toàn bộ tiền vào Ví nội bộ

- **Use case**: Hoàn trả toàn bộ tiền vào Ví nội bộ
- **Actor**: Khách hàng
- **Mục tiêu**: Tự động hoàn lại đủ 100% số tiền đơn hàng đã thanh toán vào số dư ví nội bộ của người mua ngay khi việc hủy đơn hoàn tất.
- **Tài liệu tham chiếu**: Yêu cầu R3.4, R4.3 (Chính sách hoàn tiền tự động)
- **Tiền điều kiện**: Đơn hàng bị hủy theo use case UC10 hoặc use case UC23 đã được thanh toán thành công trước đó.
- **Hậu điều kiện**: Số dư ví nội bộ của khách hàng được cộng đủ toàn bộ giá trị đơn hàng, lịch sử ví ghi nhận giao dịch hoàn tiền.
- **Mô tả**: Đây là use case bao hàm trong luồng use case UC10: Hủy đơn hàng. Giúp khách hàng nhận lại tiền ngay tức thì mà không phải chờ đợi các thủ tục chuyển khoản ngân hàng thủ công kéo dài.

---

### UI06: Tạo vận đơn giao hàng tự động

- **Use case**: Tạo vận đơn giao hàng tự động
- **Actor**: Nhân viên, Đơn vị vận chuyển Giao Hàng Nhanh
- **Mục tiêu**: Tự động chuyển thông tin gói hàng sang Đơn vị vận chuyển Giao Hàng Nhanh khi nhân viên duyệt xuất kho, nhận về mã vận đơn giao hàng chính thức.
- **Tài liệu tham chiếu**: Yêu cầu R6.1 (Tự động hóa thủ tục giao nhận đối tác)
- **Tiền điều kiện**: Nhân viên nhấn xác nhận giao hàng tại use case UC14: Quản lý đơn hàng.
- **Hậu điều kiện**: Vận đơn giao hàng được khởi tạo thành công tại phía đối tác và mã vận đơn được lưu vết vào đơn hàng.
- **Mô tả**: Đây là use case bao hàm trong luồng use case UC14: Quản lý đơn hàng.

---

### UI07: Khớp tiền tự động chống trùng lặp

- **Use case**: Khớp tiền tự động chống trùng lặp
- **Actor**: Cổng thanh toán ngân hàng
- **Mục tiêu**: Xử lý đối soát và khớp giao dịch chuyển khoản ngân hàng với đơn hàng một cách chuẩn xác, bảo đảm chỉ thực hiện đúng một lần duy nhất và ngăn ngừa xử lý lặp lại.
- **Tài liệu tham chiếu**: Yêu cầu R4.1, R4.4 (Cơ chế xử lý giao dịch chống trùng lặp)
- **Tiền điều kiện**: Được kích hoạt từ use case UC21: Tiếp nhận và xử lý biến động số dư ngân hàng.
- **Hậu điều kiện**: Đơn hàng được ghi nhận đã thanh toán hoặc ví được nạp tiền duy nhất một lần, mọi dữ liệu gửi lặp từ phía đối tác đều được nhận diện và xử lý an toàn.
- **Mô tả**: Đây là use case bao hàm trong luồng use case UC21. Hệ thống sử dụng chỉ mục duy nhất trên mã giao dịch ngân hàng để loại bỏ hoàn toàn khả năng cộng tiền lặp lại.

---

### UE01: Áp dụng mã giảm giá

- **Use case**: Áp dụng mã giảm giá
- **Actor**: Khách hàng
- **Mục tiêu**: Cho phép người mua nhập mã ưu đãi để được chiết khấu giảm trừ trực tiếp trên tổng giá trị thanh toán của đơn hàng.
- **Tài liệu tham chiếu**: Yêu cầu R3.2 (Chính sách ưu đãi và chiết khấu)
- **Tiền điều kiện**: Khách hàng đang thao tác tại màn hình đặt hàng của use case UC07: Đặt hàng sản phẩm.
- **Hậu điều kiện**: Tổng số tiền thanh toán của đơn hàng được giảm trừ theo đúng tỷ lệ hoặc mức tiền quy định của mã giảm giá.
- **Mô tả**: Đây là use case mở rộng cho use case UC07: Đặt hàng sản phẩm. Đây là hành vi tùy chọn: khách hàng chỉ thực hiện khi có mã giảm giá. Hệ thống kiểm tra điều kiện hiệu lực của mã, giá trị đơn hàng tối thiểu và số lượt sử dụng còn lại trước khi áp dụng mức giảm trừ.

---

### UE02: Tự động điền địa chỉ qua định vị vệ tinh

- **Use case**: Tự động điền địa chỉ qua định vị vệ tinh
- **Actor**: Khách hàng
- **Mục tiêu**: Sử dụng vị trí tọa độ địa lý hiện tại của thiết bị người dùng để tự động nhận diện và điền nhanh Tỉnh/Thành phố, Quận/Huyện, Phường/Xã vào đơn hàng.
- **Tài liệu tham chiếu**: Yêu cầu R3.3 (Định vị thiết bị và hỗ trợ nhập địa chỉ thông minh)
- **Tiền điều kiện**: Khách hàng đang ở màn hình đặt hàng của use case UC07: Đặt hàng sản phẩm và cho phép thiết bị chia sẻ quyền vị trí.
- **Hậu điều kiện**: Các ô thông tin địa giới hành chính được điền tự động chính xác.
- **Mô tả**: Đây là use case mở rộng cho use case UC07: Đặt hàng sản phẩm. Đây là hành động tùy chọn nhằm rút ngắn thời gian điền thông tin của người mua. Hệ thống lấy tọa độ vị trí hiện tại, giải mã tọa độ sang tên địa chỉ hành chính tương ứng và điền sẵn vào đơn hàng.

---

*(Bản đặc tả đã được chuẩn hóa nghiêm ngặt về ngôn ngữ học thuật, đảm bảo toàn bộ tài liệu chỉ sử dụng các từ ngữ tiếng Anh duy nhất là use case, actor, actions of human và actions of system; đồng thời khớp hoàn toàn với cấu trúc 32 use case trong hồ sơ thiết kế).*
