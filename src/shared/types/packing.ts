import type { MoneyVnd } from './money';

export interface PackingLineItem {
  orderItemId?: string;
  productId: string;
  variantId: string | null;
  unitWeightGrams: number;
  quantity: number;
}

export interface PackingSourceItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
  weightGrams?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
}

export interface PackingSnapshot {
  totalWeightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  insuredValue: MoneyVnd;
  revision: string;
  lines: Array<{
    orderItemId?: string;
    productId: string;
    variantId: string | null;
    unitWeightGrams: number;
    quantity: number;
  }>;
}

export class PackingDataMissingError extends Error {
  code = 'PACKING_DATA_MISSING';
  missingItems: Array<{ productId: string; variantId?: string | null; field: string }>;

  constructor(
    message: string,
    missingItems: Array<{ productId: string; variantId?: string | null; field: string }>
  ) {
    super(message);
    this.name = 'PackingDataMissingError';
    this.missingItems = missingItems;
  }
}
