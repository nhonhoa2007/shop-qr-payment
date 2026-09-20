import { MAX_QUANTITY_PER_ITEM } from '../constants/index.ts';
import type { OrderRequestItem } from '../types/index.ts';

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
