import type { ProductVariantInput } from '../types';

/**
 * Loại bỏ dấu tiếng Việt để chuyển thành chuỗi không dấu chuẩn mã SKU / Slug
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Chuẩn hóa một thành phần chuỗi thành phân đoạn SKU hợp lệ (chỉ A-Z, 0-9 và gạch ngang)
 */
export function cleanSkuSegment(str: string): string {
  if (!str) return '';
  return removeVietnameseTones(str)
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Tạo tiền tố SKU thông minh từ tên sản phẩm
 * Ví dụ: "Áo Thun Polo Nam" -> "ATPN" hoặc "AO-THUN-POLO"
 */
export function generateSkuPrefix(productName: string): string {
  if (!productName || !productName.trim()) return 'PROD';
  const clean = cleanSkuSegment(productName);
  const parts = clean.split('-').filter(Boolean);
  if (parts.length === 0) return 'PROD';
  
  if (parts.length === 1) {
    return parts[0].slice(0, 8);
  }

  // Nếu nhiều từ, lấy các từ chính (tối đa 3-4 từ, tổng không quá 12 ký tự)
  const shortPrefix = parts.slice(0, 3).join('-');
  return shortPrefix.length <= 15 ? shortPrefix : parts.map((p) => p[0]).join('');
}

/**
 * Tạo mã SKU duy nhất cho một biến thể từ tiền tố, màu, size và chỉ mục
 */
export function generateVariantSku(
  prefix: string,
  color?: string | null,
  size?: string | null,
  index?: number
): string {
  const safePrefix = cleanSkuSegment(prefix) || 'PROD';
  const colorPart = color ? cleanSkuSegment(color) : '';
  const sizePart = size ? cleanSkuSegment(size) : '';

  const segments = [safePrefix, colorPart, sizePart].filter(Boolean);
  if (segments.length === 1 && typeof index === 'number') {
    segments.push(String(index + 1).padStart(2, '0'));
  }
  return segments.join('-');
}

export interface MatrixOptions {
  productName?: string;
  skuPrefix?: string;
  colors: string[];
  sizes: string[];
  basePrice: number;
  baseStock: number;
}

/**
 * Sinh ma trận tổ hợp biến thể (Size x Màu sắc) tự động
 */
export function generateVariantMatrix(options: MatrixOptions): ProductVariantInput[] {
  const { colors, sizes, basePrice, baseStock, productName, skuPrefix } = options;
  const prefix = skuPrefix?.trim() || (productName ? generateSkuPrefix(productName) : 'PROD');

  const cleanColors = colors.map((c) => c.trim()).filter(Boolean);
  const cleanSizes = sizes.map((s) => s.trim()).filter(Boolean);

  const results: ProductVariantInput[] = [];

  // Trường hợp 1: Có cả Màu và Kích cỡ (Tổ hợp Màu x Size)
  if (cleanColors.length > 0 && cleanSizes.length > 0) {
    cleanColors.forEach((color) => {
      cleanSizes.forEach((size) => {
        const sku = generateVariantSku(prefix, color, size);
        results.push({
          sku,
          title: `${color} / ${size}`,
          color,
          size,
          price: Math.max(0, basePrice),
          stock: Math.max(0, baseStock),
          isActive: true,
        });
      });
    });
    return results;
  }

  // Trường hợp 2: Chỉ có Màu
  if (cleanColors.length > 0) {
    cleanColors.forEach((color, idx) => {
      const sku = generateVariantSku(prefix, color, null, idx);
      results.push({
        sku,
        title: color,
        color,
        size: null,
        price: Math.max(0, basePrice),
        stock: Math.max(0, baseStock),
        isActive: true,
      });
    });
    return results;
  }

  // Trường hợp 3: Chỉ có Kích cỡ
  if (cleanSizes.length > 0) {
    cleanSizes.forEach((size, idx) => {
      const sku = generateVariantSku(prefix, null, size, idx);
      results.push({
        sku,
        title: `Size ${size}`,
        color: null,
        size,
        price: Math.max(0, basePrice),
        stock: Math.max(0, baseStock),
        isActive: true,
      });
    });
    return results;
  }

  return results;
}

/**
 * Tính toán tóm tắt thông số của danh sách biến thể (tổng kho, khoảng giá)
 */
export function calculateVariantSummary(
  variants: { price: number; stock?: number; isActive?: boolean }[]
): {
  totalStock: number;
  minPrice: number;
  maxPrice: number;
  hasPriceRange: boolean;
  activeCount: number;
} {
  if (!variants || variants.length === 0) {
    return {
      totalStock: 0,
      minPrice: 0,
      maxPrice: 0,
      hasPriceRange: false,
      activeCount: 0,
    };
  }

  let totalStock = 0;
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let activeCount = 0;

  for (const v of variants) {
    const isAct = v.isActive !== false;
    if (isAct) activeCount++;
    totalStock += Math.max(0, Number(v.stock) || 0);

    const price = Math.max(0, Number(v.price) || 0);
    if (price < minPrice) minPrice = price;
    if (price > maxPrice) maxPrice = price;
  }

  if (minPrice === Infinity) minPrice = 0;
  if (maxPrice === -Infinity) maxPrice = 0;

  return {
    totalStock,
    minPrice,
    maxPrice,
    hasPriceRange: minPrice !== maxPrice && activeCount > 1,
    activeCount,
  };
}

/**
 * Kiểm tra tính hợp lệ của danh sách biến thể trên form phía client trước khi submit
 */
export function validateClientVariants(
  variants: { sku: string; price: number; stock?: number; title?: string }[]
): { valid: boolean; error?: string } {
  if (!Array.isArray(variants)) {
    return { valid: false, error: 'Danh sách biến thể không hợp lệ' };
  }

  const seenSkus = new Set<string>();

  for (let i = 0; i < variants.length; i++) {
    const item = variants[i];
    const sku = (item.sku || '').trim();
    if (!sku) {
      return {
        valid: false,
        error: `Biến thể số ${i + 1} (${item.title || 'Chưa đặt tên'}) chưa có mã SKU`,
      };
    }

    const lowerSku = sku.toLowerCase();
    if (seenSkus.has(lowerSku)) {
      return {
        valid: false,
        error: `Mã SKU "${sku}" bị trùng lặp trong danh sách biến thể`,
      };
    }
    seenSkus.add(lowerSku);

    if (item.price === undefined || item.price === null || Number(item.price) < 0) {
      return {
        valid: false,
        error: `Giá của biến thể SKU "${sku}" không hợp lệ (phải >= 0)`,
      };
    }

    if (item.stock !== undefined && item.stock !== null && Number(item.stock) < 0) {
      return {
        valid: false,
        error: `Tồn kho của biến thể SKU "${sku}" không hợp lệ (phải >= 0)`,
      };
    }
  }

  return { valid: true };
}
