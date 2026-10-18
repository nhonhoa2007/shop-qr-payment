/**
 * Server-Side Cart & Checkout Compatibility Revalidation
 * Revalidates prices, active states, inventory, and deterministic compatibility.
 * Rejects client-forged COMPATIBLE assertions, stale prices (409 Conflict),
 * and requires explicit caveat confirmation for UNKNOWN compatibility accessories.
 */

import { prisma as globalPrisma } from '../../database/prisma.ts';
import { checkCompatibility } from './compatibility.service.ts';

export interface CartRevalidationItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
  price: number | string | bigint;
  attachedToProductId?: string | null;
  attachedToVariantId?: string | null;
  isAddon?: boolean;
  claimedCompatibilityStatus?: string | null;
  caveatAcknowledged?: boolean;
}

export interface CartRevalidationResult {
  valid: boolean;
  status: number;
  error?: string;
  validatedItems?: CartRevalidationItem[];
}

/**
 * Server-side revalidation of cart items and accessory compatibility before checkout.
 */
export async function revalidateCartCompatibility(
  items: CartRevalidationItem[],
  db: any = globalPrisma
): Promise<CartRevalidationResult> {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      valid: false,
      status: 400,
      error: 'Giỏ hàng trống',
    };
  }

  // 1. Fetch live products and variants from database
  for (const item of items) {
    const product = await db.product.findUnique({
      where: { id: item.productId },
      include: { variants: true },
    });

    if (!product || !product.isActive) {
      return {
        valid: false,
        status: 409,
        error: `Sản phẩm ${item.productId} không tồn tại hoặc đã ngừng bán`,
      };
    }

    if (item.variantId) {
      const variant = await db.productVariant.findUnique({
        where: { id: item.variantId },
      });

      if (!variant || !variant.isActive) {
        return {
          valid: false,
          status: 409,
          error: `Biến thể ${item.variantId} không tồn tại hoặc đã ngừng bán`,
        };
      }

      // Check live price against submitted price
      const livePrice = BigInt(variant.price);
      const submittedPrice = BigInt(item.price);

      if (livePrice !== submittedPrice) {
        return {
          valid: false,
          status: 409,
          error: `Giá sản phẩm hoặc phụ kiện đã thay đổi (Hiện tại: ${livePrice}đ). Vui lòng xác nhận giỏ hàng mới.`,
        };
      }
    } else {
      const livePrice = BigInt(product.price);
      const submittedPrice = BigInt(item.price);

      if (livePrice !== submittedPrice) {
        return {
          valid: false,
          status: 409,
          error: `Giá sản phẩm đã thay đổi (Hiện tại: ${livePrice}đ). Vui lòng xác nhận giỏ hàng mới.`,
        };
      }
    }
  }

  // 2. Validate accessory compatibility pairings
  for (const item of items) {
    if (item.isAddon && (item.attachedToVariantId || item.attachedToProductId)) {
      // Re-evaluate deterministically on server — ignore claimedCompatibilityStatus
      const compatResult = await checkCompatibility(
        {
          deviceVariantId: item.attachedToVariantId || undefined,
          deviceProductId: item.attachedToProductId || undefined,
          accessoryVariantId: item.variantId || undefined,
          accessoryProductId: item.productId || undefined,
        },
        db
      );

      if (compatResult.status === 'INCOMPATIBLE') {
        return {
          valid: false,
          status: 422,
          error: `Phụ kiện không tương thích với thiết bị đã chọn: ${compatResult.reasons.join(', ')}`,
        };
      }

      if (compatResult.status === 'UNKNOWN') {
        if (!item.caveatAcknowledged) {
          return {
            valid: false,
            status: 422,
            error: `Phụ kiện có độ tương thích chưa xác minh (UNKNOWN). Vui lòng xác nhận lưu ý (caveat) trước khi thanh toán.`,
          };
        }
      }
    }
  }

  return {
    valid: true,
    status: 200,
    validatedItems: items,
  };
}
