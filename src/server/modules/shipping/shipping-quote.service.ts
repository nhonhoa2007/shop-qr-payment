import { prisma } from '@server/database/prisma';
import { calculateGHNFee } from './ghn.service.ts';
import { parseOrderItems, buildValidatedOrderItems } from '@shared/validations';
import { VIETNAM_LOCATIONS } from '@shared/constants/vietnam-locations';
import { buildPackingSnapshot } from './packing.service.ts';

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

  const productMap = new Map(products.map((p) => [p.id, p]));
  const packingItems = validated.orderItems.map((item) => {
    const prod = productMap.get(item.productId);
    const variant = item.variantId ? prod?.variants?.find((v) => v.id === item.variantId) : null;
    return {
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      weightGrams: variant?.weightGrams ?? prod?.weightGrams ?? 300,
      lengthCm: variant?.lengthCm ?? prod?.lengthCm ?? 20,
      widthCm: variant?.widthCm ?? prod?.widthCm ?? 15,
      heightCm: variant?.heightCm ?? prod?.heightCm ?? 5,
    };
  });

  const packingSnapshot = buildPackingSnapshot(packingItems, BigInt(validated.subtotal));
  const fee = await calculateGHNFee({
    toDistrictId,
    toWardCode,
    weight: packingSnapshot.totalWeightGrams,
    subtotal: validated.subtotal,
  });
  if (fee.source !== 'GHN_API') {
    throw new QuoteError('Không thể lấy phí GHN lúc này. Vui lòng thử lại sau.', 503);
  }
  return {
    toDistrictId,
    toWardCode,
    orderItems: validated.orderItems,
    subtotal: validated.subtotal,
    shippingFee: fee.totalFee,
    weight: packingSnapshot.totalWeightGrams,
    packingSnapshot,
    packingRevision: packingSnapshot.revision,
    fee,
  };
}
