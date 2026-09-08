import type { Product } from '@prisma/client';
import { calculateCheckoutTotals } from './checkout.ts';

export const MAX_QUANTITY_PER_ITEM = 99;

export interface OrderRequestItem {
  productId: string;
  quantity: number;
}

export interface ValidatedOrderItem {
  productId: string;
  quantity: number;
  price: number;
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

    const item = rawItem as { productId?: unknown; quantity?: unknown };
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

    items.push({ productId: item.productId, quantity });
  }

  return { items };
}

export function buildValidatedOrderItems(
  requestedItems: OrderRequestItem[],
  products: Product[]
): { orderItems?: ValidatedOrderItem[]; subtotal?: number; totalAmount?: number; shippingFee?: number; error?: string } {
  const productsById = new Map(products.map((product) => [product.id, product]));
  let subtotal = 0;
  const orderItems: ValidatedOrderItem[] = [];

  for (const item of requestedItems) {
    const product = productsById.get(item.productId);
    if (!product || !product.isActive) {
      return { error: 'Sản phẩm không tồn tại hoặc đã ngừng bán' };
    }
    if (product.stock < item.quantity) {
      return { error: `Sản phẩm "${product.name}" chỉ còn ${product.stock} món` };
    }

    subtotal += product.price * item.quantity;
    orderItems.push({ productId: product.id, quantity: item.quantity, price: product.price });
  }

  const totals = calculateCheckoutTotals(subtotal);
  return { orderItems, ...totals };
}
