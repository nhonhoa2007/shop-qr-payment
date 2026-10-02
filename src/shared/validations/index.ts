import { MAX_QUANTITY_PER_ITEM } from '../constants/index.ts';
import type { OrderRequestItem, ValidatedOrderItem, Product, ProductVariant } from '../types/index.ts';
import { calculateCheckoutTotals } from '../utils/checkout.ts';

export { MAX_QUANTITY_PER_ITEM };
export type { OrderRequestItem, ValidatedOrderItem };

export type ProductWithVariants = Product & {
  variants?: ProductVariant[];
};

export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  const trimmed = phone.trim();
  const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
  return trimmed.length >= 9 && phoneRegex.test(trimmed);
}

export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export function isValidPassword(password: string, minLength = 6): boolean {
  if (!password || typeof password !== 'string') return false;
  return password.trim().length >= minLength;
}

export function isValidOrderCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  return /^DH[A-Z0-9_-]+$/i.test(code.trim());
}

export function parseOrderItems(value: unknown): { items?: OrderRequestItem[]; error?: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: 'Giỏ hàng trống' };
  }

  const items: OrderRequestItem[] = [];
  for (const rawItem of value) {
    if (!rawItem || typeof rawItem !== 'object') {
      return { error: 'Dữ liệu giỏ hàng không hợp lệ' };
    }

    const item = rawItem as { productId?: unknown; variantId?: unknown; quantity?: unknown };
    const quantity = Number(item.quantity);
    if (typeof item.productId !== 'string' || item.productId.trim().length === 0) {
      return { error: 'Thiếu mã sản phẩm' };
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { error: 'Số lượng sản phẩm không hợp lệ' };
    }
    if (quantity > MAX_QUANTITY_PER_ITEM) {
      return { error: `Mỗi sản phẩm chỉ được đặt tối đa ${MAX_QUANTITY_PER_ITEM} món` };
    }

    const variantId =
      typeof item.variantId === 'string' && item.variantId.trim().length > 0
        ? item.variantId.trim()
        : undefined;

    items.push({
      productId: item.productId.trim(),
      ...(variantId ? { variantId } : {}),
      quantity,
    });
  }

  return { items };
}

export function buildValidatedOrderItems(
  requestedItems: OrderRequestItem[],
  products: ProductWithVariants[]
): {
  orderItems?: ValidatedOrderItem[];
  subtotal?: number;
  totalAmount?: number;
  shippingFee?: number;
  error?: string;
} {
  const productsById = new Map(products.map((product) => [product.id, product]));
  let subtotal = 0;
  const orderItems: ValidatedOrderItem[] = [];

  for (const item of requestedItems) {
    const product = productsById.get(item.productId);
    if (!product || !product.isActive) {
      return { error: 'Sản phẩm không tồn tại hoặc đã ngừng bán' };
    }

    if (item.variantId) {
      const variant = product.variants?.find((v) => v.id === item.variantId);
      if (!variant || !variant.isActive) {
        return { error: 'Biến thể sản phẩm không tồn tại hoặc đã ngừng bán' };
      }
      if (variant.stock < item.quantity) {
        return { error: `Biến thể "${variant.title}" chỉ còn ${variant.stock} món` };
      }

      const itemPrice = variant.price;
      subtotal += itemPrice * item.quantity;
      orderItems.push({
        productId: product.id,
        variantId: variant.id,
        variantTitle: variant.title,
        quantity: item.quantity,
        price: itemPrice,
      });
    } else {
      const activeVariants = product.variants?.filter((v) => v.isActive) || [];
      if (activeVariants.length > 0) {
        return { error: `Vui lòng chọn phân loại hàng cho sản phẩm "${product.name}"` };
      }

      if (product.stock < item.quantity) {
        return { error: `Sản phẩm "${product.name}" chỉ còn ${product.stock} món` };
      }

      subtotal += product.price * item.quantity;
      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        price: product.price,
      });
    }
  }

  const totals = calculateCheckoutTotals(subtotal);
  return { orderItems, ...totals };
}
