/**
 * Seed dữ liệu DEMO bổ sung (chạy cộng dồn, không xóa dữ liệu cũ)
 *
 *   npm run seed:demo
 *
 * Tạo:
 *   - 24 khách hàng đăng ký trải 12 tháng (đưa newCustomersTrend vào dashboard sống động)
 *   - 20 sản phẩm mới (một phần có biến thể màu/size, Product.stock = tổng variant)
 *   - ~90 đơn hàng trải 30 ngày với đầy đủ trạng thái FSM + Transaction + Shipment
 *   - Reviews chỉ từ đơn COMPLETED, ví có số dư + giao dịch TOPUP, 3 coupon đang chạy
 * Sau cùng xóa cache Redis (products/categories/analytics) để dashboard và cửa hàng
 * phản ánh dữ liệu mới ngay lập tức.
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/server/modules/auth/password-hash.service.ts';
import { redis, invalidateAnalyticsCache } from '../src/server/infrastructure/redis.ts';

const prisma = new PrismaClient();

const VIETNAMESE_NAMES = [
  'Nguyễn Văn Hùng', 'Phạm Minh Tuấn', 'Trần Ngọc Anh', 'Lê Thu Hà', 'Vũ Đức Long',
  'Đặng Thị Hương', 'Bùi Quang Duy', 'Ngô Phương Linh', 'Dương Gia Bảo', 'Lý Mai Chi',
  'Phan Thanh Tâm', 'Hoàng Việt Anh', 'Trương Khánh Vy', 'Đỗ Trọng Nghĩa', 'Nguyễn Hà My',
  'Lâm Chí Cường', 'Võ Thảo Nguyên', 'Cao Minh Đức', 'Đinh Bảo Trân', 'Tạ Quốc Bảo',
  'Chu Ngọc Diệp', 'Tôn Nữ Yến Nhi', 'Lưu Gia Huy', 'Mạc Thanh Tùng',
];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function weighted<T>(entries: Array<[T, number]>): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[0][0];
}

// ─── TẠO ĐÁNH GIÁ CHÂN THỰC & CHÍNH XÁC THEO TỪNG MẶT HÀNG ───
function getProductSpecificReview(
  productName: string,
  category: string,
  rating: number
): { comment: string; reply: string | null } {
  const name = productName.toLowerCase();

  // 1. Phụ kiện nhỏ giá rẻ (<20k): Móc khóa, Sticker, Khăn lau, Dây buộc cáp, Tất vớ
  if (name.includes('sticker')) {
    if (rating === 5) {
      return {
        comment: pick([
          'Sticker in hình sắc nét, màu tươi, có lớp màng bóng chống nước tốt. Mình dán mũ bảo hiểm đi mưa mấy hôm vẫn bám rất chắc.',
          'Chất keo dính chắc chắn, lột ra không để lại vết keo dơ. Giá 5k quá rẻ để trang trí laptop và điện thoại.',
        ]),
        reply: 'Cảm ơn bạn đã yêu thích món quà nhỏ này của ShopQR nhé! Chúc bạn có những món đồ thật phong cách ❤️',
      };
    } else {
      return {
        comment: 'Sticker đẹp, keo dán chắc. Dán lên laptop và bình nước nhìn rất cá tính.',
        reply: 'Dạ shop cảm ơn bạn nhiều ạ! Lần sau bạn nhớ ghé shop sưu tầm thêm các mẫu mới nhé.',
      };
    }
  }

  if (name.includes('móc khóa')) {
    if (rating === 5) {
      return {
        comment: pick([
          'Móc khóa mica 2 mặt sáng bóng, dày dặn, hình in đẹp không trầy xước. Mua kèm test thanh toán QR rất tiện lợi.',
          'Móc khóa nhỏ gọn, viền cắt laser mịn màng không bén tay, khoen inox chắc chắn. 10k quá hời!',
        ]),
        reply: 'Cảm ơn bạn đã ủng hộ móc khóa ShopQR ạ! Món phụ kiện nhỏ xinh xắn cho balo và chùm chìa khóa ❤️',
      };
    } else {
      return {
        comment: 'Móc khóa xinh, khoen kim loại chắc chắn. Treo balo hay chìa khóa xe đều đẹp.',
        reply: 'Dạ shop cảm ơn bạn! Chúc bạn một ngày tràn đầy năng lượng ạ.',
      };
    }
  }

  if (name.includes('khăn lau')) {
    if (rating === 5) {
      return {
        comment: pick([
          'Khăn microfiber lau sạch bóng dầu nhờn và bụi bẩn trên mắt kính với điện thoại mà không hề để lại xơ vải.',
          'Vải microfiber mật độ cao siêu mềm mịn, lau ống kính camera không sợ trầy xước. Rất ưng ý!',
        ]),
        reply: 'Shop cảm ơn bạn đã tin dùng khăn lau chuyên dụng của shop ạ!',
      };
    } else {
      return {
        comment: 'Khăn mềm mịn, kích thước vừa tay, lau mắt kính và camera rất sạch.',
        reply: 'Dạ shop cảm ơn bạn nhiều! Bạn có thể giặt nhẹ bằng nước ấm để tái sử dụng lâu dài nhé.',
      };
    }
  }

  if (name.includes('dây buộc') || (name.includes('cáp') && name.includes('silicone'))) {
    if (rating === 5) {
      return {
        comment: pick([
          'Dây buộc cáp silicone mềm dẻo, nút cài chắc chắn giúp bàn làm việc gọn gàng hẳn. Giá 15k quá rẻ và tiện ích!',
          'Chất liệu silicone dẻo dai đàn hồi tốt, thu gọn đống dây sạc lòng thòng trong balo nhanh chóng.',
        ]),
        reply: 'Dạ Shop cảm ơn bạn nhiều! Món phụ kiện nhỏ nhưng mang lại tiện ích lớn cho góc làm việc ạ ❤️',
      };
    } else {
      return {
        comment: 'Dây cài chắc, chất liệu silicone mềm dai. Gom dây sạc điện thoại gọn gàng.',
        reply: 'Dạ shop cảm ơn bạn đã đánh giá! Chúc bạn có không gian làm việc luôn ngăn nắp nhé.',
      };
    }
  }

  if (name.includes('tất') || name.includes('vớ')) {
    if (rating === 5) {
      return {
        comment: pick([
          'Vớ cotton mềm, thoáng khí, đi êm chân không bị hôi, thun co giãn tốt không thít cổ chân.',
          'Chất 95% cotton dày dặn, đệm gót chống tuột tốt khi mang giày sneaker vận động cả ngày.',
        ]),
        reply: 'Shop cảm ơn bạn đã đánh giá! Chúc bạn luôn êm ái và thoải mái trên từng bước chân ạ 👟',
      };
    } else {
      return {
        comment: 'Chất vải cotton tốt, đệm gót bám tốt không bị tuột khi đi sneaker.',
        reply: 'Dạ shop cảm ơn bạn đã phản hồi! Shop luôn chú trọng chất liệu vải tự nhiên để bảo vệ chân tốt nhất ạ.',
      };
    }
  }

  // 2. Thiết bị công nghệ: Sạc dự phòng, Camera, Ổ cứng SSD, Đèn bàn, Bàn phím, Chuột, Tai nghe, Đồng hồ
  if (name.includes('sạc dự phòng') || name.includes('pin dự phòng')) {
    if (rating === 5) {
      return {
        comment: pick([
          'Sạc nhanh chuẩn PD 22.5W không bị nóng máy, nhỏ gọn dễ bỏ túi. Dung lượng 20.000mAh chuẩn sạc được nhiều lần.',
          'Màn hình LED hiển thị chính xác % pin, 3 cổng sạc tiện lợi cùng lúc cho cả điện thoại và tai nghe.',
        ]),
        reply: 'ShopQR cảm ơn bạn nhiều! Hàng chính hãng bảo hành 12 tháng nên bạn an tâm dùng nhé ⚡',
      };
    } else {
      return {
        comment: 'Sạc nhanh, màn hình LED hiển thị % pin trực quan. Cầm hơi đầm tay một chút.',
        reply: 'Dạ shop cảm ơn bạn! Dung lượng 20.000mAh thực tế cần cell pin lớn nên cầm sẽ đầm tay và chắc chắn ạ.',
      };
    }
  }

  if (name.includes('camera')) {
    if (rating === 5) {
      return {
        comment: pick([
          'Camera góc quay rộng 170 độ, video 2K ban đêm rõ biển số xe, kết nối WiFi xem lại trên điện thoại rất mượt mà.',
          'Độ phân giải 2K sắc nét, cảm biến ban đêm nhạy sáng tốt. Lắp đặt giấu dây gọn gàng, tự ghi đè khi thẻ nhớ đầy.',
        ]),
        reply: 'Shop cảm ơn bạn đã tin chọn camera hành trình của ShopQR! Chúc bạn vạn dặm bình an ạ 🚗',
      };
    } else {
      return {
        comment: 'Hình ảnh sắc nét, dễ lắp đặt. Ứng dụng điện thoại mượt mà, ghi hình vòng lặp ổn định.',
        reply: 'Dạ shop cảm ơn bạn đã phản hồi! Cần hỗ trợ kỹ thuật cài đặt thêm bạn cứ gọi hotline shop hỗ trợ ngay nhé.',
      };
    }
  }

  if (name.includes('ssd') || name.includes('ổ cứng')) {
    if (rating === 5) {
      return {
        comment: pick([
          'Tốc độ đọc ghi hơn 1000MB/s cực nhanh, sao chép file video 4K nặng mượt mà. Vỏ nhôm tản nhiệt mát mẻ, nhỏ như bao diêm.',
          'Kết nối Type-C cắm là nhận ngay trên cả MacBook lẫn Windows. Tốc độ truyền tải dữ liệu cực kỳ ấn tượng.',
        ]),
        reply: 'Cảm ơn bạn đã lựa chọn ổ cứng di động chính hãng tại ShopQR! Sản phẩm bảo hành 3 năm an tâm sử dụng ạ 💾',
      };
    } else {
      return {
        comment: 'Ổ cứng nhận diện nhanh trên cả MacBook và Win, cáp Type-C đi kèm chất lượng tốt.',
        reply: 'Dạ shop cảm ơn bạn! Vỏ nhôm nguyên khối giúp tản nhiệt tối ưu cho chip nhớ khi làm việc lâu ạ.',
      };
    }
  }

  if (name.includes('đèn')) {
    if (rating === 5) {
      return {
        comment: pick([
          'Đèn bàn ánh sáng dịu mắt, chỉ số hoàn màu CRI 95 không gây mỏi mắt khi làm việc buổi tối, cảm ứng chạm nhạy.',
          'Thiết kế tối giản sang trọng, có 3 chế độ nhiệt độ màu và hẹn giờ tắt rất tiện lợi cho học tập và làm việc.',
        ]),
        reply: 'Shop cảm ơn bạn đã đánh giá! Chúc bạn học tập và làm việc thật năng suất cùng ánh sáng dịu mắt nhé 💡',
      };
    } else {
      return {
        comment: 'Đèn thiết kế tối giản đẹp mắt, có 3 chế độ sáng tiện lợi. Pin tích điện dùng được khá lâu.',
        reply: 'Dạ shop cảm ơn bạn! Bạn có thể cắm sạc trực tiếp để độ sáng luôn đạt mức tối đa liên tục nhé ạ.',
      };
    }
  }

  if (name.includes('bàn phím') || name.includes('chuột')) {
    if (rating === 5) {
      return {
        comment: pick([
          'Bàn phím/chuột gõ cực đầm tay, switch linear êm ái không gây ồn, kết nối không dây 3 chế độ ổn định không độ trễ. LED RGB đẹp.',
          'Cảm biến quang học chính xác từng milimet, nút bấm nảy tanh tách, build chắc chắn không bị flex, pin dùng bền bỉ.',
        ]),
        reply: 'ShopQR cảm ơn bạn đã tin tưởng phụ kiện công nghệ của shop! Chúc bạn làm việc và giải trí thật năng suất ⌨️',
      };
    } else {
      return {
        comment: 'Cảm giác gõ/di chuột rất tốt, pin dùng lâu. Phần mềm tùy biến LED lúc đầu cần một chút thời gian làm quen.',
        reply: 'Dạ shop có sẵn file hướng dẫn cài đặt phần mềm chi tiết, bạn nhắn shop để shop gửi link hỗ trợ nhé ạ!',
      };
    }
  }

  if (name.includes('tai nghe') || name.includes('anc') || name.includes('tws')) {
    if (rating === 5) {
      return {
        comment: pick([
          'Chất âm rất trong, âm bass đánh chắc nịch, chống ồn chủ động ANC cách ly môi trường rất hiệu quả. Pin trâu dùng cả tuần.',
          'Độ trễ cực thấp xem phim chơi game mượt mà, đệm tai êm ái đeo nhiều giờ không bị cấn tai. Rất đáng tiền!',
        ]),
        reply: 'Cảm ơn bạn đã lựa chọn tai nghe chính hãng tại ShopQR! Sản phẩm được bảo hành 12 tháng nên bạn cứ yên tâm trải nghiệm nhé 🎧',
      };
    } else if (rating === 4) {
      return {
        comment: 'Chất âm hay, âm trường rộng, pin tốt. Mic đàm thoại ở nơi đông người hơi bắt tiếng ồn một chút.',
        reply: 'Dạ shop cảm ơn bạn! Ở nơi ồn ào bạn có thể bật chế độ lọc âm trên máy để đàm thoại rõ hơn nhé ạ.',
      };
    } else {
      return {
        comment: 'Nghe nhạc hay trong tầm giá, thời lượng pin ở mức vừa đủ dùng trong ngày. Đóng gói cẩn thận.',
        reply: 'Shop cảm ơn bạn đã phản hồi! Nếu cần hỗ trợ kỹ thuật bạn cứ liên hệ hotline bảo hành của shop nhé.',
      };
    }
  }

  if (name.includes('đồng hồ') || name.includes('band')) {
    if (rating === 5) {
      return {
        comment: pick([
          'Màn hình AMOLED hiển thị rõ ràng ngay cả ngoài trời nắng gắt, đo nhịp tim và bước chân chuẩn xác, pin trâu 5-7 ngày.',
          'Thiết kế thanh lịch, nhiều mặt đồng hồ đẹp, nhận thông báo tin nhắn và cuộc gọi tức thì.',
        ]),
        reply: 'Cảm ơn bạn đã đánh giá! Chúc bạn có những giờ phút rèn luyện sức khỏe hiệu quả cùng Smart Band nhé ⌚',
      };
    } else {
      return {
        comment: 'Đồng hồ nhẹ, đeo đi ngủ theo dõi giấc ngủ rất êm. Cần cải thiện thêm một vài giao diện mặt đồng hồ thể thao.',
        reply: 'Dạ hãng sẽ cập nhật thêm mặt đồng hồ mới qua các bản update firmware, bạn chú ý cập nhật app nhé ạ!',
      };
    }
  }

  // 3. Quần áo & Giày dép
  if (name.includes('áo') || name.includes('sơ mi') || name.includes('hoodie') || name.includes('thun') || name.includes('khoác')) {
    if (rating === 5) {
      return {
        comment: pick([
          'Chất vải mềm mịn, thoáng mát và co giãn tốt. Form áo mặc lên rất tôn dáng, đường may tỉ mỉ, giặt máy không bị xù lông.',
          'Vải cotton dệt dày dặn vừa vặn, form áo chuẩn như hình. Mua mặc đi làm hay dạo phố đều lịch sự và thoải mái.',
          'Đóng gói cẩn thận 2 lớp, vải thơm và không có chỉ thừa. Đúng chuẩn chất lượng cao cấp, sẽ ủng hộ shop tiếp!',
        ]),
        reply: 'Shop cảm ơn bạn nhiều ạ! Chúc bạn luôn tự tin và phong cách cùng set đồ của ShopQR ❤️',
      };
    } else if (rating === 4) {
      return {
        comment: 'Áo đẹp, chất vải tốt trong tầm giá. Bạn nào thích mặc rộng rãi thoải mái nên nhích lên 1 size nhé.',
        reply: 'Dạ ShopQR cảm ơn bạn đã góp ý! Lần tới bạn nhắn tin để shop tư vấn chuẩn size cho bạn nhé ạ.',
      };
    } else {
      return {
        comment: 'Chất vải tạm ổn trong tầm giá, giao hàng đúng hẹn. Cổ áo hơi ôm một chút so với sở thích của mình.',
        reply: 'Shop cảm ơn bạn đã phản hồi chân thành! Shop sẽ lưu ý để cải thiện bảng size và hình ảnh tốt hơn ạ.',
      };
    }
  }

  if (name.includes('quần') || name.includes('jeans') || name.includes('short') || name.includes('kaki')) {
    if (rating === 5) {
      return {
        comment: pick([
          'Chất vải co giãn nhẹ mặc vận động rất dễ chịu, cạp quần chắc chắn, form đứng dáng tôn chân.',
          'Quần đẹp, chất denim/kaki dày dặn mà không bị cứng, giặt không bị phai màu ra các đồ khác.',
        ]),
        reply: 'Cảm ơn bạn đã tin tưởng sản phẩm quần thời trang của ShopQR! Chúc bạn có trải nghiệm tuyệt vời ạ ❤️',
      };
    } else {
      return {
        comment: 'Vải đẹp, form chuẩn. Chiều dài quần hơi dài một tí so với mình, cắt gấu lại là vừa vặn hoàn hảo.',
        reply: 'Dạ shop cảm ơn bạn đã góp ý! Lần sau bạn có thể nhắn chiều cao để shop hỗ trợ tư vấn độ dài phù hợp nhé.',
      };
    }
  }

  if (name.includes('giày') || name.includes('sneaker') || name.includes('loafers')) {
    if (rating === 5) {
      return {
        comment: pick([
          'Đế giày siêu êm chân và nhẹ, bám đường tốt, đi bộ cả ngày không bị đau gót hay mỏi chân.',
          'Chất liệu da/vải cao cấp, mũi giày bo tròn đẹp, đường keo dán sắc nét không bị thừa. Quét VietQR nhận đơn giao nhanh.',
        ]),
        reply: 'Shop cảm ơn bạn đã ủng hộ giày của ShopQR! Chúc bạn có những bước chân thật êm ái và tự tin ạ 👟',
      };
    } else {
      return {
        comment: 'Giày đi êm, đúng kích cỡ. Hộp giày hơi móp một chút do bên chuyển phát nhanh nhưng giày bên trong nguyên vẹn.',
        reply: 'Dạ shop sẽ làm việc lại với bên vận chuyển để bọc chống sốc hộp giày kỹ hơn nữa. Cảm ơn bạn!',
      };
    }
  }

  // 4. Gia dụng & Đời sống: Máy pha cà phê, Dao, Bình giữ nhiệt, Ly, Nồi, Máy xay, Thảm yoga, Nến thơm
  if (name.includes('cà phê')) {
    return {
      comment: rating === 5
        ? 'Chiết xuất cà phê 20 bar đậm đà chuẩn vị, lớp bọt crema béo ngậy. Vòi đánh sữa tạo bọt mịn làm latte rất thích.'
        : 'Máy pha cà phê nhỏ gọn, dễ thao tác và vệ sinh. Khi bắt đầu bơm áp suất tiếng máy hơi kêu một chút.',
      reply: 'Shop cảm ơn bạn! Chúc bạn mỗi sáng đều có những tách cà phê thơm ngon tuyệt hảo ☕',
    };
  }

  if (name.includes('dao')) {
    return {
      comment: rating === 5
        ? 'Lưỡi thép Damascus 67 lớp cực kỳ sắc bén, thái thịt cá ngọt lịm, cán gỗ mun tự nhiên cầm đầm tay không bị trơn.'
        : 'Bộ dao đầy đủ kích thước từ thái đến gọt hoa quả, hoàn thiện tinh xảo, kéo cắt gà cũng rất bén.',
      reply: 'Shop cảm ơn bạn đã tin dùng bộ dao làm bếp cao cấp của ShopQR ạ 🔪',
    };
  }

  if (name.includes('bình giữ nhiệt')) {
    return {
      comment: rating === 5
        ? 'Bình giữ nhiệt inox 316 giữ đá qua đêm vẫn còn nguyên, nắp đậy khít không bị rò nước ra ngoài khi để nghiêng trong balo.'
        : 'Sơn tĩnh điện nhám cầm chắc tay không bám vân tay, giữ nóng cả ngày dài rất ưng ý.',
      reply: 'Shop cảm ơn bạn! Chúc bạn luôn có đồ uống thơm ngon và nhiệt độ như ý suốt cả ngày ạ 💧',
    };
  }

  if (name.includes('ly thủy tinh') || name.startsWith('ly ') || name.includes('cốc')) {
    return {
      comment: rating === 5
        ? 'Ly thủy tinh 2 lớp cách nhiệt borosilicate cầm không bị nóng tay khi rót nước sôi, không bị toát mồ hôi khi uống nước đá.'
        : 'Ly đẹp tinh tế, đóng gói hộp xốp chống sốc rất cẩn thận, dùng uống trà hay cà phê đều sang.',
      reply: 'Shop cảm ơn bạn đã lựa chọn ly thủy tinh hai lớp của ShopQR ạ ❤️',
    };
  }

  if (name.includes('nồi')) {
    return {
      comment: rating === 5
        ? 'Bộ nồi inox 304 sáng bóng, đáy 3 lớp bắt từ siêu nhanh, nắp kính cường lực trong suốt dễ quan sát thức ăn khi nấu.'
        : 'Nồi dày dặn, quai cầm chắc chắn không bị nóng khi nấu. Dùng trên bếp từ rất nhạy.',
      reply: 'Shop cảm ơn bạn đã trang bị bộ nồi chất lượng cho gian bếp gia đình ạ 🍲',
    };
  }

  if (name.includes('xay') || name.includes('sinh tố')) {
    return {
      comment: rating === 5
        ? 'Cối thủy tinh dày dặn chịu lực, 4 lưỡi dao sắc bén xay sinh tố và nghiền đá nhuyễn mịn chỉ trong 30 giây.'
        : 'Máy xay khỏe, dễ tháo lắp cọ rửa. Chạy số lớn nhất tiếng máy hơi to một chút nhưng xay rất nhanh.',
      reply: 'Shop cảm ơn bạn nhiều! Chúc bạn và gia đình có những ly sinh tố thơm mát bổ dưỡng ạ 🥤',
    };
  }

  if (name.includes('thảm yoga')) {
    return {
      comment: rating === 5
        ? 'Chất liệu TPE 2 lớp êm ái 6mm đàn hồi tốt, bám sàn chống trượt cực kỳ an toàn, có vạch kẻ định tuyến hỗ trợ tư thế.'
        : 'Thảm nhẹ, không có mùi hôi nhựa, cuộn lại gọn gàng có kèm dây đeo tiện mang đi tập.',
      reply: 'Shop chúc bạn luôn có những buổi tập yoga và rèn luyện sức khỏe thật thư thái ạ 🧘',
    };
  }

  if (name.includes('nến')) {
    return {
      comment: rating === 5
        ? 'Sáp đậu nành thiên nhiên cháy sạch không khói đen, hương oải hương dịu nhẹ lan tỏa khắp phòng giúp ngủ ngon hơn.'
        : 'Hũ thủy tinh sang trọng, bấc gỗ khi cháy kêu tách tách nghe rất thư giãn.',
      reply: 'Shop cảm ơn bạn! Chúc bạn có những phút giây thư giãn bình yên trong không gian thơm mát ạ 🕯️',
    };
  }

  // 5. Phụ kiện: Balo, Ví, Kính râm, Mặt nạ, Chăn ga
  if (name.includes('balo')) {
    return {
      comment: rating === 5
        ? 'Balo vải Oxford dày dặn chống nước tốt, ngăn laptop có đệm khí êm ái chống sốc. Quai đeo có đệm mút không đau vai khi mang nặng.'
        : 'Nhiều ngăn tiện lợi, đường may tỉ mỉ, khóa kéo YKK êm mượt.',
      reply: 'Shop cảm ơn bạn! Chúc balo đồng hành cùng bạn trên mọi hành trình làm việc và du lịch ạ 🎒',
    };
  }

  if (name.includes('ví')) {
    return {
      comment: rating === 5
        ? 'Ví da bò thật mềm tay, đường may thủ công tỉ mỉ, kích thước nhỏ gọn vừa túi quần mà đựng được nhiều thẻ ngân hàng.'
        : 'Da thật thơm mùi thuộc da tự nhiên, ngăn thẻ chắc chắn không bị lỏng lẻo.',
      reply: 'Shop cảm ơn bạn đã lựa chọn ví da thủ công của ShopQR ạ 👛',
    };
  }

  if (name.includes('kính')) {
    return {
      comment: rating === 5
        ? 'Tròng kính phân cực Polarized chống chói lóa khi lái xe trời nắng rất tốt, gọng titan siêu nhẹ đeo không đau sống mũi.'
        : 'Mắt kính thời trang, chống tia UV400 chuẩn, kèm hộp đựng và khăn lau đầy đủ.',
      reply: 'Shop cảm ơn bạn! Chúc bạn luôn tự tin và an toàn trên mọi cung đường ạ 🕶️',
    };
  }

  if (name.includes('mặt nạ')) {
    return {
      comment: rating === 5
        ? 'Thiết kế 3D ôm khít khuôn mặt nhưng không chạm môi, lọc bụi mịn than hoạt tính tốt, dây đeo êm tai không bị hằn.'
        : 'Chất liệu thoáng khí, dùng khi đi xe máy ngoài đường giảm mùi khói bụi rõ rệt.',
      reply: 'Shop cảm ơn bạn đã tin chọn sản phẩm bảo vệ sức khỏe của ShopQR ạ 😷',
    };
  }

  if (name.includes('chăn') || name.includes('ga')) {
    return {
      comment: rating === 5
        ? 'Chất cotton poly mềm mịn, không phai màu hay xù lông sau khi giặt, hoa văn nhã nhặn sang trọng.'
        : 'Vải thoáng mát, kích thước chuẩn vừa vặn với đệm giường. Đóng gói túi kéo gọn gàng.',
      reply: 'Shop cảm ơn bạn! Chúc bạn có những giấc ngủ thật êm ái và trọn vẹn ạ 🛏️',
    };
  }

  // 6. Mặc định theo category
  if (rating === 5) {
    return {
      comment: 'Sản phẩm hoàn thiện tỉ mỉ, chất lượng xuất sắc đúng như mô tả. Đóng gói 2 lớp chống sốc cẩn thận, giao hàng rất nhanh.',
      reply: 'ShopQR cảm ơn bạn đã tin tưởng và ủng hộ sản phẩm của shop! Chúc bạn nhiều trải nghiệm tuyệt vời ❤️',
    };
  } else {
    return {
      comment: 'Sản phẩm hoàn thiện đẹp, giao hàng nhanh. Sẽ tiếp tục theo dõi các chương trình khuyến mại của shop.',
      reply: 'Dạ shop cảm ơn bạn nhiều! Bạn nhớ lưu mã giảm giá cho đơn hàng tiếp theo nhé ạ.',
    };
  }
}

// ─── 20 sản phẩm mới (ảnh Unsplash, một phần có biến thể) ───
const NEW_PRODUCTS: Array<{
  name: string; description: string; price: number; image: string; category: string;
  stock: number; variants?: Array<{ sku: string; title: string; price: number; stock: number; color?: string; size?: string }>;
}> = [
  { name: 'Áo sơ mi linen Dễ Thở Mùa Hè', description: 'Sơ mi linen nguyên chất thoáng mát, form regular thanh lịch, phù hợp công sở và dạo phố mùa hè.', price: 359000, image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=600&q=80', category: 'Thời trang', stock: 0, variants: [
    { sku: 'SHIRT-LINEN-WHITE', title: 'Trắng / L', price: 359000, stock: 12, color: 'Trắng', size: 'L' },
    { sku: 'SHIRT-LINEN-BEIGE', title: 'Be / L', price: 359000, stock: 9, color: 'Be', size: 'L' },
    { sku: 'SHIRT-LINEN-NAVY', title: 'Xanh navy / XL', price: 379000, stock: 7, color: 'Xanh navy', size: 'XL' },
  ] },
  { name: 'Hoodie nỉ bông Unisex Form Rộng', description: 'Nỉ bông 350gsm ấm áp, form oversized unisex, in lụa chi tiết sắc nét, túi kangaroo tiện dụng.', price: 449000, image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=600&q=80', category: 'Thời trang', stock: 0, variants: [
    { sku: 'HOODIE-BLACK-M', title: 'Đen / M', price: 449000, stock: 15, color: 'Đen', size: 'M' },
    { sku: 'HOODIE-GREY-L', title: 'Xám / L', price: 449000, stock: 11, color: 'Xám', size: 'L' },
  ] },
  { name: 'Quần short kaki Thể thao Nhanh Khô', description: 'Vải polyester thoát hơi nước cực nhanh, đai thun co giãn có dây rút, túi khóa an toàn khi vận động.', price: 219000, image: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=600&q=80', category: 'Thời trang', stock: 40 },
  { name: 'Giày loafers Da Thuật Nam', description: 'Da bò thuật thật Soft Hand, đế cao su chống trượt, may Blake thủ công, sang trọng đi làm và đi lễ.', price: 890000, image: 'https://images.unsplash.com/photo-1614252369475-531eba835eb1?auto=format&fit=crop&w=600&q=80', category: 'Thời trang', stock: 14 },
  { name: 'Tai nghe True Wireless TWS Pro', description: 'Tai nghe true-wireless Bluetooth 5.3, hộp sạc hiển thị pin, độ trễ thấp chơi game, chống mồ hôi IPX5.', price: 590000, image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80', category: 'Công nghệ', stock: 26 },
  { name: 'Đèn bàn LED Sense Chạm thông minh', description: '3 sắc độ chạm cảm ứng, pin sạc 2000mAh dùng 15 giờ, chân hợp kim nhôm tĩnh điện sang trọng.', price: 329000, image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=600&q=80', category: 'Công nghệ', stock: 22 },
  { name: 'Ổ cứng SSD Di động 1TB Type-C', description: 'Tốc độ đọc 1050MB/s, thân nhôm tản nhiệt, tương thích máy tính và điện thoại Type-C, bảo hành 3 năm.', price: 1590000, image: 'https://images.unsplash.com/photo-1624705002806-5d72df19c3ad?auto=format&fit=crop&w=600&q=80', category: 'Công nghệ', stock: 10 },
  { name: 'Camera hành trình ô tô WiFi 2K', description: 'Quay 2K siêu nét ban ngày lẫn ban đêm, góc rộng 170°, kết nối WiFi xem trực tiếp trên điện thoại.', price: 1190000, image: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=600&q=80', category: 'Công nghệ', stock: 8 },
  { name: 'Balo máy ảnh chống sốc 25L', description: 'Ngăn máy ảnh tháo lắp vách xốp, chống sốc chuẩn hãng, khoá YKK bền, vải chống nước kéo dài.', price: 749000, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80', category: 'Phụ kiện', stock: 17 },
  { name: 'Ví da thật Nam Handmade', description: 'Da bò thật 100% thuộc da thủ công, 8 ngăn thẻ + ngăn tiền, đường may tay chắc chắn, mạ logo thép.', price: 279000, image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80', category: 'Phụ kiện', stock: 30 },
  { name: 'Mặt nạ kính Hàn Quốc 3D', description: 'Chất liệu nhựa ABS an toàn, lọc khí than hoạt tính, dây co giãn êm tai, dùng cho mùa khói bụi và đi xe máy.', price: 149000, image: 'https://images.unsplash.com/photo-1584646098378-0874589d76b1?auto=format&fit=crop&w=600&q=80', category: 'Phụ kiện', stock: 48 },
  { name: 'Sạc dự phòng 20.000mAh 22.5W', description: 'Sạc nhanh PD 22.5W, 3 cổng xuất cùng lúc, màn hình LED % pin, an toàn 12 lớp bảo vệ mạch.', price: 465000, image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=600&q=80', category: 'Công nghệ', stock: 33 },
  { name: 'Bộ nồi Inox 3 đáy cao cấp (3 chiếc)', description: 'Inox 304 sáng bóng, đáy từ 3 lớp bắt từ tính, dùng được cho bếp từ và bếp gas, chịu nhiệt cao.', price: 990000, image: 'https://images.unsplash.com/photo-1584990347449-a2d4c2c9d422?auto=format&fit=crop&w=600&q=80', category: 'Gia dụng & Đời sống', stock: 15 },
  { name: 'Máy xay sinh tố Thủy lực 1.5L', description: 'Cối thủy tinh chịu nhiệt, 4 lưỡi thép không gỉ, 2 cấp độ xay + chế độ nghiền đá, động cơ 100% đồng.', price: 549000, image: 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=600&q=80', category: 'Gia dụng & Đời sống', stock: 19 },
  { name: 'Chăn ga gối Cotton Poly cao cấp', description: 'Vải cotton poly mềm mịn, thấm hút tốt, hoa văn sang trọng, an toàn cho da nhạy cảm, đủ size giường.', price: 690000, image: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80', category: 'Gia dụng & Đời sống', stock: 13 },
  { name: 'Nến thơm Soy Wax Hương Oải Hương', description: 'Sáp đậu nành thiên nhiên cháy 30 giờ, tinh dầu oải hương thư giãn, hũ thủy tinh cao cấp tái sử dụng.', price: 189000, image: 'https://images.unsplash.com/photo-1602874801007-aa76c0806e69?auto=format&fit=crop&w=600&q=80', category: 'Gia dụng & Đời sống', stock: 44 },
  { name: 'Thảm yoga TPE 2 lớp chống Trượt 6mm', description: 'TPE thân thiện môi trường, 2 mặt texture chống trượt, vạch căn chỉnh tư thế, kèm dây cuộn tiện mang.', price: 259000, image: 'https://images.unsplash.com/photo-1592432678016-e910b452f9a2?auto=format&fit=crop&w=600&q=80', category: 'Gia dụng & Đời sống', stock: 28 },
  { name: 'Áo khoác gió Vải Kaki Nam Nữ', description: 'Vải kaki membrane chống nước nhẹ, form unisex oversize, nhiều túi zippers, mặc đi chơi và đi phượt.', price: 429000, image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80', category: 'Thời trang', stock: 21 },
  { name: 'Chuột gaming không dây 18.000 DPI', description: 'Cảm biến quang học 18K DPI, 6 nút lập trình, đèn RGB 16.8 triệu màu, pin dùng 70 giờ một lần sạc.', price: 690000, image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=600&q=80', category: 'Công nghệ', stock: 16 },
  { name: 'Ly thủy tinh Double Wall 300ml (2 chiếc)', description: 'Thủy tinh borosilicate 2 lớp giữ nhiệt, không cực khí bề mặt, hộp quà tặng sang trọng, dùng được máy rửa chén.', price: 165000, image: 'https://images.unsplash.com/photo-1514228740026-e6facd7fcf4e?auto=format&fit=crop&w=600&q=80', category: 'Gia dụng & Đời sống', stock: 52 },
];

async function main() {
  console.log('🌱 SEED DEMO DATA — bắt đầu (chạy cộng dồn, không xóa dữ liệu cũ)...');

  // ═══ 1. KHÁCH HÀNG TRẢI 12 THÁNG ═══
  const userPassword = await hashPassword('user123');
  const now = new Date();
  const existingEmails = new Set(
    (await prisma.user.findMany({ select: { email: true } })).map((u) => u.email)
  );

  const newCustomers = [];
  let createdCustomers = 0;
  for (let i = 0; i < VIETNAMESE_NAMES.length; i++) {
    const name = VIETNAMESE_NAMES[i];
    const email = `khach${String(i + 1).padStart(2, '0')}@demo.vn`;
    if (existingEmails.has(email)) {
      await prisma.user.update({
        where: { email },
        data: { passwordHash: userPassword },
      });
      continue;
    }
    // Trải 12 tháng: mỗi khách đăng ký vào tháng khác nhau (bucket cuối = tháng hiện tại)
    const monthOffset = i % 12;
    const createdAt = new Date(now.getFullYear(), now.getMonth() - (11 - monthOffset), rand(1, 27), rand(8, 21), rand(0, 59));
    newCustomers.push(
      await prisma.user.create({
        data: {
          email, name,
          passwordHash: userPassword,
          role: 'CUSTOMER', isVerified: true,
          createdAt,
          phone: `09${rand(10000000, 99999999)}`,
        },
      })
    );
    createdCustomers++;
  }
  const allCustomers = await prisma.user.findMany({ where: { role: 'CUSTOMER' }, orderBy: { createdAt: 'asc' } });
  console.log(`✅ Khách hàng: +${createdCustomers} mới (tổng ${allCustomers.length})`);

  // ═══ 2. SẢN PHẨM MỚI (tránh trùng tên) ═══
  const existingNames = new Set(
    (await prisma.product.findMany({ select: { name: true } })).map((p) => p.name)
  );
  let createdProducts = 0;
  for (const p of NEW_PRODUCTS) {
    if (existingNames.has(p.name)) continue;
    const variantTotal = p.variants ? p.variants.reduce((s, v) => s + v.stock, 0) : 0;
    await prisma.product.create({
      data: {
        name: p.name, description: p.description, price: p.price,
        image: p.image, category: p.category,
        stock: p.variants ? variantTotal : p.stock,
        isActive: true,
        variants: p.variants ? { create: p.variants } : undefined,
      },
    });
    createdProducts++;
  }
  const allProducts = await prisma.product.findMany({
    where: { isActive: true },
    include: { variants: { where: { isActive: true } } },
  });
  console.log(`✅ Sản phẩm: +${createdProducts} mới (tổng active ${allProducts.length})`);

  // ═══ 3. ĐƠN HÀNG TRẢI 30 NGÀY ═══
  const existingCodes = new Set(
    (await prisma.order.findMany({ select: { orderCode: true } })).map((o) => o.orderCode)
  );
  const usedTransIds = new Set(
    (await prisma.transaction.findMany({ select: { bankTransId: true } })).map((t) => t.bankTransId)
  );

  const ORDER_TARGET = 90;
  let createdOrders = 0;
  const stockDeltas = new Map<string, number>(); // key: p:<productId> | v:<variantId>

  for (let i = 0; i < ORDER_TARGET; i++) {
    // Ngày đặt: lệch về gần (0-29 ngày trước)
    const age = Math.floor(Math.pow(Math.random(), 1.4) * 30);
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - age, rand(7, 21), rand(0, 59));

    // Trạng thái theo độ tuổi đơn
    let status: string;
    if (age === 0) {
      status = weighted<string>([['PENDING', 20], ['CONFIRMED', 25], ['PROCESSING', 25], ['SHIPPING', 10], ['COMPLETED', 20]]);
    } else if (age <= 2) {
      status = weighted<string>([['COMPLETED', 45], ['SHIPPING', 20], ['PROCESSING', 15], ['CONFIRMED', 10], ['CANCELLED', 10]]);
    } else {
      status = weighted<string>([['COMPLETED', 82], ['CANCELLED', 18]]);
    }

    const isGuest = Math.random() < 0.15;
    const user = isGuest ? null : pick(allCustomers);

    // 1-3 items
    const itemCount = rand(1, 3);
    const chosen = new Set<string>();
    const items: Array<{ productId: string; variantId: string | null; name: string; category: string; price: number; quantity: number }> = [];
    for (let j = 0; j < itemCount; j++) {
      const prod = pick(allProducts);
      if (chosen.has(prod.id)) continue;
      chosen.add(prod.id);
      const hasVariants = prod.variants.length > 0;
      const variant = hasVariants ? pick(prod.variants) : null;
      items.push({
        productId: prod.id,
        variantId: variant?.id ?? null,
        name: variant ? `${prod.name} (${variant.title})` : prod.name,
        category: prod.category ?? 'Phụ kiện',
        price: variant?.price ?? prod.price,
        quantity: rand(1, 2),
      });
    }
    if (items.length === 0) continue;

    const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
    const shippingFee = subtotal >= 500_000 ? 0 : 30_000;
    const totalAmount = subtotal + shippingFee;

    // Mã đơn unique
    let orderCode = '';
    do {
      orderCode = `DH${String(day.getFullYear()).slice(2)}${String(day.getMonth() + 1).padStart(2, '0')}${String(day.getDate()).padStart(2, '0')}${String(rand(0, 999)).padStart(3, '0')}`;
    } while (existingCodes.has(orderCode));
    existingCodes.add(orderCode);

    // Thanh toán & vận đơn
    let paymentStatus: 'UNPAID' | 'PAID' | 'REFUNDED' | 'EXPIRED' = 'UNPAID';
    let method: 'PayOS' | 'COD' | 'WALLET' = 'PayOS';
    if (status === 'PENDING') {
      paymentStatus = 'UNPAID';
      method = 'PayOS';
    } else if (status === 'CANCELLED') {
      const wasPaid = Math.random() < 0.5;
      paymentStatus = wasPaid ? 'REFUNDED' : 'UNPAID';
      method = wasPaid ? (Math.random() < 0.25 ? 'WALLET' : 'PayOS') : 'PayOS';
    } else if (status === 'COMPLETED') {
      paymentStatus = 'PAID';
      method = weighted<'PayOS' | 'WALLET' | 'COD'>([['PayOS', 60], ['WALLET', 15], ['COD', 25]]);
    } else {
      // CONFIRMED / PROCESSING / SHIPPING
      method = weighted<'PayOS' | 'WALLET' | 'COD'>([['PayOS', 60], ['WALLET', 15], ['COD', 25]]);
      paymentStatus = method === 'COD' ? 'UNPAID' : 'PAID';
    }

    const expiresAt = status === 'PENDING'
      ? new Date(now.getTime() - rand(0, 8) * 60_000) // một số còn hạn, một số sắp hết
      : new Date(day.getTime() + 15 * 60_000);

    const order = await prisma.order.create({
      data: {
        orderCode,
        userId: user?.id ?? null,
        customerName: user?.name ?? pick(VIETNAMESE_NAMES),
        customerPhone: `09${rand(10000000, 99999999)}`,
        customerEmail: user?.email ?? null,
        customerAddress: `${rand(1, 200)} ${pick(['Nguyễn Văn Linh', 'Lê Lợi', 'Trần Phú', 'Nguyễn Huệ', 'Xô Viết Nghệ Tĩnh', 'Hùng Vương'])}, ${pick(['Quận Hải Châu', 'Quận Sơn Trà', 'Quận Ngũ Hành Sơn', 'Quận 1', 'Quận 7', 'Quận Cầu Giấy'])}, ${pick(['Đà Nẵng', 'TP. Hồ Chí Minh', 'Hà Nội'])}`,
        subtotal, shippingFee, discountAmount: 0, totalAmount,
        status: status as never,
        paymentStatus: paymentStatus as never,
        qrContent: `Thanh toan don hang ${orderCode}`,
        expiresAt,
        createdAt: day,
        items: {
          create: items.map((it) => ({
            productId: it.productId,
            variantId: it.variantId,
            variantTitle: it.variantId ? it.name.split(' (')[1]?.replace(')', '') ?? null : null,
            price: it.price,
            quantity: it.quantity,
          })),
        },
      },
    });

    // Ghi nhận trừ kho
    for (const it of items) {
      if (it.variantId) {
        stockDeltas.set(`v:${it.variantId}`, (stockDeltas.get(`v:${it.variantId}`) ?? 0) + it.quantity);
      }
      stockDeltas.set(`p:${it.productId}`, (stockDeltas.get(`p:${it.productId}`) ?? 0) + it.quantity);
    }

    // Transaction cho đơn đã trả (không phải COD)
    if (paymentStatus === 'PAID' && method !== 'COD') {
      let bankTransId = `TXN${Date.now()}${rand(100, 999)}`;
      while (usedTransIds.has(bankTransId)) bankTransId = `TXN${Date.now()}${rand(1000, 9999)}`;
      usedTransIds.add(bankTransId);
      const receivedAt = new Date(Math.min(day.getTime() + rand(2, 30) * 60_000, now.getTime()));
      await prisma.transaction.create({
        data: {
          orderId: order.id,
          bankTransId,
          amount: totalAmount,
          description: `Thanh toan don hang ${orderCode}`,
          bankName: method === 'WALLET' ? 'SHOP_WALLET' : pick(['VCB', 'MBBank', 'TCB', 'Vietcombank']),
          senderAccount: `****${rand(1000, 9999)}`,
          receivedAt,
          verified: true,
          createdAt: receivedAt,
        },
      });
    }

    // Vận đơn cho các trạng thái sau PENDING/CANCELLED
    if (!['PENDING', 'CANCELLED'].includes(status)) {
      const shipStatus =
        status === 'CONFIRMED' ? 'READY_TO_PICK'
        : status === 'PROCESSING' ? 'PICKING'
        : status === 'SHIPPING' ? 'DELIVERING'
        : 'DELIVERED';
      await prisma.shipment.create({
        data: {
          orderId: order.id,
          trackingCode: `GHN${Date.now().toString(36).toUpperCase()}${String(i).padStart(3, '0')}`,
          shippingFee,
          codAmount: method === 'COD' ? totalAmount : 0,
          status: shipStatus as never,
          estimatedArrival: new Date(day.getTime() + rand(2, 5) * 86_400_000),
          createdAt: day,
          shippingLogs: {
            logs: [
              { status: 'READY_TO_PICK', description: 'Đã tạo vận đơn tự động qua GHN OpenAPI v2', timestamp: day.toISOString() },
              ...(shipStatus !== 'READY_TO_PICK' ? [{ status: shipStatus, description: 'GHN cập nhật trạng thái qua webhook', timestamp: new Date(day.getTime() + rand(1, 20) * 3_600_000).toISOString() }] : []),
            ],
          },
        },
      });
    }

    // Review chỉ từ đơn COMPLETED
    if (status === 'COMPLETED' && user) {
      for (const it of items) {
        if (Math.random() > 0.55) continue;
        const rating = weighted<number>([[5, 75], [4, 20], [3, 5]]);
        const rev = getProductSpecificReview(it.name, it.category, rating);
        await prisma.review.create({
          data: {
            productId: it.productId,
            userId: user.id,
            orderId: order.id,
            rating,
            comment: rev.comment,
            images: [],
            reply: rev.reply,
            createdAt: new Date(day.getTime() + rand(1, 5) * 86_400_000),
          },
        }).catch(() => { /* trùng unique(productId,userId,orderId) thì bỏ qua */ });
      }
    }

    createdOrders++;
  }

  // Áp trừ kho (clamp >= 0) — variant trừ trực tiếp, product trừ đồng bộ
  let stockUpdates = 0;
  for (const [key, qty] of stockDeltas) {
    if (key.startsWith('v:')) {
      await prisma.productVariant.updateMany({
        where: { id: key.slice(2), stock: { gte: qty } },
        data: { stock: { decrement: qty } },
      });
      stockUpdates++;
    }
  }
  for (const [key, qty] of stockDeltas) {
    if (key.startsWith('p:')) {
      await prisma.product.updateMany({
        where: { id: key.slice(2), stock: { gte: qty } },
        data: { stock: { decrement: qty } },
      });
    }
  }
  // Bảo đảm bất biến Product.stock = tổng variant stock
  const variantProducts = await prisma.product.findMany({
    where: { variants: { some: {} } },
    include: { variants: true },
  });
  for (const p of variantProducts) {
    const total = p.variants.filter((v) => v.isActive).reduce((s, v) => s + v.stock, 0);
    if (p.stock !== total) {
      await prisma.product.update({ where: { id: p.id }, data: { stock: total } });
    }
  }
  console.log(`✅ Đơn hàng: +${createdOrders} (trải 30 ngày) · cập nhật kho ${stockUpdates} variant`);

  // ═══ 4. VÍ SHOP cho một số khách ═══
  const walletUsers = allCustomers.slice(-8);
  let walletCreated = 0;
  for (const u of walletUsers) {
    const exists = await prisma.userWallet.findUnique({ where: { userId: u.id } });
    if (exists) continue;
    const balance = rand(4, 40) * 10_000;
    const wallet = await prisma.userWallet.create({
      data: { userId: u.id, balance },
    });
    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: balance,
        type: 'TOPUP',
        description: `Nạp tiền Ví Shop qua VietQR — NAP${String(rand(100000, 999999))}`,
      },
    });
    walletCreated++;
  }
  console.log(`✅ Ví Shop: +${walletCreated} ví có số dư`);

  // ═══ 5. COUPON đang chạy ═══
  const coupons = [
    { code: 'SALE10', description: 'Giảm 10% tối đa 50.000₫ cho mọi đơn', discountType: 'PERCENTAGE', discountValue: 10, maxDiscount: 50_000, minOrderAmount: 200_000, usageLimit: 200 },
    { code: 'GIAM50K', description: 'Giảm thẳng 50.000₫ cho đơn từ 500.000₫', discountType: 'FIXED', discountValue: 50_000, maxDiscount: null, minOrderAmount: 500_000, usageLimit: 100 },
    { code: 'FREESHIP', description: 'Miễn phí vận chuyển toàn quốc', discountType: 'FREE_SHIPPING', discountValue: 0, maxDiscount: null, minOrderAmount: 0, usageLimit: 300 },
  ];
  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: { isActive: true, endDate: new Date(now.getTime() + 60 * 86_400_000) },
      create: {
        ...c,
        perUserLimit: 2,
        startDate: new Date(now.getTime() - 7 * 86_400_000),
        endDate: new Date(now.getTime() + 60 * 86_400_000),
        isActive: true,
      } as never,
    });
  }
  console.log('✅ Coupon: 3 mã đang chạy (SALE10, GIAM50K, FREESHIP)');

  // ═══ 5.5 CHUẨN HÓA TOÀN BỘ REVIEWS HIỆN CÓ ĐỂ ĂN KHỚP 100% VỚI TỪNG MẶT HÀNG ═══
  const allExistingReviews = await prisma.review.findMany({
    include: { product: true },
  });
  for (const r of allExistingReviews) {
    const rev = getProductSpecificReview(r.product.name, r.product.category ?? 'Phụ kiện', r.rating);
    await prisma.review.update({
      where: { id: r.id },
      data: {
        comment: rev.comment,
        reply: rev.reply,
      },
    });
  }
  console.log(`✅ Đã đồng bộ & chuẩn hóa ${allExistingReviews.length} đánh giá khớp 100% từng mặt hàng`);

  // ═══ 6. XÓA CACHE REDIS để dashboard + cửa hàng thấy dữ liệu mới ngay ═══
  const flushed = await redis.delPattern('cache:products:*');
  await redis.del('cache:categories');
  await redis.delPattern('cache:product:*');
  await invalidateAnalyticsCache();
  console.log(`🧹 Đã xóa cache Redis (product list: ${flushed} key, categories, analytics)`);

  // ═══ TỔNG KẾT ═══
  const [orders, paidAgg, tx, reviews, wallets] = await Promise.all([
    prisma.order.count(),
    prisma.order.aggregate({ where: { paymentStatus: 'PAID' }, _sum: { totalAmount: true }, _count: { id: true } }),
    prisma.transaction.count(),
    prisma.review.count(),
    prisma.userWallet.count(),
  ]);
  console.log('───────────────────────────────');
  console.log(`📊 Hiện tại trong DB: ${orders} đơn · ${paidAgg._count.id} đã trả (${paidAgg._sum.totalAmount?.toLocaleString('vi-VN')}₫) · ${tx} giao dịch · ${reviews} đánh giá · ${wallets} ví`);
  console.log('🎉 SEED DEMO DATA HOÀN TẤT!');
}

main()
  .catch((e) => {
    console.error('❌ Seed thất bại:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
