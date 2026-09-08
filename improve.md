# Improve Plan

## Tong quan

Project hien la ung dung Next.js 16 + React 19 + Prisma/PostgreSQL cho shop thanh toan VietQR. Build production dang chay duoc, nhung lint chua sach va cac rui ro lon nam o validation dau vao, tinh tien checkout, ton kho, webhook thanh toan va type safety.

## Trang thai hien tai

- `npm run build`: dat.
- `npm run lint`: chua dat, co 38 van de gom 26 errors va 12 warnings.
- Chuc nang chinh da co: san pham, gio hang, checkout VietQR, auth OTP email, order, admin, notification/chat realtime qua Pusher.

## Cai thien uu tien cao

### 1. Sua luong tinh tien checkout va order

Hien UI checkout tinh them phi giao hang vao tong thanh toan, nhung API tao order chi tinh tong tien san pham va tao QR theo tong do. Can dua logic tinh phi ship ve server va tra ve breakdown ro rang.

Viec can lam:

- Tao helper tinh `subtotal`, `shippingFee`, `totalAmount` dung chung cho UI/API.
- API `/api/orders` khong nhan tong tien tu client.
- QR VietQR phai dung dung `totalAmount` cuoi cung.
- UI hien thi dung breakdown server tra ve hoac dong bo cung mot rule.

### 2. Validate dau vao API order

API tao order dang tin `items` tu client qua nhieu. Can validate moi item truoc khi tao order.

Viec can lam:

- `items` phai la array khong rong.
- `productId` phai ton tai.
- `quantity` phai la so nguyen duong.
- San pham phai `isActive = true`.
- `quantity` khong duoc vuot `stock`.
- Gioi han max quantity moi dong de tranh abuse.

### 3. Quan ly ton kho

Model co `Product.stock`, UI co hien het hang, nhung API chua tru ton kho khi dat/thanh toan va chua hoan kho khi huy/het han.

De xuat:

- Reserve/tru kho khi tao order trong transaction.
- Hoan kho khi order het han hoac bi huy neu chua thanh toan.
- Khong cho checkout san pham het hang.
- Them logic tranh race condition khi nhieu nguoi mua cung luc.

### 4. Gia co webhook thanh toan

Webhook hien match ma don trong description va tao transaction. Can idempotency va doi soat tot hon.

Viec can lam:

- Them idempotency theo `bankTransId` hoac hash raw transaction.
- Duplicate webhook khong duoc lam loi request.
- Validate amount, chieu giao dich, description va ma don hang.
- Luu transaction khong match de admin doi soat neu can.
- Tach parser ma don hang thanh function rieng va viet test.

### 5. Sua lint va type safety

Project bat `strict: true` nhung con nhieu `any` va cast `as any`.

Viec can lam:

- Thay `any` bang type cu the hoac Prisma-derived type.
- Dinh nghia DTO cho request/response API.
- Bo import/variable khong dung.
- Thay internal `<a>` bang `next/link`.
- Xu ly warning `setState` dong bo trong effect cho mounted/hydration.
- Can nhac dung `next/image` cho anh san pham.

## Cai thien uu tien trung binh

### 6. Hoan thien order expiry

UI QR co countdown het han, nhung database khong tu cap nhat `paymentStatus = EXPIRED`.

Viec can lam:

- Them job/endpoint dinh ky expire cac order qua han chua thanh toan.
- Khi order expired, hoan kho neu da reserve.
- Chan thanh toan/confirm thu cong cho order da expired neu khong co override admin ro rang.

### 7. Gia co auth va OTP

OTP dang co cooldown gui lai 60 giay, nhung chua co limit verify attempts va cleanup OTP cu.

Viec can lam:

- Normalize email truoc khi luu/tim kiem.
- Gioi han so lan verify OTP sai.
- Cleanup OTP het han/cu.
- Can nhac thong bao loi it tiet lo hon de tranh email enumeration.
- Dong bo cooldown resend tren UI.

### 8. Validate admin status transition

Admin PATCH order co the gui `status`/`paymentStatus` bat ky. Prisma chan enum sai, nhung app nen co rule nghiep vu rieng.

Viec can lam:

- Validate enum input truoc khi update.
- Dinh nghia cac transition hop le.
- Khong cho order da `CANCELLED` chuyen sang `SHIPPING`/`COMPLETED` neu khong co override.
- Khong cho `COMPLETED` khi payment chua `PAID`, tuy theo rule kinh doanh.

### 9. Soft delete product

API product DELETE dang xoa cung record. Neu product da co trong order, xoa cung co the loi hoac lam mat ngu canh lich su.

Viec can lam:

- Doi delete thanh `isActive = false`.
- Chi hard delete san pham chua tung co order item neu that su can.
- UI admin nen hien ro trang thai dang ban/an.

### 10. Cai thien chat realtime

Chat co optimistic message nhung chua rollback khi API loi.

Viec can lam:

- Kiem tra response khi send message.
- Thay temp message bang message server tra ve hoac rollback neu loi.
- Them unread/read state thuc te.
- Them pagination cho messages.

## Cai thien UI/UX

- Homepage category chips hien tai chua filter thuc su.
- Header chua co mobile navigation day du.
- Nhieu icon dang dung emoji/manual SVG; nen thong nhat qua icon library san co nhu `lucide-react`.
- Empty/loading/error states con mong o mot so man.
- QR payment nen co fallback neu `BANK_ACCOUNT`/`BANK_NAME` chua cau hinh.
- Admin orders/products nen co search, pagination va filter server-side.

## Test can bo sung

Uu tien test cho cac phan co rui ro tien/stock/webhook:

- Tinh subtotal/shipping/total.
- Validate order items va stock.
- Tao order transaction va tru/hoan kho.
- Parser ma don hang tu noi dung chuyen khoan.
- Webhook idempotency.
- OTP generate/send/verify/cooldown/attempt limit.
- Admin status transition.

## Lo trinh de xuat

1. Sua lint/type errors de codebase co baseline sach.
2. Sua checkout total va validation order.
3. Them inventory transaction va expiry handling.
4. Gia co webhook payment va idempotency.
5. Cai thien auth/OTP.
6. Nang cap admin search/filter/pagination va soft delete.
7. Cai thien chat/notification state.
8. Bo sung test tu cac helper nghiep vu truoc, sau do den integration API.
