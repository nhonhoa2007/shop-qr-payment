import { serializeMoneyVnd } from '@shared/utils/money';

export interface WarrantySnapshot {
  policyType?: string;
  periodMonths?: number;
  provider?: string;
  [key: string]: unknown;
}

export interface PackingLineSnapshot {
  unitWeightGrams: number;
  totalWeightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface OrderItemSnapshotResult {
  productName: string;
  sku: string;
  unitPrice: bigint;
  variantOptions: Record<string, unknown> | null;
  warrantySnapshot: WarrantySnapshot | null;
  packingLineSnapshot: PackingLineSnapshot;
  schemaRevision: number | null;
  sourceRevision: string | null;
}

export interface OrderItemSnapshotInput {
  product: {
    id: string;
    name: string;
    slug?: string | null;
    price: bigint | number | string;
    weightGrams?: number | null;
    lengthCm?: number | null;
    widthCm?: number | null;
    heightCm?: number | null;
    warrantyConfig?: unknown;
    categoryRef?: {
      id?: string;
      specSchemaVersion?: number | null;
      warrantyConfig?: unknown;
    } | null;
  };
  variant?: {
    id: string;
    sku: string;
    title?: string;
    price: bigint | number | string;
    optionValues?: unknown;
    warrantyConfig?: unknown;
  } | null;
  activeSource?: {
    id: string;
    version?: string | null;
    status: string;
  } | null;
  quantity: number;
  clientPayload?: unknown;
}

/**
 * Builds an immutable snapshot of commercial, warranty, and packing terms for an OrderItem.
 * Derives exclusively from verified database entities, completely ignoring client-provided overrides.
 */
export function buildOrderItemSnapshot(input: OrderItemSnapshotInput): OrderItemSnapshotResult {
  const { product, variant, activeSource, quantity } = input;

  const productName = product.name;
  const sku = variant?.sku || product.slug || product.id;
  const unitPrice =
    variant?.price !== undefined && variant?.price !== null
      ? typeof variant.price === 'bigint'
        ? variant.price
        : BigInt(variant.price)
      : typeof product.price === 'bigint'
      ? product.price
      : BigInt(product.price);

  let variantOptions: Record<string, unknown> | null = null;
  if (variant?.optionValues && typeof variant.optionValues === 'object') {
    if (Array.isArray(variant.optionValues)) {
      variantOptions = {};
      for (const opt of variant.optionValues) {
        if (opt && typeof opt === 'object' && 'code' in opt) {
          variantOptions[opt.code] = (opt as { value: unknown }).value;
        }
      }
    } else {
      variantOptions = { ...(variant.optionValues as Record<string, unknown>) };
    }
  }

  // Warranty resolution precedence: variant -> product -> category -> null
  const rawWarranty =
    variant?.warrantyConfig ??
    product.warrantyConfig ??
    product.categoryRef?.warrantyConfig ??
    null;

  const warrantySnapshot: WarrantySnapshot | null =
    rawWarranty && typeof rawWarranty === 'object'
      ? (rawWarranty as WarrantySnapshot)
      : null;

  // Packing dimensions fallback to safe defaults (200g, 20x15x5cm) for legacy/unspecified items
  const unitWeightGrams = product.weightGrams ?? 200;
  const lengthCm = product.lengthCm ?? 20;
  const widthCm = product.widthCm ?? 15;
  const heightCm = product.heightCm ?? 5;
  const totalWeightGrams = unitWeightGrams * Math.max(1, quantity);

  const packingLineSnapshot: PackingLineSnapshot = {
    unitWeightGrams,
    totalWeightGrams,
    lengthCm,
    widthCm,
    heightCm,
  };

  const schemaRevision = product.categoryRef?.specSchemaVersion ?? null;
  const sourceRevision =
    activeSource && activeSource.status === 'ACTIVE'
      ? activeSource.version ?? null
      : null;

  return {
    productName,
    sku,
    unitPrice,
    variantOptions,
    warrantySnapshot,
    packingLineSnapshot,
    schemaRevision,
    sourceRevision,
  };
}

export interface SerializedOrderItemDto {
  id: string;
  orderId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  productName: string;
  sku: string;
  variantOptions: Record<string, unknown> | null;
  unitPrice: {
    amount: string;
    currency: 'VND';
    revision: string;
  };
  price: string;
  warranty: WarrantySnapshot | null;
  packingLine: PackingLineSnapshot | null;
  schemaRevision: number | null;
  sourceRevision: string | null;
  returnedQuantity: number;
}

/**
 * Serializes an OrderItem for client-facing DTOs.
 * Prefers immutable historical snapshots, gracefully falling back to relations for legacy orders.
 */
export function serializeOrderItemDto(
  item: Record<string, unknown>
): SerializedOrderItemDto {
  const unitPriceBigInt =
    typeof item.unitPrice === 'bigint'
      ? item.unitPrice
      : typeof item.price === 'bigint'
      ? item.price
      : BigInt((item.unitPrice as string | number) ?? (item.price as string | number) ?? 0);

  const amountStr = serializeMoneyVnd(unitPriceBigInt);

  const product = item.product as { name?: string; slug?: string; warrantyConfig?: unknown } | undefined;
  const variant = item.variant as { sku?: string; optionValues?: unknown; warrantyConfig?: unknown } | undefined;

  // Preference order: snapshot field -> fallback relation
  const productName = (item.productName as string) || product?.name || '';
  const sku = (item.sku as string) || variant?.sku || product?.slug || (item.productId as string) || '';
  const variantOptions = ((item.variantOptions as Record<string, unknown>) ?? variant?.optionValues ?? null) as Record<string, unknown> | null;
  const warranty = (item.warrantySnapshot ??
    variant?.warrantyConfig ??
    product?.warrantyConfig ??
    null) as WarrantySnapshot | null;
  const packingLine = (item.packingLineSnapshot as PackingLineSnapshot) ?? null;

  return {
    id: item.id as string,
    orderId: item.orderId as string,
    productId: item.productId as string,
    variantId: (item.variantId as string | null) ?? null,
    quantity: item.quantity as number,
    productName,
    sku,
    variantOptions,
    unitPrice: {
      amount: amountStr,
      currency: 'VND',
      revision: (item.sourceRevision as string) || 'catalog',
    },
    price: amountStr,
    warranty,
    packingLine,
    schemaRevision: (item.schemaRevision as number | null) ?? null,
    sourceRevision: (item.sourceRevision as string | null) ?? null,
    returnedQuantity: (item.returnedQuantity as number) ?? 0,
  };
}
