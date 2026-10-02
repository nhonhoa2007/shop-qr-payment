import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  removeVietnameseTones,
  cleanSkuSegment,
  generateSkuPrefix,
  generateVariantSku,
  generateVariantMatrix,
  calculateVariantSummary,
  validateClientVariants,
} from '../src/shared/utils/product-variants.ts';

describe('Product Variant UI Utilities - Vietnamese & SKU Normalization', () => {
  it('should remove Vietnamese tones accurately', () => {
    assert.equal(removeVietnameseTones('Áo Sơ Mi Cổ Tàu'), 'Ao So Mi Co Tau');
    assert.equal(removeVietnameseTones('Đỏ Đậm / Xanh Biển'), 'Do Dam / Xanh Bien');
    assert.equal(removeVietnameseTones(''), '');
  });

  it('should clean string into a standardized uppercase alphanumeric SKU segment', () => {
    assert.equal(cleanSkuSegment('Áo Thun 100% Cotton!'), 'AO-THUN-100-COTTON');
    assert.equal(cleanSkuSegment('  Đỏ - Cherry  '), 'DO-CHERRY');
    assert.equal(cleanSkuSegment(''), '');
  });

  it('should generate meaningful SKU prefixes from product names', () => {
    assert.equal(generateSkuPrefix('Áo Polo Nam'), 'AO-POLO-NAM');
    assert.equal(generateSkuPrefix('Giày'), 'GIAY');
    assert.equal(generateSkuPrefix(''), 'PROD');
  });

  it('should generate variant SKU with prefix, color and size', () => {
    assert.equal(generateVariantSku('POLO', 'Đỏ', 'L'), 'POLO-DO-L');
    assert.equal(generateVariantSku('POLO', null, 'XL'), 'POLO-XL');
    assert.equal(generateVariantSku('POLO', 'Trắng', null), 'POLO-TRANG');
    assert.equal(generateVariantSku('POLO', null, null, 0), 'POLO-01');
  });
});

describe('Product Variant Matrix Generation - generateVariantMatrix', () => {
  it('should generate full matrix when both colors and sizes are present', () => {
    const variants = generateVariantMatrix({
      productName: 'Áo Thun Cao Cấp',
      skuPrefix: 'ATCC',
      colors: ['Đen', 'Trắng'],
      sizes: ['M', 'L'],
      basePrice: 150000,
      baseStock: 20,
    });

    assert.equal(variants.length, 4);
    assert.deepEqual(
      variants.map((v) => v.sku),
      ['ATCC-DEN-M', 'ATCC-DEN-L', 'ATCC-TRANG-M', 'ATCC-TRANG-L']
    );
    assert.equal(variants[0].title, 'Đen / M');
    assert.equal(variants[0].color, 'Đen');
    assert.equal(variants[0].size, 'M');
    assert.equal(variants[0].price, 150000);
    assert.equal(variants[0].stock, 20);
    assert.equal(variants[0].isActive, true);
  });

  it('should generate single-dimension variants when only colors are present', () => {
    const variants = generateVariantMatrix({
      skuPrefix: 'SON',
      colors: ['Đỏ Cam', 'Hồng Đào'],
      sizes: [],
      basePrice: 200000,
      baseStock: 15,
    });

    assert.equal(variants.length, 2);
    assert.equal(variants[0].sku, 'SON-DO-CAM');
    assert.equal(variants[0].title, 'Đỏ Cam');
    assert.equal(variants[0].color, 'Đỏ Cam');
    assert.equal(variants[0].size, null);
  });

  it('should generate single-dimension variants when only sizes are present', () => {
    const variants = generateVariantMatrix({
      skuPrefix: 'GIAY-CHAY',
      colors: [],
      sizes: ['39', '40', '41'],
      basePrice: 500000,
      baseStock: 10,
    });

    assert.equal(variants.length, 3);
    assert.equal(variants[0].sku, 'GIAY-CHAY-39');
    assert.equal(variants[0].title, 'Size 39');
    assert.equal(variants[0].color, null);
    assert.equal(variants[0].size, '39');
  });

  it('should return empty array when both colors and sizes are empty', () => {
    const variants = generateVariantMatrix({
      skuPrefix: 'EMPTY',
      colors: [],
      sizes: [],
      basePrice: 100000,
      baseStock: 5,
    });

    assert.equal(variants.length, 0);
  });
});

describe('Product Variant Calculation - calculateVariantSummary', () => {
  it('should return zero values for empty or undefined variants array', () => {
    const res = calculateVariantSummary([]);
    assert.equal(res.totalStock, 0);
    assert.equal(res.minPrice, 0);
    assert.equal(res.maxPrice, 0);
    assert.equal(res.hasPriceRange, false);
    assert.equal(res.activeCount, 0);
  });

  it('should calculate total stock and price range correctly for multiple variants', () => {
    const variants = [
      { price: 100000, stock: 15, isActive: true },
      { price: 120000, stock: 25, isActive: true },
      { price: 150000, stock: 10, isActive: false },
    ];

    const res = calculateVariantSummary(variants);
    assert.equal(res.totalStock, 50);
    assert.equal(res.minPrice, 100000);
    assert.equal(res.maxPrice, 150000);
    assert.equal(res.hasPriceRange, true);
    assert.equal(res.activeCount, 2);
  });

  it('should indicate hasPriceRange = false when all variants have the same price', () => {
    const variants = [
      { price: 100000, stock: 10, isActive: true },
      { price: 100000, stock: 20, isActive: true },
    ];

    const res = calculateVariantSummary(variants);
    assert.equal(res.hasPriceRange, false);
    assert.equal(res.minPrice, 100000);
    assert.equal(res.maxPrice, 100000);
  });
});

describe('Product Variant Validation - validateClientVariants', () => {
  it('should pass for a valid variant list', () => {
    const variants = [
      { sku: 'AO-01', title: 'Áo đỏ S', price: 100000, stock: 10 },
      { sku: 'AO-02', title: 'Áo đỏ M', price: 110000, stock: 15 },
    ];
    const res = validateClientVariants(variants);
    assert.equal(res.valid, true);
    assert.equal(res.error, undefined);
  });

  it('should fail when any variant has empty SKU', () => {
    const variants = [
      { sku: 'AO-01', title: 'Áo đỏ S', price: 100000, stock: 10 },
      { sku: '   ', title: 'Áo đỏ M', price: 110000, stock: 15 },
    ];
    const res = validateClientVariants(variants);
    assert.equal(res.valid, false);
    assert.match(res.error!, /chưa có mã SKU/);
  });

  it('should fail when variants have duplicate SKUs (case-insensitive)', () => {
    const variants = [
      { sku: 'AO-POLO-S', title: 'Size S', price: 100000, stock: 10 },
      { sku: 'ao-polo-s', title: 'Size S lặp lại', price: 100000, stock: 10 },
    ];
    const res = validateClientVariants(variants);
    assert.equal(res.valid, false);
    assert.match(res.error!, /bị trùng lặp/);
  });

  it('should fail when a variant has negative price or negative stock', () => {
    const resPrice = validateClientVariants([
      { sku: 'AO-01', price: -5000, stock: 10 },
    ]);
    assert.equal(resPrice.valid, false);
    assert.match(resPrice.error!, /Giá.*không hợp lệ/);

    const resStock = validateClientVariants([
      { sku: 'AO-01', price: 5000, stock: -2 },
    ]);
    assert.equal(resStock.valid, false);
    assert.match(resStock.error!, /Tồn kho.*không hợp lệ/);
  });
});
