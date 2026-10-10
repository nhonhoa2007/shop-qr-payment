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

const VIETNAMESE_COMMENTS = [
  'Sản phẩm đúng như hình, đóng gói cẩn thận, giao nhanh. Sẽ ủng hộ shop tiếp!',
  'Chất lượng vượt mong đợi ở tầm giá này. Quét QR chuyển khoản xong là đơn tự xác nhận luôn, quá tiện.',
  'Shop tư vấn nhiệt tình qua chat, hàng chính hãng. Rất đáng tiền.',
  'Giao hàng nhanh, temple đẹp, chất vải dày dặn. 5 sao!',
  'Lần đầu thanh toán bằng Ví Shop, trừ tiền tức thì không cần quét lại. Trải nghiệm mượt.',
  'Hơi chờ đợi shipper hơi lâu nhưng sản phẩm ổn, zui.',
  'Đóng gói kỹ, có phiếu bảo hành. Sẽ review thêm sau khi dùng lâu.',
  'Mua cho người yêu, bạn ấy thích lắm. Size chuẩn theo bảng của shop.',
  'Đúng hàng chính hãng, quét mã kiểm tra được. Shop uy tín.',
  'Giá tốt hơn mấy nơi khác, đổi trả 7 ngày yên tâm.',
  'Pin trâu, tiếng hay, chống ồn tốt. Đáng mua!',
  'Form đẹp nhưng mình cần size lớn hơn, shop đổi trả nhanh gọn lẹ.',
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
    if (existingEmails.has(email)) continue;
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
    const items: Array<{ productId: string; variantId: string | null; name: string; price: number; quantity: number }> = [];
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
        const comment = Math.random() < 0.85 ? pick(VIETNAMESE_COMMENTS) : null;
        await prisma.review.create({
          data: {
            productId: it.productId,
            userId: user.id,
            orderId: order.id,
            rating: weighted<number>([[5, 45], [4, 35], [3, 15], [2, 5]]),
            comment,
            images: [],
            reply: Math.random() < 0.2 ? 'Cảm ơn anh/chị đã tin tưởng shop! Hẹn gặp lại ạ 🧡' : null,
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
