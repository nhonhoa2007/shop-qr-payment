import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText,
  normalizeNonNegativeInt,
  validateVariantInput,
  validateVariantsArray,
  calculateTotalVariantStock,
  syncProductTotalStock,
  createProductWithVariants,
  updateProductWithVariants,
  deleteProductOrVariant,
  type TransactionClient,
  type ValidatedVariantInput, } from '@server/modules/products/product.service';

describe('Product Variant - Input Validation & Boundary Testing (Pillar 2)', () => {
  it('should normalize strings: trim whitespaces and return null for empty/whitespace-only/non-strings', () => {
    assert.equal(normalizeText('   Áo Polo Thể Thao Nam   '), 'Áo Polo Thể Thao Nam');
    assert.equal(normalizeText('      '), null);
    assert.equal(normalizeText(''), null);
    assert.equal(normalizeText(null), null);
    assert.equal(normalizeText(undefined), null);
    assert.equal(normalizeText(12345), null);
    assert.equal(normalizeText({}), null);
  });

  it('should normalize non-negative integers: handle numbers, numeric strings, rounding, and reject negatives/invalid', () => {
    assert.equal(normalizeNonNegativeInt(0), 0);
    assert.equal(normalizeNonNegativeInt(450000), 450000);
    assert.equal(normalizeNonNegativeInt('450000'), 450000);
    assert.equal(normalizeNonNegativeInt('  120000  '), 120000);
    assert.equal(normalizeNonNegativeInt(99.6), 100);
    assert.equal(normalizeNonNegativeInt(99.2), 99);

    // Negative values
    assert.equal(normalizeNonNegativeInt(-1), null);
    assert.equal(normalizeNonNegativeInt(-50000), null);

    // Non-numeric or empty
    assert.equal(normalizeNonNegativeInt(''), null);
    assert.equal(normalizeNonNegativeInt('abc'), null);
    assert.equal(normalizeNonNegativeInt(null), null);
    assert.equal(normalizeNonNegativeInt(undefined), null);
    assert.equal(normalizeNonNegativeInt(Number.NaN), null);
    assert.equal(normalizeNonNegativeInt(Number.POSITIVE_INFINITY), null);
  });

  it('should strictly validate SKU requirements and support both sku and SKU keys', () => {
    // Missing SKU
    assert.equal(validateVariantInput({ title: 'Đen / M', price: 100000 }).valid, false);
    assert.equal(validateVariantInput({ sku: '   ', title: 'Đen / M', price: 100000 }).valid, false);

    // Valid sku lowercase
    const res1 = validateVariantInput({ sku: 'POLO-BLK-M', title: 'Đen / M', price: 100000 });
    assert.equal(res1.valid, true);
    assert.equal(res1.variant?.sku, 'POLO-BLK-M');

    // Valid SKU uppercase key
    const res2 = validateVariantInput({ SKU: 'POLO-WHT-L', title: 'Trắng / L', price: 110000 });
    assert.equal(res2.valid, true);
    assert.equal(res2.variant?.sku, 'POLO-WHT-L');
  });

  it('should reject invalid title, price or negative stock', () => {
    // Missing title
    assert.equal(validateVariantInput({ sku: 'SKU1', price: 100000 }).valid, false);
    assert.equal(validateVariantInput({ sku: 'SKU1', title: '  ', price: 100000 }).valid, false);

    // Invalid price
    assert.equal(validateVariantInput({ sku: 'SKU1', title: 'Title', price: -5000 }).valid, false);
    assert.equal(validateVariantInput({ sku: 'SKU1', title: 'Title', price: 'invalid' }).valid, false);

    // Negative stock
    assert.equal(validateVariantInput({ sku: 'SKU1', title: 'Title', price: 50000, stock: -1 }).valid, false);
  });

  it('should detect duplicate SKUs within payload in a case-insensitive manner', () => {
    const duplicatePayload = [
      { sku: 'TSHIRT-RED-M', title: 'Đỏ / M', price: 150000, stock: 10 },
      { sku: 'tshirt-red-m', title: 'Đỏ / M (trùng)', price: 150000, stock: 5 },
    ];
    const res = validateVariantsArray(duplicatePayload);
    assert.equal(res.valid, false);
    assert.match(res.error || '', /trùng lặp/i);
  });

  it('should accept valid array of multiple distinct variants', () => {
    const validVariants = [
      { sku: 'VAR-1', title: 'Xanh / S', price: 120000, stock: 10, color: 'Xanh', size: 'S' },
      { sku: 'VAR-2', title: 'Xanh / M', price: 120000, stock: 15, color: 'Xanh', size: 'M' },
      { sku: 'VAR-3', title: 'Đỏ / L', price: 130000, stock: 20, color: 'Đỏ', size: 'L' },
    ];
    const res = validateVariantsArray(validVariants);
    assert.equal(res.valid, true);
    assert.equal(res.variants?.length, 3);
  });
});

describe('Product Variant - Transactional Stock Synchronization (Pillar 1 & 4)', () => {
  it('should accurately calculate total variant stock across arbitrary variants', () => {
    assert.equal(calculateTotalVariantStock([]), 0);
    assert.equal(calculateTotalVariantStock([{ stock: 10 }, { stock: 25 }, { stock: 15 }]), 50);
    assert.equal(calculateTotalVariantStock([{ stock: 0 }, { stock: 0 }]), 0);
    assert.equal(calculateTotalVariantStock([{ stock: 999999 }]), 999999);
  });

  it('syncProductTotalStock should query database variants, sum stocks, and update product stock atomically', async () => {
    let queriedProductId = '';
    let updatedPayload: Record<string, unknown> = {};

    const mockTx = {
      productVariant: {
        findMany: async ({ where }: { where: { productId: string } }) => {
          queriedProductId = where.productId;
          return [
            { id: 'v1', stock: 35 },
            { id: 'v2', stock: 65 },
          ];
        },
      },
      product: {
        update: async (args: Record<string, unknown>) => {
          updatedPayload = args;
          return { id: 'p_100', stock: 100 };
        },
      },
    } as unknown as TransactionClient;

    const totalStock = await syncProductTotalStock(mockTx, 'p_100');
    assert.equal(totalStock, 100);
    assert.equal(queriedProductId, 'p_100');
    assert.deepEqual(updatedPayload, {
      where: { id: 'p_100' },
      data: { stock: 100 },
    });
  });

  it('createProductWithVariants should create base product and set base stock = sum of variant stocks', async () => {
    let capturedCreateArgs: unknown = null;

    const mockTx = {
      product: {
        create: async (args: unknown) => {
          capturedCreateArgs = args;
          return {
            id: 'prod_new_01',
            name: 'Giày Thể Thao Sneaker',
            stock: 45,
            variants: [
              { id: 'v1', sku: 'SNK-39', stock: 20 },
              { id: 'v2', sku: 'SNK-40', stock: 25 },
            ],
          };
        },
      },
    } as unknown as TransactionClient;

    const variants: ValidatedVariantInput[] = [
      { sku: 'SNK-39', title: 'Size 39', price: 650000, stock: 20, isActive: true },
      { sku: 'SNK-40', title: 'Size 40', price: 650000, stock: 25, isActive: true },
    ];

    const result = await createProductWithVariants(mockTx, {
      name: 'Giày Thể Thao Sneaker',
      price: 650000,
      variants,
    });

    assert.equal(result.id, 'prod_new_01');
    assert.equal(result.stock, 45);

    const args = capturedCreateArgs as { data: { stock: number; variants: { create: unknown[] } } };
    assert.equal(args.data.stock, 45);
    assert.equal(args.data.variants.create.length, 2);
  });

  it('createProductWithVariants should fallback to direct stock when product has no variants', async () => {
    let capturedCreateArgs: unknown = null;

    const mockTx = {
      product: {
        create: async (args: unknown) => {
          capturedCreateArgs = args;
          return {
            id: 'prod_single_01',
            name: 'Nón Bảo Hiểm',
            stock: 15,
            variants: [],
          };
        },
      },
    } as unknown as TransactionClient;

    const result = await createProductWithVariants(mockTx, {
      name: 'Nón Bảo Hiểm',
      price: 250000,
      stock: 15,
    });

    assert.equal(result.id, 'prod_single_01');
    assert.equal(result.stock, 15);
    const args = capturedCreateArgs as { data: { stock: number } };
    assert.equal(args.data.stock, 15);
  });
});

describe('Product Variant - Nested Update, Deletion & Financial History Safety (Pillar 3 & 4)', () => {
  it('updateProductWithVariants should throw NOT_FOUND if product does not exist', async () => {
    const mockTx = {
      product: {
        findUnique: async () => null,
      },
    } as unknown as TransactionClient;

    await assert.rejects(
      async () => {
        await updateProductWithVariants(mockTx, { id: 'non_existent_prod' });
      },
      { message: 'NOT_FOUND' }
    );
  });

  it('updateProductWithVariants should update existing variants, create new variants, and re-sync total stock', async () => {
    const updatedVariants: Array<{ id: string; data: Record<string, unknown> }> = [];
    const createdVariants: Array<Record<string, unknown>> = [];
    let updatedProductData: Record<string, unknown> = {};

    const mockTx = {
      product: {
        findUnique: async () => ({
          id: 'prod_existing',
          name: 'Áo Thun',
          variants: [
            { id: 'v_old_1', sku: 'AT-S', title: 'Size S', price: 100000, stock: 10, isActive: true },
            { id: 'v_old_2', sku: 'AT-M', title: 'Size M', price: 100000, stock: 20, isActive: true },
          ],
        }),
        update: async (args: Record<string, unknown>) => {
          updatedProductData = args;
          return { id: 'prod_existing', stock: 45 };
        },
      },
      productVariant: {
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          updatedVariants.push({ id: where.id, data });
          return { id: where.id, ...data };
        },
        create: async ({ data }: { data: Record<string, unknown> }) => {
          createdVariants.push(data);
          return { id: 'v_new_3', ...data };
        },
        findMany: async () => [
          { id: 'v_old_1', stock: 15 },
          { id: 'v_old_2', stock: 20 },
          { id: 'v_new_3', stock: 10 },
        ],
      },
      orderItem: {
        count: async () => 0,
      },
    } as unknown as TransactionClient;

    const incomingVariants: ValidatedVariantInput[] = [
      { id: 'v_old_1', sku: 'AT-S', title: 'Size S (Sửa)', price: 110000, stock: 15, isActive: true },
      { id: 'v_old_2', sku: 'AT-M', title: 'Size M', price: 100000, stock: 20, isActive: true },
      { sku: 'AT-L', title: 'Size L (Mới)', price: 120000, stock: 10, isActive: true },
    ];

    await updateProductWithVariants(mockTx, {
      id: 'prod_existing',
      name: 'Áo Thun Cao Cấp',
      variants: incomingVariants,
    });

    // Variant v_old_1 must be updated
    assert.equal(updatedVariants.length, 2);
    assert.equal(updatedVariants[0].id, 'v_old_1');
    assert.equal(updatedVariants[0].data.stock, 15);

    // New variant AT-L must be created
    assert.equal(createdVariants.length, 1);
    assert.equal(createdVariants[0].sku, 'AT-L');
    assert.equal(createdVariants[0].stock, 10);

    // Total stock updated on base product: 15 + 20 + 10 = 45
    const data = (updatedProductData as { data: { stock: number } }).data;
    assert.equal(data.stock, 45);
  });

  it('updateProductWithVariants: removed variant with NO order items should be HARD-DELETED', async () => {
    let deletedVariantId = '';

    const mockTx = {
      product: {
        findUnique: async () => ({
          id: 'prod_1',
          variants: [
            { id: 'var_keep', sku: 'KEEP-01', stock: 10 },
            { id: 'var_remove_no_orders', sku: 'REMOVE-01', stock: 5 },
          ],
        }),
        update: async () => ({ id: 'prod_1', stock: 10 }),
      },
      productVariant: {
        update: async () => ({}),
        delete: async ({ where }: { where: { id: string } }) => {
          deletedVariantId = where.id;
          return {};
        },
        findMany: async () => [{ id: 'var_keep', stock: 10 }],
      },
      orderItem: {
        count: async () => 0, // No order items -> hard delete allowed
      },
    } as unknown as TransactionClient;

    // Incoming payload omits var_remove_no_orders
    await updateProductWithVariants(mockTx, {
      id: 'prod_1',
      variants: [{ id: 'var_keep', sku: 'KEEP-01', title: 'Keep', price: 100000, stock: 10, isActive: true }],
    });

    assert.equal(deletedVariantId, 'var_remove_no_orders');
  });

  it('updateProductWithVariants: removed variant WITH order items must be SOFT-DELETED (isActive=false, stock=0) to preserve financial history', async () => {
    let softDeletedVariant: { id: string; data: Record<string, unknown> } | null = null;

    const mockTx = {
      product: {
        findUnique: async () => ({
          id: 'prod_1',
          variants: [
            { id: 'var_keep', sku: 'KEEP-01', stock: 10 },
            { id: 'var_has_orders', sku: 'ORDERED-01', stock: 8 },
          ],
        }),
        update: async () => ({ id: 'prod_1', stock: 10 }),
      },
      productVariant: {
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          if (where.id === 'var_has_orders') {
            softDeletedVariant = { id: where.id, data };
          }
          return {};
        },
        delete: async () => {
          assert.fail('Should NOT hard-delete variant with existing order items');
        },
        findMany: async () => [{ id: 'var_keep', stock: 10 }],
      },
      orderItem: {
        count: async () => 3, // Has 3 orders! Must soft-delete!
      },
    } as unknown as TransactionClient;

    await updateProductWithVariants(mockTx, {
      id: 'prod_1',
      variants: [{ id: 'var_keep', sku: 'KEEP-01', title: 'Keep', price: 100000, stock: 10, isActive: true }],
    });

    assert.ok(softDeletedVariant);
    assert.deepEqual((softDeletedVariant as { id: string; data: Record<string, unknown> }).data, {
      isActive: false,
      stock: 0,
    });
  });

  it('deleteProductOrVariant: variant deletion with order item protection and stock re-sync', async () => {
    // 1. Variant not found
    const notFoundTx = {
      productVariant: { findUnique: async () => null },
    } as unknown as TransactionClient;

    await assert.rejects(
      async () => {
        await deleteProductOrVariant(notFoundTx, { variantId: 'missing_var' });
      },
      { message: 'VARIANT_NOT_FOUND' }
    );

    // 2. Soft-delete when orderItem count > 0
    let softUpdated = false;
    const orderedTx = {
      productVariant: {
        findUnique: async () => ({ id: 'var_with_orders', productId: 'p1' }),
        update: async () => {
          softUpdated = true;
          return {};
        },
        findMany: async () => [{ id: 'var_remaining', stock: 25 }],
      },
      orderItem: { count: async () => 5 },
      product: {
        update: async ({ data }: { data: { stock: number } }) => ({ id: 'p1', stock: data.stock }),
      },
    } as unknown as TransactionClient;

    const delRes = await deleteProductOrVariant(orderedTx, { variantId: 'var_with_orders' });
    assert.equal(softUpdated, true);
    assert.equal(delRes.type, 'VARIANT');
    assert.equal((delRes.product as { stock: number }).stock, 25);
  });

  it('deleteProductOrVariant: deactivating base product should cascade deactivation to all its variants', async () => {
    let variantsDeactivated = false;
    let productDeactivated = false;

    const mockTx = {
      product: {
        findUnique: async () => ({ id: 'prod_to_deactivate' }),
        update: async ({ data }: { data: { isActive: boolean } }) => {
          if (data.isActive === false) productDeactivated = true;
          return { id: 'prod_to_deactivate', isActive: false };
        },
      },
      productVariant: {
        updateMany: async ({ where, data }: { where: { productId: string }; data: { isActive: boolean } }) => {
          if (where.productId === 'prod_to_deactivate' && data.isActive === false) {
            variantsDeactivated = true;
          }
          return { count: 4 };
        },
      },
    } as unknown as TransactionClient;

    const res = await deleteProductOrVariant(mockTx, { productId: 'prod_to_deactivate' });
    assert.equal(res.type, 'PRODUCT');
    assert.equal(variantsDeactivated, true);
    assert.equal(productDeactivated, true);
  });
});
