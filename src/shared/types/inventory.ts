export type InventoryMode = 'BASE' | 'VARIANT';

export interface OrderStockItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface ProductStockShape {
  id: string;
  name: string;
  inventoryMode: InventoryMode;
  stock: number;
  isActive: boolean;
  variants?: Array<{
    id: string;
    title: string;
    stock: number;
    isActive: boolean;
  }>;
}

export type StockTargetResult =
  | { valid: true; variantId: string | null; targetStock: number; targetTitle: string }
  | { valid: false; error: string };

/**
 * Validates whether an order stock request matches the product's explicit inventory mode.
 * - VARIANT product requires a valid, active variantId.
 * - BASE product rejects variantId.
 * - Inactive product or variant is rejected.
 */
export function validateStockTarget(
  product: ProductStockShape,
  item: OrderStockItem
): StockTargetResult {
  if (!product.isActive) {
    return { valid: false, error: `Sản phẩm "${product.name}" đã ngừng bán` };
  }

  if (product.inventoryMode === 'VARIANT') {
    if (!item.variantId) {
      return {
        valid: false,
        error: `Sản phẩm "${product.name}" yêu cầu chọn phân loại biến thể`,
      };
    }
    const variant = product.variants?.find((v) => v.id === item.variantId);
    if (!variant || !variant.isActive) {
      return {
        valid: false,
        error: `Biến thể sản phẩm không tồn tại hoặc đã ngừng bán`,
      };
    }
    if (variant.stock < item.quantity) {
      return {
        valid: false,
        error: `Biến thể "${variant.title}" chỉ còn ${variant.stock} món`,
      };
    }
    return {
      valid: true,
      variantId: variant.id,
      targetStock: variant.stock,
      targetTitle: variant.title,
    };
  } else {
    // BASE mode
    if (item.variantId) {
      return {
        valid: false,
        error: `Sản phẩm "${product.name}" không có phân loại biến thể`,
      };
    }
    if (product.stock < item.quantity) {
      return {
        valid: false,
        error: `Sản phẩm "${product.name}" chỉ còn ${product.stock} món`,
      };
    }
    return {
      valid: true,
      variantId: null,
      targetStock: product.stock,
      targetTitle: product.name,
    };
  }
}

/**
 * Normalizes an array of OrderStockItem before CAS reservation.
 * Merges duplicate entries of the same (productId, variantId) to prevent
 * sequential partial mutation ambiguity and race conditions.
 */
export function normalizeOrderStockItems(items: OrderStockItem[]): OrderStockItem[] {
  const merged = new Map<string, OrderStockItem>();

  for (const item of items) {
    const key = `${item.productId}:${item.variantId || 'base'}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      merged.set(key, {
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: item.quantity,
      });
    }
  }

  return Array.from(merged.values());
}
