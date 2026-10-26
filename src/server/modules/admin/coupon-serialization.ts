type CouponMoney = bigint | number | null | undefined;

type JsonCouponMoney<T extends CouponMoney> = T extends bigint ? string : T;

type CouponWithMoney = {
  discountValue?: CouponMoney;
  fixedDiscountAmount?: CouponMoney;
  maxDiscount?: CouponMoney;
  minOrderAmount?: CouponMoney;
};

type SerializedCoupon<T extends CouponWithMoney> = Omit<T, keyof CouponWithMoney> & {
  [K in keyof T & keyof CouponWithMoney]: JsonCouponMoney<T[K]>;
};

function serializeCouponMoney<T extends CouponMoney>(value: T): JsonCouponMoney<T> {
  return (typeof value === 'bigint' ? value.toString() : value) as JsonCouponMoney<T>;
}

/** Converts Prisma BigInt money fields into lossless JSON decimal strings. */
export function serializeCouponForJson<T extends CouponWithMoney>(coupon: T): SerializedCoupon<T> {
  const serialized = { ...coupon } as SerializedCoupon<T>;

  if ('discountValue' in coupon) {
    serialized.discountValue = serializeCouponMoney(coupon.discountValue) as SerializedCoupon<T>['discountValue'];
  }
  if ('fixedDiscountAmount' in coupon) {
    serialized.fixedDiscountAmount = serializeCouponMoney(coupon.fixedDiscountAmount) as SerializedCoupon<T>['fixedDiscountAmount'];
  }
  if ('maxDiscount' in coupon) {
    serialized.maxDiscount = serializeCouponMoney(coupon.maxDiscount) as SerializedCoupon<T>['maxDiscount'];
  }
  if ('minOrderAmount' in coupon) {
    serialized.minOrderAmount = serializeCouponMoney(coupon.minOrderAmount) as SerializedCoupon<T>['minOrderAmount'];
  }

  return serialized;
}
