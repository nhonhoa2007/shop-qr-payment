import type { Prisma, PrismaClient } from '@prisma/client';

export type TransactionClient = Prisma.TransactionClient | PrismaClient;

export interface ValidatedVariantInput {
  id?: string;
  sku: string;
  title: string;
  price: number;
  stock: number;
  color?: string | null;
  size?: string | null;
  image?: string | null;
  isActive: boolean;
}

export interface CreateProductInput {
  name: string;
  description?: string | null;
  price: number;
  image?: string | null;
  category?: string | null;
  stock?: number;
  isActive?: boolean;
  variants?: ValidatedVariantInput[];
}

export interface UpdateProductInput {
  id: string;
  name?: string;
  description?: string | null;
  price?: number;
  image?: string | null;
  category?: string | null;
  stock?: number;
  isActive?: boolean;
  variants?: ValidatedVariantInput[];
}

/**
 * Chuẩn hóa chuỗi văn bản: trim khoảng trắng và trả về null nếu chuỗi rỗng
 */
export function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Chuẩn hóa số nguyên không âm: trả về số nguyên >= 0 hoặc null nếu không hợp lệ
 */
export function normalizeNonNegativeInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return null;
  return Math.round(numberValue);
}

/**
 * Xác thực và chuẩn hóa dữ liệu của một biến thể sản phẩm (ProductVariant)
 */
export function validateVariantInput(raw: unknown): {
  valid: boolean;
  variant?: ValidatedVariantInput;
  error?: string;
} {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Dữ liệu biến thể không hợp lệ' };
  }

  const v = raw as Record<string, unknown>;
  const rawSku = v.sku ?? v.SKU;
  const sku = normalizeText(rawSku);
  if (!sku) {
    return { valid: false, error: 'Mã SKU biến thể không được để trống' };
  }

  const title = normalizeText(v.title);
  if (!title) {
    return { valid: false, error: 'Tiêu đề biến thể không được để trống' };
  }

  const price = normalizeNonNegativeInt(v.price);
  if (price === null) {
    return { valid: false, error: `Giá của biến thể "${title}" không hợp lệ` };
  }

  let stock = 0;
  if (v.stock !== undefined && v.stock !== null) {
    const parsedStock = normalizeNonNegativeInt(v.stock);
    if (parsedStock === null) {
      return { valid: false, error: `Số lượng tồn kho của biến thể "${title}" không hợp lệ` };
    }
    stock = parsedStock;
  }

  const id = normalizeText(v.id) || undefined;
  const color = normalizeText(v.color);
  const size = normalizeText(v.size);
  const image = normalizeText(v.image);
  const isActive = typeof v.isActive === 'boolean' ? v.isActive : true;

  return {
    valid: true,
    variant: {
      id,
      sku,
      title,
      price,
      stock,
      color,
      size,
      image,
      isActive,
    },
  };
}

/**
 * Xác thực mảng biến thể, kiểm tra SKU trùng lặp nội bộ trong payload
 */
export function validateVariantsArray(rawList: unknown): {
  valid: boolean;
  variants?: ValidatedVariantInput[];
  error?: string;
} {
  if (!Array.isArray(rawList)) {
    return { valid: false, error: 'Danh sách biến thể phải là một mảng' };
  }

  const validated: ValidatedVariantInput[] = [];
  const seenSkus = new Set<string>();

  for (const item of rawList) {
    const res = validateVariantInput(item);
    if (!res.valid || !res.variant) {
      return { valid: false, error: res.error };
    }

    const lowerSku = res.variant.sku.toLowerCase();
    if (seenSkus.has(lowerSku)) {
      return { valid: false, error: `Mã SKU trùng lặp trong danh sách: ${res.variant.sku}` };
    }
    seenSkus.add(lowerSku);

    validated.push(res.variant);
  }

  return { valid: true, variants: validated };
}

/**
 * Tính tổng số lượng tồn kho của danh sách biến thể
 */
export function calculateTotalVariantStock(variants: { stock: number }[]): number {
  return variants.reduce((sum, v) => sum + (v.stock || 0), 0);
}

/**
 * Đồng bộ tồn kho tổng của sản phẩm gốc dựa trên tổng tồn kho của các biến thể
 */
export async function syncProductTotalStock(
  tx: TransactionClient,
  productId: string
): Promise<number> {
  const variants = await tx.productVariant.findMany({
    where: { productId },
  });
  const totalStock = calculateTotalVariantStock(variants);
  await tx.product.update({
    where: { id: productId },
    data: { stock: totalStock },
  });
  return totalStock;
}

/**
 * Tạo sản phẩm mới kèm mảng biến thể lồng nhau trong Prisma Transaction
 * Đồng bộ tồn kho tổng của sản phẩm gốc = tổng tồn kho biến thể
 */
export async function createProductWithVariants(
  tx: TransactionClient,
  input: CreateProductInput
) {
  const hasVariants = Boolean(input.variants && input.variants.length > 0);
  const computedStock = hasVariants
    ? calculateTotalVariantStock(input.variants!)
    : (input.stock ?? 0);

  const product = await tx.product.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      image: input.image ?? null,
      category: input.category ?? null,
      stock: computedStock,
      isActive: input.isActive !== false,
      ...(hasVariants
        ? {
            variants: {
              create: input.variants!.map((v) => ({
                sku: v.sku,
                title: v.title,
                price: v.price,
                stock: v.stock,
                color: v.color ?? null,
                size: v.size ?? null,
                image: v.image ?? null,
                isActive: v.isActive,
              })),
            },
          }
        : {}),
    },
    include: {
      variants: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return product;
}

/**
 * Cập nhật sản phẩm và danh sách biến thể lồng nhau trong Prisma Transaction:
 * - Biến thể có id: cập nhật (update)
 * - Biến thể không có id: tạo mới (create)
 * - Biến thể bị xóa khỏi danh sách: xóa (delete) hoặc soft-delete nếu đã có OrderItem
 * - Tự động đồng bộ tồn kho tổng của sản phẩm gốc
 */
export async function updateProductWithVariants(
  tx: TransactionClient,
  input: UpdateProductInput
) {
  const existingProduct = await tx.product.findUnique({
    where: { id: input.id },
    include: {
      variants: true,
    },
  });

  if (!existingProduct) {
    throw new Error('NOT_FOUND');
  }

  // Khi có truyền trường variants (kể cả mảng rỗng)
  if (input.variants !== undefined) {
    const incomingList = input.variants;
    const existingVariantMap = new Map(existingProduct.variants.map((v) => [v.id, v]));

    // 1. Cập nhật biến thể cũ hoặc tạo biến thể mới
    for (const v of incomingList) {
      if (v.id && existingVariantMap.has(v.id)) {
        await tx.productVariant.update({
          where: { id: v.id },
          data: {
            sku: v.sku,
            title: v.title,
            price: v.price,
            stock: v.stock,
            color: v.color ?? null,
            size: v.size ?? null,
            image: v.image ?? null,
            isActive: v.isActive,
          },
        });
      } else {
        await tx.productVariant.create({
          data: {
            productId: input.id,
            sku: v.sku,
            title: v.title,
            price: v.price,
            stock: v.stock,
            color: v.color ?? null,
            size: v.size ?? null,
            image: v.image ?? null,
            isActive: v.isActive,
          },
        });
      }
    }

    // 2. Xử lý các biến thể đã bị gỡ bỏ khỏi payload
    const incomingIds = new Set(incomingList.filter((v) => v.id).map((v) => v.id));
    const removedVariants = existingProduct.variants.filter((v) => !incomingIds.has(v.id));

    for (const rem of removedVariants) {
      const orderItemCount = await tx.orderItem.count({ where: { variantId: rem.id } });
      if (orderItemCount > 0) {
        // Soft-delete để bảo toàn toàn vẹn dữ liệu đơn hàng và lịch sử tài chính
        await tx.productVariant.update({
          where: { id: rem.id },
          data: { isActive: false, stock: 0 },
        });
      } else {
        await tx.productVariant.delete({ where: { id: rem.id } });
      }
    }

    // 3. Tính toán lại tồn kho tổng từ danh sách biến thể sau đồng bộ
    const currentVariants = await tx.productVariant.findMany({
      where: { productId: input.id },
    });
    const totalStock = currentVariants.length > 0
      ? calculateTotalVariantStock(currentVariants)
      : (input.stock !== undefined ? input.stock : 0);

    // 4. Cập nhật thông tin sản phẩm gốc kèm tồn kho tổng đã đồng bộ
    const updatedProduct = await tx.product.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.image !== undefined ? { image: input.image } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        stock: totalStock,
        ...(typeof input.isActive === 'boolean' ? { isActive: input.isActive } : {}),
      },
      include: {
        variants: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return updatedProduct;
  }

  // Trường hợp cập nhật không truyền variants (chỉ update thông tin chung của sản phẩm)
  const updatedProduct = await tx.product.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.image !== undefined ? { image: input.image } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.stock !== undefined ? { stock: input.stock } : {}),
      ...(typeof input.isActive === 'boolean' ? { isActive: input.isActive } : {}),
    },
    include: {
      variants: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return updatedProduct;
}

/**
 * Xóa hoặc ngừng hoạt động biến thể hoặc sản phẩm:
 * - variantId: Xóa biến thể (hoặc soft-delete nếu có OrderItem) và đồng bộ lại tồn kho sản phẩm gốc
 * - productId: Ngừng hoạt động (isActive = false) cho sản phẩm và tất cả biến thể
 */
export async function deleteProductOrVariant(
  tx: TransactionClient,
  params: { productId?: string; variantId?: string }
) {
  if (params.variantId) {
    const variant = await tx.productVariant.findUnique({
      where: { id: params.variantId },
    });
    if (!variant) {
      throw new Error('VARIANT_NOT_FOUND');
    }

    const orderItemCount = await tx.orderItem.count({
      where: { variantId: params.variantId },
    });

    if (orderItemCount > 0) {
      await tx.productVariant.update({
        where: { id: params.variantId },
        data: { isActive: false, stock: 0 },
      });
    } else {
      await tx.productVariant.delete({
        where: { id: params.variantId },
      });
    }

    // Đồng bộ lại tồn kho tổng sản phẩm gốc
    const remaining = await tx.productVariant.findMany({
      where: { productId: variant.productId },
    });
    const totalStock = calculateTotalVariantStock(remaining);
    const product = await tx.product.update({
      where: { id: variant.productId },
      data: { stock: totalStock },
      include: {
        variants: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return { type: 'VARIANT' as const, variantId: params.variantId, product };
  }

  if (params.productId) {
    const existing = await tx.product.findUnique({
      where: { id: params.productId },
    });
    if (!existing) {
      throw new Error('PRODUCT_NOT_FOUND');
    }

    // Ngừng hoạt động sản phẩm và các biến thể liên quan
    await tx.productVariant.updateMany({
      where: { productId: params.productId },
      data: { isActive: false },
    });

    const product = await tx.product.update({
      where: { id: params.productId },
      data: { isActive: false },
      include: {
        variants: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return { type: 'PRODUCT' as const, productId: params.productId, product };
  }

  throw new Error('MISSING_ID');
}
