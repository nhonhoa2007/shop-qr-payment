# Thiết kế lại UI chatbot — Panel nổi cao cấp

## Mục tiêu

Làm chatbot dễ đọc và dễ thao tác hơn trong khi giữ nguyên mascot Clawd, luồng tìm sản phẩm, chọn hai sản phẩm và bảng so sánh hiện có.

## Bố cục đề xuất

- Panel nổi ở góc phải, chiều rộng desktop khoảng 420–460px, chiều cao tối đa theo viewport.
- Header nền tối nhẹ với avatar Clawd, tên “Trợ lý mua sắm”, chấm trạng thái online và nhãn “Tìm & so sánh”. Nút đóng nằm tách ở góc phải.
- Khu vực tin nhắn dùng nền xám rất nhạt; tin người dùng căn phải với màu tím đậm, tin trợ lý căn trái trên nền trắng có viền mảnh.
- Câu trả lời có khoảng cách lớn hơn giữa nội dung, căn cứ shop, thẻ sản phẩm và nút gợi ý.
- Thẻ sản phẩm chuyển thành card gọn: ảnh lớn vừa đủ, tên tối đa hai dòng, giá và tồn kho nổi bật, nút “Xem” và “So sánh” tách biệt.
- Khu vực sản phẩm đã chọn hiển thị như thanh dock nhỏ phía trên ô nhập, có số lượng 0/2, chip sản phẩm và nút so sánh chính.
- Ô nhập có nền trắng, viền tím khi focus, nút gửi dạng nút tròn có icon; placeholder ngắn và rõ.
- Bảng so sánh giữ cuộn ngang nội bộ, thêm tiêu đề cố định và nhấn mạnh các hàng giá/tình trạng.

## Trạng thái

- Màn hình rỗng: avatar nhỏ, lời chào, mô tả một dòng và ba gợi ý truy vấn dạng chip.
- Đang tải: hiển thị “Đang tìm sản phẩm…” với dấu chấm chuyển động.
- Lỗi: banner đỏ nhạt nằm trong luồng tin nhắn, không làm thay đổi chiều cao panel.
- Có sản phẩm demo: giữ nhãn “Dữ liệu demo · Ảnh minh họa” ở card và bảng so sánh.
- Mobile: panel chiếm gần toàn bộ chiều rộng, vẫn có khoảng cách an toàn quanh mép màn hình; bảng chỉ cuộn bên trong.

## Phạm vi

Chỉ chỉnh UI trong `AssistantPanel`, `AssistantProductCards`, `AssistantComparison` và các icon/style cần thiết. Không thay đổi API, DTO, luồng hội thoại, tìm kiếm hay logic chọn sản phẩm.

## Tiêu chí kiểm tra

- Có thể mở/đóng panel và gửi tin nhắn như hiện tại.
- Card vẫn mở đúng trang sản phẩm; nút chọn vẫn giới hạn hai sản phẩm.
- Bảng so sánh không làm tràn trang trên mobile.
- Trạng thái loading, lỗi, lịch sử và nhãn demo vẫn nhìn rõ.
