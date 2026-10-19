import crypto from 'node:crypto';
import { serializeMoneyVnd } from '@shared/utils/money';
import {
  type PackingSourceItem,
  type PackingSnapshot,
  PackingDataMissingError,
} from '@shared/types/packing';

export { PackingDataMissingError, type PackingSourceItem, type PackingSnapshot };

/**
 * Builds a deterministic, immutable packing snapshot from items and insured amount.
 * Enforces that all items have positive weight and dimensions (> 0).
 * Calculates rectangular bounding box: maximum footprint (length, width) and stacked height.
 */
export function buildPackingSnapshot(
  items: PackingSourceItem[],
  insuredValue: bigint
): PackingSnapshot {
  const missingItems: Array<{ productId: string; variantId?: string | null; field: string }> = [];

  for (const item of items) {
    if (!item.weightGrams || item.weightGrams <= 0) {
      missingItems.push({ productId: item.productId, variantId: item.variantId, field: 'weightGrams' });
    }
    if (!item.lengthCm || item.lengthCm <= 0) {
      missingItems.push({ productId: item.productId, variantId: item.variantId, field: 'lengthCm' });
    }
    if (!item.widthCm || item.widthCm <= 0) {
      missingItems.push({ productId: item.productId, variantId: item.variantId, field: 'widthCm' });
    }
    if (!item.heightCm || item.heightCm <= 0) {
      missingItems.push({ productId: item.productId, variantId: item.variantId, field: 'heightCm' });
    }
  }

  if (missingItems.length > 0) {
    throw new PackingDataMissingError(
      'Một số sản phẩm thiếu thông số đóng gói (trọng lượng hoặc kích thước)',
      missingItems
    );
  }

  let totalWeightGrams = 0;
  let maxLengthCm = 0;
  let maxWidthCm = 0;
  let totalHeightCm = 0;

  const lines = items.map((item) => {
    const qty = Math.max(1, item.quantity);
    const weight = item.weightGrams!;
    const l = item.lengthCm!;
    const w = item.widthCm!;
    const h = item.heightCm!;

    totalWeightGrams += weight * qty;
    if (l > maxLengthCm) maxLengthCm = l;
    if (w > maxWidthCm) maxWidthCm = w;
    totalHeightCm += h * qty;

    return {
      productId: item.productId,
      variantId: item.variantId || null,
      unitWeightGrams: weight,
      quantity: qty,
    };
  });

  const finalLengthCm = Math.max(1, maxLengthCm);
  const finalWidthCm = Math.max(1, maxWidthCm);
  const finalHeightCm = Math.max(1, totalHeightCm);
  const insuredValueStr = serializeMoneyVnd(insuredValue);

  // Deterministic revision hash
  const sortedLines = lines
    .slice()
    .sort((a, b) => `${a.productId}:${a.variantId}`.localeCompare(`${b.productId}:${b.variantId}`));

  const revisionPayload = JSON.stringify({
    totalWeightGrams,
    lengthCm: finalLengthCm,
    widthCm: finalWidthCm,
    heightCm: finalHeightCm,
    insuredValue: insuredValueStr,
    lines: sortedLines,
  });

  const revision = crypto.createHash('sha256').update(revisionPayload).digest('hex').slice(0, 16);

  return {
    totalWeightGrams,
    lengthCm: finalLengthCm,
    widthCm: finalWidthCm,
    heightCm: finalHeightCm,
    insuredValue: insuredValueStr,
    revision,
    lines,
  };
}
