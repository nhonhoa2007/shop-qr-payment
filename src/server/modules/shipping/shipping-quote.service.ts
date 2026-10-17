import { prisma } from '@server/database/prisma';
import { calculateGHNFee } from './ghn.service.ts';
import { parseOrderItems, buildValidatedOrderItems } from '@shared/validations';
import { VIETNAM_LOCATIONS } from '@shared/constants/vietnam-locations';

export class QuoteError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export async function quoteShipping(input: {
  items?: unknown;
  toDistrictId?: unknown;
  toWardCode?: unknown;
}) {
  const toDistrictId = Number(input.toDistrictId);
  const toWardCode = typeof input.toWardCode === 'string' ? input.toWardCode.trim() : '';
  const validDistrict = VIETNAM_LOCATIONS.some((province) =>
    province.districts.some((district) => district.id === toDistrictId &&
      district.wards.some((ward) => ward.code === toWardCode)));
  if (!validDistrict) throw new QuoteError('Địa bàn nhận hàng không hợp lệ');

  const parsed = parseOrderItems(input.items);
  if (!parsed.items) throw new QuoteError(parsed.error || 'Giỏ hàng không hợp lệ');
  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(parsed.items.map((item) => item.productId))] } },
    include: { variants: { where: { isActive: true } } },
  });
  const validated = buildValidatedOrderItems(parsed.items, products);
  if (!validated.orderItems || validated.subtotal === undefined) {
    throw new QuoteError(validated.error || 'Giỏ hàng không hợp lệ');
  }
  const weight = validated.orderItems.reduce((sum, item) => sum + item.quantity * 300, 0) || 500;
  const fee = await calculateGHNFee({ toDistrictId, toWardCode, weight, subtotal: validated.subtotal });
  if (fee.source !== 'GHN_API') {
    throw new QuoteError('Không thể lấy phí GHN lúc này. Vui lòng thử lại sau.', 503);
  }
  return {
    toDistrictId, toWardCode,
    orderItems: validated.orderItems,
    subtotal: validated.subtotal,
    shippingFee: fee.totalFee,
    weight,
    fee,
  };
}
