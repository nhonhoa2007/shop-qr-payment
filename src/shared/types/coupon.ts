export interface CustomerCoupon {
  id: string;
  code: string;
  description: string | null;
  discountType: 'FIXED' | 'PERCENTAGE' | 'FREE_SHIPPING';
  discountValue: number;
  fixedDiscountAmount: string | null;
  percentageRate: number | null;
  maxDiscount: string | null;
  minOrderAmount: string;
  usageLimit: number;
  usedCount: number;
  perUserLimit: number;
  userUsedCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  saved: boolean;
}
