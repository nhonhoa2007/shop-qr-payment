import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu khởi tạo dữ liệu mẫu phong phú cho hệ thống...');

  // 1. TẠO TÀI KHOẢN NGƯỜI DÙNG (USERS)
  const adminPassword = await bcrypt.hash('admin123', 12);
  const userPassword = await bcrypt.hash('user123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@shop.com' },
    update: {},
    create: {
      email: 'admin@shop.com',
      passwordHash: adminPassword,
      name: 'Quản trị viên ShopQR',
      role: 'ADMIN',
      isVerified: true,
    },
  });

  const customer1 = await prisma.user.upsert({
    where: { email: 'khachhang@gmail.com' },
    update: {},
    create: {
      email: 'khachhang@gmail.com',
      passwordHash: userPassword,
      name: 'Trần Thị Mai',
      role: 'CUSTOMER',
      isVerified: true,
    },
  });

  const customer2 = await prisma.user.upsert({
    where: { email: 'hoangnam@gmail.com' },
    update: {},
    create: {
      email: 'hoangnam@gmail.com',
      passwordHash: userPassword,
      name: 'Hoàng Nam',
      role: 'CUSTOMER',
      isVerified: true,
    },
  });

  const customer3 = await prisma.user.upsert({
    where: { email: 'lethu@gmail.com' },
    update: {},
    create: {
      email: 'lethu@gmail.com',
      passwordHash: userPassword,
      name: 'Lê Thu Trang',
      role: 'CUSTOMER',
      isVerified: true,
    },
  });

  console.log('✅ Đã tạo 4 tài khoản người dùng (1 Admin, 3 Khách hàng)');

  // 2. TẠO DANH SÁCH SẢN PHẨM (PRODUCTS) VỚI ẢNH CHẤT LƯỢNG CAO
  const sampleProducts = [
    {
      name: 'Áo thun nam Cotton Organic',
      description: 'Áo thun cotton 100% tự nhiên dệt kim cao cấp, co giãn 4 chiều, thấm hút mồ hôi tối đa, form suông thời thượng.',
      price: 289000,
      image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80',
      category: 'Thời trang',
      stock: 45,
    },
    {
      name: 'Quần Jeans Slim Fit Wash',
      description: 'Quần jeans nam form ôm gọn tôn dáng, chất liệu denim pha spandex co giãn thoải mái, màu xanh chàm cổ điển.',
      price: 499000,
      image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=600&q=80',
      category: 'Thời trang',
      stock: 30,
    },
    {
      name: 'Giày Sneaker Running Pro',
      description: 'Giày thể thao siêu nhẹ, đế đệm khí EVA đàn hồi bảo vệ bàn chân, vải lưới dệt thoáng khí, phù hợp chạy bộ và dạo phố.',
      price: 790000,
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80',
      category: 'Thời trang',
      stock: 25,
    },
    {
      name: 'Tai nghe chụp tai ANC Pro Wireless',
      description: 'Tai nghe Bluetooth 5.3 chống ồn chủ động cao cấp, màng loa 40mm âm bass sâu, đệm tai mút hoạt tính, thời lượng pin 40 giờ.',
      price: 1250000,
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
      category: 'Công nghệ',
      stock: 20,
    },
    {
      name: 'Đồng hồ thông minh Smart Sport Band',
      description: 'Màn hình AMOLED sắc nét tràn viền, theo dõi nhịp tim 24/7, SpO2, đo giấc ngủ, kháng nước chuẩn 5ATM khi bơi lội.',
      price: 890000,
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
      category: 'Công nghệ',
      stock: 18,
    },
    {
      name: 'Bàn phím cơ không dây Custom 75%',
      description: 'Bàn phím cơ hotswap 3 chế độ kết nối (Type-C, 2.4Ghz, Bluetooth), switch linear êm ái, keycap PBT Doubleshot bền màu.',
      price: 1150000,
      image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80',
      category: 'Công nghệ',
      stock: 12,
    },
    {
      name: 'Balo chống nước Laptop 15.6 inch',
      description: 'Chất liệu vải Oxford chống thấm nước đa lớp, ngăn đựng laptop đệm khí chống sốc, tích hợp cổng sạc USB tiện dụng.',
      price: 390000,
      image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80',
      category: 'Phụ kiện',
      stock: 35,
    },
    {
      name: 'Bình giữ nhiệt Inox 316 750ml',
      description: 'Inox y tế 316 an toàn sức khỏe, giữ nóng 12 giờ, giữ lạnh 24 giờ, nắp xoay chống tràn 100%, sơn tĩnh điện nhám cao cấp.',
      price: 245000,
      image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80',
      category: 'Phụ kiện',
      stock: 50,
    },
    {
      name: 'Kính râm Polarized chống tia UV400',
      description: 'Mắt kính phân cực chống lóa khi lái xe, gọng titanium siêu nhẹ và dẻo dai, thiết kế unisex thanh lịch.',
      price: 320000,
      image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=600&q=80',
      category: 'Phụ kiện',
      stock: 40,
    },
    {
      name: 'Đèn bàn LED chống cận thông minh',
      description: 'Chỉ số hoàn màu CRI 95 tái tạo ánh sáng mặt trời, cảm ứng điều chỉnh 5 mức độ sáng và 3 dải nhiệt độ màu, hẹn giờ tắt.',
      price: 380000,
      image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=600&q=80',
      category: 'Gia dụng & Đời sống',
      stock: 22,
    },
    {
      name: 'Máy pha cà phê Espresso mini',
      description: 'Áp suất bơm 20 bar chiết xuất cà phê đậm đà chuẩn Ý, vòi đánh sữa tạo bọt mịn cho cappuccino và latte, kích thước nhỏ gọn.',
      price: 1850000,
      image: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=600&q=80',
      category: 'Gia dụng & Đời sống',
      stock: 10,
    },
    {
      name: 'Bộ dao làm bếp thép Damascus 5 món',
      description: 'Thép vân Damascus 67 lớp siêu sắc bén, cán dao gỗ mun tự nhiên cầm chắc tay, bao gồm dao đầu bếp, dao thái và kéo cắt gà.',
      price: 920000,
      image: 'https://images.unsplash.com/photo-1593618998160-e34014e67546?auto=format&fit=crop&w=600&q=80',
      category: 'Gia dụng & Đời sống',
      stock: 15,
    },
  ];

  const createdProducts = [];
  for (const prod of sampleProducts) {
    const existing = await prisma.product.findFirst({ where: { name: prod.name } });
    if (existing) {
      createdProducts.push(existing);
    } else {
      const p = await prisma.product.create({ data: prod });
      createdProducts.push(p);
    }
  }
  console.log(`✅ Đã đồng bộ ${createdProducts.length} sản phẩm danh mục phong phú`);

  // 2.1 TẠO BIẾN THỂ MẪU (PRODUCT VARIANTS)
  const shirt = createdProducts.find((p) => p.name.includes('Áo thun nam Cotton Organic'));
  if (shirt) {
    const shirtVariants = [
      { sku: 'AT-COTTON-DEN-M', title: 'Đen / Size M', color: 'Đen', size: 'M', price: 289000, stock: 15 },
      { sku: 'AT-COTTON-DEN-L', title: 'Đen / Size L', color: 'Đen', size: 'L', price: 289000, stock: 12 },
      { sku: 'AT-COTTON-DEN-XL', title: 'Đen / Size XL', color: 'Đen', size: 'XL', price: 299000, stock: 8 },
      { sku: 'AT-COTTON-TRANG-M', title: 'Trắng / Size M', color: 'Trắng', size: 'M', price: 289000, stock: 10 },
      { sku: 'AT-COTTON-TRANG-L', title: 'Trắng / Size L', color: 'Trắng', size: 'L', price: 289000, stock: 0 },
      { sku: 'AT-COTTON-TRANG-XL', title: 'Trắng / Size XL', color: 'Trắng', size: 'XL', price: 299000, stock: 5 },
    ];
    for (const v of shirtVariants) {
      await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: {},
        create: { ...v, productId: shirt.id },
      });
    }
    console.log('✅ Đã tạo các biến thể đa thuộc tính (Size & Màu sắc) cho Áo thun nam');
  }

  const sneaker = createdProducts.find((p) => p.name.includes('Giày Sneaker'));
  if (sneaker) {
    const sneakerVariants = [
      { sku: 'SNK-PRO-40', title: 'Size 40', size: '40', price: 790000, stock: 10 },
      { sku: 'SNK-PRO-41', title: 'Size 41', size: '41', price: 790000, stock: 8 },
      { sku: 'SNK-PRO-42', title: 'Size 42', size: '42', price: 790000, stock: 7 },
    ];
    for (const v of sneakerVariants) {
      await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: {},
        create: { ...v, productId: sneaker.id },
      });
    }
    console.log('✅ Đã tạo các biến thể kích thước cho Giày Sneaker');
  }

  // 3. TẠO MÃ GIẢM GIÁ (COUPONS)
  const sampleCoupons = [
    {
      code: 'CHAOBAN',
      description: 'Giảm ngay 20.000đ cho đơn từ 100.000đ',
      discountType: 'FIXED' as const,
      discountValue: 20000,
      minOrderAmount: 100000,
      usageLimit: 500,
      usedCount: 14,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2027-12-31'),
    },
    {
      code: 'GIAM10',
      description: 'Giảm 10% tối đa 50.000đ cho đơn từ 200.000đ',
      discountType: 'PERCENTAGE' as const,
      discountValue: 10,
      maxDiscount: 50000,
      minOrderAmount: 200000,
      usageLimit: 200,
      usedCount: 28,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2027-12-31'),
    },
    {
      code: 'FREESHIP',
      description: 'Miễn phí vận chuyển toàn quốc cho mọi đơn hàng',
      discountType: 'FREE_SHIPPING' as const,
      discountValue: 0,
      minOrderAmount: 0,
      usageLimit: 1000,
      usedCount: 65,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2027-12-31'),
    },
    {
      code: 'VIP2026',
      description: 'Ưu đãi đặc quyền giảm 50.000đ cho đơn hàng từ 500.000đ',
      discountType: 'FIXED' as const,
      discountValue: 50000,
      minOrderAmount: 500000,
      usageLimit: 100,
      usedCount: 8,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2027-12-31'),
    },
  ];

  for (const c of sampleCoupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: c,
      create: c,
    });
  }
  console.log(`✅ Đã tạo ${sampleCoupons.length} mã khuyến mại & voucher`);

  // 4. TẠO ĐƠN HÀNG MẪU ĐA TRẠNG THÁI (ORDERS & TRANSACTIONS)
  const p1 = createdProducts[0]; // Áo thun 289k
  const p3 = createdProducts[2]; // Giày 790k
  const p4 = createdProducts[3]; // Tai nghe 1250k
  const p7 = createdProducts[6]; // Balo 390k

  // Đơn 1: COMPLETED + PAID (Khách: Trần Thị Mai)
  const existingOrder1 = await prisma.order.findUnique({ where: { orderCode: 'DH100001' } });
  let order1 = existingOrder1;
  if (!order1) {
    order1 = await prisma.order.create({
      data: {
        orderCode: 'DH100001',
        userId: customer1.id,
        customerName: 'Trần Thị Mai',
        customerPhone: '0987654321',
        customerAddress: 'Số 45 Lê Duẩn, Quận 1, TP. Hồ Chí Minh',
        customerEmail: customer1.email,
        subtotal: 790000,
        shippingFee: 0,
        discountAmount: 0,
        totalAmount: 790000,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        qrContent: 'https://api.vietqr.io/image/970422-123456789-compact2.jpg?amount=790000&addInfo=DH100001',
        note: 'Giao trong giờ hành chính giúp mình',
        expiresAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000),
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        items: {
          create: [{ productId: p3.id, quantity: 1, price: p3.price }],
        },
      },
    });

    // Tạo bản ghi giao dịch ngân hàng khớp lệnh
    await prisma.transaction.create({
      data: {
        bankTransId: 'MBB_20260905_100001',
        orderId: order1.id,
        amount: 790000,
        description: 'MBVCB.987654321.DH100001.TRAN THI MAI CHUYEN TIEN',
        bankName: 'MBBANK',
        verified: true,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // Đơn 2: SHIPPING + PAID (Khách: Hoàng Nam)
  const existingOrder2 = await prisma.order.findUnique({ where: { orderCode: 'DH100002' } });
  let order2 = existingOrder2;
  if (!order2) {
    order2 = await prisma.order.create({
      data: {
        orderCode: 'DH100002',
        userId: customer2.id,
        customerName: 'Hoàng Nam',
        customerPhone: '0912345678',
        customerAddress: '128 Cầu Giấy, Quận Cầu Giấy, Hà Nội',
        customerEmail: customer2.email,
        subtotal: 1250000,
        shippingFee: 0,
        discountAmount: 50000,
        couponCode: 'VIP2026',
        totalAmount: 1200000,
        status: 'SHIPPING',
        paymentStatus: 'PAID',
        qrContent: 'https://api.vietqr.io/image/970422-123456789-compact2.jpg?amount=1200000&addInfo=DH100002',
        note: 'Đóng gói kỹ tai nghe giúp shop',
        expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000),
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        items: {
          create: [{ productId: p4.id, quantity: 1, price: p4.price }],
        },
      },
    });

    await prisma.transaction.create({
      data: {
        bankTransId: 'VCB_20260907_100002',
        orderId: order2.id,
        amount: 1200000,
        description: 'DH100002 HOANG NAM THANH TOAN TAI NGHE',
        bankName: 'VIETCOMBANK',
        verified: true,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // Đơn 3: PENDING + UNPAID (Đang chờ khách quét mã VietQR)
  const existingOrder3 = await prisma.order.findUnique({ where: { orderCode: 'DH100003' } });
  if (!existingOrder3) {
    await prisma.order.create({
      data: {
        orderCode: 'DH100003',
        userId: customer3.id,
        customerName: 'Lê Thu Trang',
        customerPhone: '0977889900',
        customerAddress: '88 Nguyễn Thị Minh Khai, Quận 3, TP. Hồ Chí Minh',
        customerEmail: customer3.email,
        subtotal: 679000, // 289k + 390k
        shippingFee: 0,
        discountAmount: 20000,
        couponCode: 'CHAOBAN',
        totalAmount: 659000,
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        qrContent: 'https://api.vietqr.io/image/970422-123456789-compact2.jpg?amount=659000&addInfo=DH100003',
        expiresAt: new Date(Date.now() + 14 * 60 * 1000),
        createdAt: new Date(),
        items: {
          create: [
            { productId: p1.id, quantity: 1, price: p1.price },
            { productId: p7.id, quantity: 1, price: p7.price },
          ],
        },
      },
    });
  }

  console.log('✅ Đã tạo các đơn hàng mẫu kèm bản ghi đối soát giao dịch ngân hàng');

  // 5. TẠO ĐÁNH GIÁ VÀ NHẬN XÉT THỰC TẾ (REVIEWS)
  if (order1) {
    await prisma.review.upsert({
      where: {
        productId_userId_orderId: {
          productId: p3.id,
          userId: customer1.id,
          orderId: order1.id,
        },
      },
      update: {},
      create: {
        productId: p3.id,
        userId: customer1.id,
        orderId: order1.id,
        rating: 5,
        comment: 'Giày rất êm, nhẹ và đi ôm chân. Giao hàng cực nhanh, quét mã VietQR cái là hệ thống báo thanh toán thành công ngay lập tức!',
        reply: 'Cảm ơn bạn Mai đã ủng hộ ShopQR! Chúc bạn có những buổi chạy bộ thật nhiều năng lượng ạ ❤️',
      },
    });
  }

  if (order2) {
    await prisma.review.upsert({
      where: {
        productId_userId_orderId: {
          productId: p4.id,
          userId: customer2.id,
          orderId: order2.id,
        },
      },
      update: {},
      create: {
        productId: p4.id,
        userId: customer2.id,
        orderId: order2.id,
        rating: 5,
        comment: 'Chất âm tai nghe tuyệt vời trong tầm giá, chống ồn chủ động ANC cách ly môi trường rất tốt. Đóng gói cẩn thận 2 lớp chống sốc.',
        reply: 'Shop cảm ơn anh Nam rất nhiều! Tai nghe được bảo hành chính hãng 12 tháng nên anh cứ yên tâm trải nghiệm nhé!',
      },
    });
  }

  console.log('✅ Đã thêm các đánh giá thực tế và phản hồi từ Quản trị viên');

  // 6. TẠO DANH SÁCH YÊU THÍCH (WISHLIST)
  await prisma.wishlist.upsert({
    where: {
      userId_productId: {
        userId: customer1.id,
        productId: p4.id,
      },
    },
    update: {},
    create: {
      userId: customer1.id,
      productId: p4.id,
    },
  });

  await prisma.wishlist.upsert({
    where: {
      userId_productId: {
        userId: customer1.id,
        productId: createdProducts[4].id, // Đồng hồ thông minh
      },
    },
    update: {},
    create: {
      userId: customer1.id,
      productId: createdProducts[4].id,
    },
  });

  console.log('✅ Đã tạo sản phẩm yêu thích (Wishlist) mẫu');

  // 7. TẠO PHÒNG CHAT VÀ TIN NHẮN REALTIME (CHAT ROOM & MESSAGES)
  if (order1) {
    const existingRoom = await prisma.chatRoom.findFirst({
      where: { orderId: order1.id },
    });

    let roomId = existingRoom?.id;
    if (!roomId) {
      const room = await prisma.chatRoom.create({
        data: {
          orderId: order1.id,
          participants: {
            create: [{ userId: customer1.id }, { userId: admin.id }],
          },
        },
      });
      roomId = room.id;

      await prisma.message.createMany({
        data: [
          {
            roomId,
            senderId: admin.id,
            content: 'Chào bạn Mai, đơn hàng DH100001 của bạn đã được xác nhận và đóng gói.',
            type: 'SYSTEM',
            isRead: true,
          },
          {
            roomId,
            senderId: customer1.id,
            content: 'Dạ shop ơi, cho mình hỏi giày này form chuẩn hay form nhỏ vậy ạ?',
            type: 'TEXT',
            isRead: true,
          },
          {
            roomId,
            senderId: admin.id,
            content: 'Dạ form chuẩn theo bảng size Việt Nam bạn nhé, bạn đi size 38 là vừa vặn thoải mái luôn ạ!',
            type: 'TEXT',
            isRead: true,
          },
          {
            roomId,
            senderId: customer1.id,
            content: 'Dạ cảm ơn shop, mình đã nhận được hàng và rất ưng ý ạ!',
            type: 'TEXT',
            isRead: true,
          },
        ],
      });
    }
  }

  // 8. TẠO THÔNG BÁO MẪU (NOTIFICATIONS)
  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        type: 'ORDER_CREATED',
        title: 'Đơn hàng mới: DH100003',
        message: 'Khách hàng Lê Thu Trang vừa đặt đơn hàng trị giá 659.000đ',
        isRead: false,
      },
      {
        userId: admin.id,
        type: 'PAYMENT_RECEIVED',
        title: 'Thanh toán thành công: DH100002',
        message: 'Ngân hàng VCB ghi nhận thanh toán 1.200.000đ cho đơn DH100002',
        isRead: true,
      },
      {
        userId: customer1.id,
        type: 'ORDER_COMPLETED',
        title: 'Đơn hàng đã giao thành công',
        message: 'Đơn hàng DH100001 của bạn đã được giao hoàn tất. Bạn hãy để lại đánh giá nhé!',
        isRead: true,
      },
    ],
  });

  console.log('✅ Đã tạo thông báo mẫu và lịch sử hội thoại chat hoàn chỉnh');
  console.log('\n🎉 KHỞI TẠO TOÀN BỘ DỮ LIỆU MẪU THÀNH CÔNG!');
  console.log('---------------------------------------------------------');
  console.log('👉 Tài khoản Admin: email "admin@shop.com" | pass "admin123"');
  console.log('👉 Tài khoản Khách: email "khachhang@gmail.com" | pass "user123"');
  console.log('👉 Tài khoản Khách: email "hoangnam@gmail.com" | pass "user123"');
  console.log('---------------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi khởi tạo dữ liệu mẫu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
