import type {
  WarrantyPolicyConfig,
  WarrantySnapshot,
  WarrantyTerms,
  WarrantyPolicyType,
} from '@shared/types/warranty';

export const DEFAULT_WARRANTY_EXCLUSIONS = [
  'Thiệt hại do ngấm nước hoặc hóa chất',
  'Rơi vỡ, biến dạng vật lý do va đập',
  'Tự ý tháo dỡ, can thiệp phần cứng hoặc sửa chữa tại đơn vị không ủy quyền',
  'Hư hỏng do sử dụng sai nguồn điện quy định',
];

export function resolveWarrantyTerms(
  orderItemSnapshot: unknown,
  completedAt: Date
): WarrantyTerms {
  const snapshot = (orderItemSnapshot ?? {}) as WarrantySnapshot;
  const policy = snapshot.policy;
  const productKind = snapshot.productKind?.toUpperCase();

  let periodMonths = 0;
  let coverageType: WarrantyPolicyType = 'UNKNOWN';
  let requiresManualReview = false;
  let requiresSerial = false;
  let exclusions: string[] = DEFAULT_WARRANTY_EXCLUSIONS;

  // 1. If explicit policy configured on snapshot
  if (policy && typeof policy.periodMonths === 'number' && policy.periodMonths > 0) {
    periodMonths = policy.periodMonths;
    coverageType = policy.type ?? 'SHOP';
    requiresSerial = policy.requiresSerial ?? (productKind === 'LAPTOP' || productKind === 'PHONE');
    requiresManualReview = false;
    if (Array.isArray(policy.exclusions) && policy.exclusions.length > 0) {
      exclusions = policy.exclusions;
    }
  } else if (productKind === 'LAPTOP' || productKind === 'PHONE') {
    // 2. Default laptop/phone rule: 12 calendar months
    periodMonths = 12;
    coverageType = 'MANUFACTURER';
    requiresSerial = true;
    requiresManualReview = false;
  } else if (productKind === 'ACCESSORY') {
    // 3. Accessory without explicit policy requires manual review
    periodMonths = 0;
    coverageType = 'UNKNOWN';
    requiresManualReview = true;
    requiresSerial = false;
  } else {
    // Other / Unknown
    periodMonths = 0;
    coverageType = 'UNKNOWN';
    requiresManualReview = true;
    requiresSerial = false;
  }

  const startDate = new Date(completedAt);
  const endDate = new Date(startDate);
  const originalDay = endDate.getDate();
  endDate.setMonth(endDate.getMonth() + periodMonths);
  // Guard against JavaScript Date overflow (e.g., Jan 31 -> Feb 28/29 instead of Mar 2/3)
  if (endDate.getDate() !== originalDay) {
    endDate.setDate(0);
  }

  const isExpiredAt = (evaluationDate: Date = new Date()): boolean => {
    return evaluationDate.getTime() > endDate.getTime();
  };

  return {
    periodMonths,
    startDate,
    endDate,
    coverageType,
    exclusions,
    requiresManualReview,
    requiresSerial,
    isExpiredAt,
  };
}

export function validateWarrantyConfig(
  config: unknown
): { valid: boolean; error?: string } {
  if (!config || typeof config !== 'object') {
    return { valid: false, error: 'Warranty config must be an object' };
  }

  const c = config as Record<string, unknown>;

  if (typeof c.periodMonths !== 'number' || !Number.isInteger(c.periodMonths) || c.periodMonths < 0) {
    return { valid: false, error: 'periodMonths must be a non-negative integer' };
  }

  const validTypes = ['MANUFACTURER', 'SHOP', 'EXTENDED', 'UNKNOWN'];
  if (c.type !== undefined && !validTypes.includes(String(c.type))) {
    return { valid: false, error: `type must be one of: ${validTypes.join(', ')}` };
  }

  return { valid: true };
}
