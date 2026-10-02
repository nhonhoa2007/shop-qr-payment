import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeText,
  normalizeNonNegativeInt,
  validateVariantInput,
  validateVariantsArray,
  calculateTotalVariantStock,
  syncProductTotalStock,
  createProductWithVariants,
  updateProductWithVariants,
  deleteProductOrVariant,
  type TransactionClient,
  type ValidatedVariantInput,
} from '../src/lib/product.ts';

describe('Product Variant - Normalization & Input Validation', () => {
  it('should normalize text by trimming and converting empty string to null', () => {
    assert.equal(normalizeText('  Áo thun Polo  '), 'Áo thun Polo');
    assert.equal(normalizeText('   '), null);
    assert.equal(normalizeText(''), null);
    assert.equal(normalizeText(123), null);
    assert.equal(normalizeText(null), null);
    assert.equal(normalizeText(undefined), null);
  });

  it('should normalize non-negative integers properly', () => {
    assert.equal(normalizeNonNegativeInt(0), 0);
    assert.equal(normalizeNonNegativeInt('150000'), 150000);
    assert.equal(normalizeNonNegativeInt(299000.4), 299000);
    assert.equal(normalizeNonNegativeInt(-5), null);
    assert.equal(normalizeNonNegativeInt('abc'), null);
    assert.equal(normalizeNonNegativeInt(null), null);
    assert.equal(normalizeNonNegativeInt(''), null);
  });

  it('should reject invalid or non-object variant input', () => {
    const res1 = validateVariantInput(null);
    assert.equal(res1.valid, false);
    assert.match(res1.error || '', /dữ liệu biến thể không hợp lệ/i);

    const res2 = validateVariantInput('invalid-string');
    assert.equal(res2.valid, false);
    assert.match(res2.error || '', /dữ liệu biến thể không hợp lệ/i);
  });

  it('should reject variant when SKU is missing or empty', () => {
    const res = validateVariantInput({
      title: 'Size L / Đen',
      price: 250000,
    });
    assert.equal(res.valid, false);
    assert.match(res.error || '', /mã sku/i);
  });

  it('should accept both "sku" and "SKU" keys for SKU property', () => {
    const res1 = validateVariantInput({
      sku: 'POLO-DEN-L',
      title: 'Size L / Đen',
      price: 250000,
      stock: 10,
    });
    assert.equal(res1.valid, true);
    assert.equal(res1.variant?.sku, 'POLO-DEN-L');

    const res2 = validateVariantInput({
      SKU: 'POLO-TRANG-M',
      title: 'Size M / Trắng',
      price: 250000,
      stock: 5,
    });
    assert.equal(res2.valid, true);
    assert.equal(res2.variant?.sku, 'POLO-TRANG-M');
  });

  it('should reject variant when title is missing or empty', () => {
    const res = validateVariantInput({
      sku: 'SKU-001',
      price: 100000,
    });
    assert.equal(res.valid, false);
    assert.match(res.error || '', /tiêu đề/i);
  });

  it('should reject variant when price is invalid or negative', () => {
    const res1 = validateVariantInput({
      sku: 'SKU-001',
      title: 'Size M',
      price: -1000,
    });
    assert.equal(res1.valid, false);
    assert.match(res1.error || '', /giá/i);

    const res2 = validateVariantInput({
      sku: 'SKU-001',
      title: 'Size M',
      price: 'invalid-price',
    });
    assert.equal(res2.valid, false);
    assert.match(res2.error || '', /giá/i);
  });

  it('should default stock to 0 if stock is omitted, or parse valid stock', () => {
    const res1 = validateVariantInput({
      sku: 'SKU-DEFAULT-STOCK',
      title: 'Default Stock Variant',
      price: 120000,
    });
    assert.equal(res1.valid, true);
    assert.equal(res1.variant?.stock, 0);

    const res2 = validateVariantInput({
      sku: 'SKU-CUSTOM-STOCK',
      title: 'Custom Stock Variant',
      price: 120000,
      stock: '25',
    });
    assert.equal(res2.valid, true);
    assert.equal(res2.variant?.stock, 25);
  });

  it('should reject variant when stock is negative', () => {
    const res = validateVariantInput({
      sku: 'SKU-NEG',
      title: 'Negative Stock Variant',
      price: 120000,
      stock: -5,
    });
    assert.equal(res.valid, false);
    assert.match(res.error || '', /tồn kho/i);
  });

  it('should correctly normalize color, size, image and isActive fields', () => {
    const res = validateVariantInput({
      id: 'var_123',
      sku: 'VAR-123',
      title: 'Đen / XL',
      price: 280000,
      stock: 12,
      color: '  Đen  ',
      size: '  XL  ',
      image: '  https://example.com/black.jpg  ',
      isActive: false,
    });
    assert.equal(res.valid, true);
    assert.equal(res.variant?.id, 'var_123');
    assert.equal(res.variant?.color, 'Đen');
    assert.equal(res.variant?.size, 'XL');
    assert.equal(res.variant?.image, 'https://example.com/black.jpg');
    assert.equal(res.variant?.isActive, false);
  });
});

describe('Product Variant Array Validation - validateVariantsArray', () => {
  it('should reject non-array payload', () => {
    const res = validateVariantsArray('not-an-array');
    assert.equal(res.valid, false);
    assert.match(res.error || '', /mảng/i);
  });

  it('should accept empty array', () => {
    const res = validateVariantsArray([]);
    assert.equal(res.valid, true);
    assert.deepEqual(res.variants, []);
  });

  it('should reject if any variant within array is invalid', () => {
    const res = validateVariantsArray([
      { sku: 'SKU-1', title: 'Variant 1', price: 100000 },
      { sku: '', title: 'Variant 2', price: 200000 }, // Missing SKU
    ]);
    assert.equal(res.valid, false);
    assert.match(res.error || '', /mã sku/i);
  });

  it('should reject duplicate SKUs within the same payload', () => {
    const res = validateVariantsArray([
      { sku: 'DUPLICATE-SKU', title: 'Variant 1', price: 100000 },
      { sku: 'duplicate-sku', title: 'Variant 2', price: 200000 },
    ]);
    assert.equal(res.valid, false);
    assert.match(res.error || '', /trùng lặp/i);
  });

  it('should parse valid array of multiple variants', () => {
    const res = validateVariantsArray([
      { sku: 'AT-DEN-M', title: 'Đen / M', price: 150000, stock: 10 },
      { sku: 'AT-DEN-L', title: 'Đen / L', price: 160000, stock: 15 },
      { sku: 'AT-TRANG-M', title: 'Trắng / M', price: 150000, stock: 5 },
    ]);
    assert.equal(res.valid, true);
    assert.equal(res.variants?.length, 3);
  });
});

describe('Product Variant Stock Calculation & Synchronization', () => {
  it('should calculate total variant stock correctly', () => {
    const variants = [
      { stock: 15 },
      { stock: 25 },
      { stock: 0 },
      { stock: 8 },
    ];
    assert.equal(calculateTotalVariantStock(variants), 48);
  });

  it('should sync product total stock in database to match variants total', async () => {
    let updateArgs: unknown = null;
    const fakeTx = {
      productVariant: {
        findMany: async () => [
          { id: 'v1', stock: 10 },
          { id: 'v2', stock: 20 },
        ],
      },
      product: {
        update: async (args: unknown) => {
          updateArgs = args;
          return { id: 'prod_1', stock: 30 };
        },
      },
    } as unknown as TransactionClient;

    const total = await syncProductTotalStock(fakeTx, 'prod_1');
    assert.equal(total, 30);
    assert.deepEqual(updateArgs, {
      where: { id: 'prod_1' },
      data: { stock: 30 },
    });
  });
});

describe('createProductWithVariants - Transactional Creation', () => {
  it('should create base product with its own stock when no variants are provided', async () => {
    let createArgs: unknown = null;
    const fakeTx = {
      product: {
        create: async (args: unknown) => {
          createArgs = args;
          return {
            id: 'prod_simple',
            name: 'Cốc sứ',
            stock: 20,
            variants: [],
          };
        },
      },
    } as unknown as TransactionClient;

    const product = await createProductWithVariants(fakeTx, {
      name: 'Cốc sứ',
      price: 50000,
      stock: 20,
    });

    assert.equal(product.id, 'prod_simple');
    assert.deepEqual(createArgs, {
      data: {
        name: 'Cốc sứ',
        description: null,
        price: 50000,
        image: null,
        category: null,
        stock: 20,
        isActive: true,
      },
      include: {
        variants: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  });

  it('should create product and nested variants, setting base product stock = sum of variant stocks', async () => {
    let createArgs: unknown = null;
    const variants: ValidatedVariantInput[] = [
      {
        sku: 'AO-DEN-M',
        title: 'Đen / M',
        price: 200000,
        stock: 12,
        color: 'Đen',
        size: 'M',
        image: null,
        isActive: true,
      },
      {
        sku: 'AO-DEN-L',
        title: 'Đen / L',
        price: 210000,
        stock: 18,
        color: 'Đen',
        size: 'L',
        image: null,
        isActive: true,
      },
    ];

    const fakeTx = {
      product: {
        create: async (args: unknown) => {
          createArgs = args;
          return {
            id: 'prod_with_var',
            name: 'Áo thun có biến thể',
            stock: 30, // 12 + 18 = 30
            variants,
          };
        },
      },
    } as unknown as TransactionClient;

    const product = await createProductWithVariants(fakeTx, {
      name: 'Áo thun có biến thể',
      price: 200000,
      stock: 999, // Should be overridden by sum of variants (30)
      variants,
    });

    assert.equal(product.stock, 30);
    assert.deepEqual(createArgs, {
      data: {
        name: 'Áo thun có biến thể',
        description: null,
        price: 200000,
        image: null,
        category: null,
        stock: 30, // Đồng bộ tổng tồn kho
        isActive: true,
        variants: {
          create: [
            {
              sku: 'AO-DEN-M',
              title: 'Đen / M',
              price: 200000,
              stock: 12,
              color: 'Đen',
              size: 'M',
              image: null,
              isActive: true,
            },
            {
              sku: 'AO-DEN-L',
              title: 'Đen / L',
              price: 210000,
              stock: 18,
              color: 'Đen',
              size: 'L',
              image: null,
              isActive: true,
            },
          ],
        },
      },
      include: {
        variants: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  });
});

describe('updateProductWithVariants - Transactional Nested Update & Sync', () => {
  it('should throw NOT_FOUND if target product does not exist', async () => {
    const fakeTx = {
      product: {
        findUnique: async () => null,
      },
    } as unknown as TransactionClient;

    await assert.rejects(
      async () => {
        await updateProductWithVariants(fakeTx, { id: 'non_existent' });
      },
      { message: 'NOT_FOUND' }
    );
  });

  it('should update base product fields without touching variants when variants is undefined', async () => {
    let updateData: unknown = null;
    const fakeTx = {
      product: {
        findUnique: async () => ({
          id: 'prod_1',
          name: 'Old Name',
          variants: [{ id: 'var_1', stock: 5 }],
        }),
        update: async (args: unknown) => {
          updateData = args;
          return { id: 'prod_1', name: 'New Name' };
        },
      },
    } as unknown as TransactionClient;

    await updateProductWithVariants(fakeTx, {
      id: 'prod_1',
      name: 'New Name',
      price: 180000,
    });

    assert.deepEqual(updateData, {
      where: { id: 'prod_1' },
      data: {
        name: 'New Name',
        price: 180000,
      },
      include: {
        variants: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  });

  it('should update existing variants, create new variants, and synchronize total stock', async () => {
    const existingVariants = [
      { id: 'var_existing_1', sku: 'SKU-1', title: 'Old 1', price: 100000, stock: 10, isActive: true },
      { id: 'var_existing_2', sku: 'SKU-2', title: 'Old 2', price: 120000, stock: 5, isActive: true },
    ];

    const updatedVariantCalls: unknown[] = [];
    const createdVariantCalls: unknown[] = [];
    let productUpdateCall: unknown = null;

    const fakeTx = {
      product: {
        findUnique: async () => ({
          id: 'prod_1',
          name: 'Product with variants',
          stock: 15,
          variants: existingVariants,
        }),
        update: async (args: unknown) => {
          productUpdateCall = args;
          return { id: 'prod_1', ...((args as { data: Record<string, unknown> }).data) };
        },
      },
      productVariant: {
        update: async (args: unknown) => {
          updatedVariantCalls.push(args);
          return args;
        },
        create: async (args: unknown) => {
          createdVariantCalls.push(args);
          return args;
        },
        findMany: async () => [
          { id: 'var_existing_1', stock: 25 }, // Updated stock
          { id: 'var_existing_2', stock: 5 },
          { id: 'var_new_3', stock: 15 }, // New variant stock
        ],
      },
      orderItem: {
        count: async () => 0,
      },
    } as unknown as TransactionClient;

    const incomingVariants: ValidatedVariantInput[] = [
      {
        id: 'var_existing_1',
        sku: 'SKU-1',
        title: 'Updated Title 1',
        price: 110000,
        stock: 25,
        isActive: true,
      },
      {
        id: 'var_existing_2',
        sku: 'SKU-2',
        title: 'Old 2',
        price: 120000,
        stock: 5,
        isActive: true,
      },
      {
        // New variant without id
        sku: 'SKU-NEW-3',
        title: 'Brand New Variant 3',
        price: 150000,
        stock: 15,
        isActive: true,
      },
    ];

    await updateProductWithVariants(fakeTx, {
      id: 'prod_1',
      name: 'Updated Product Name',
      variants: incomingVariants,
    });

    // Verify existing variant was updated
    assert.equal(updatedVariantCalls.length, 2);
    // Verify new variant was created
    assert.equal(createdVariantCalls.length, 1);
    assert.deepEqual(createdVariantCalls[0], {
      data: {
        productId: 'prod_1',
        sku: 'SKU-NEW-3',
        title: 'Brand New Variant 3',
        price: 150000,
        stock: 15,
        color: null,
        size: null,
        image: null,
        isActive: true,
      },
    });

    // Verify base product stock was synchronized to 25 + 5 + 15 = 45
    assert.deepEqual(productUpdateCall, {
      where: { id: 'prod_1' },
      data: {
        name: 'Updated Product Name',
        stock: 45,
      },
      include: {
        variants: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  });

  it('should delete removed variant when it has NO order items, and re-sync stock', async () => {
    const existingVariants = [
      { id: 'var_keep', sku: 'SKU-KEEP', title: 'Keep', price: 100000, stock: 10 },
      { id: 'var_remove_no_orders', sku: 'SKU-REM', title: 'Remove', price: 100000, stock: 5 },
    ];

    let deleteCalledWith: unknown = null;

    const fakeTx = {
      product: {
        findUnique: async () => ({
          id: 'prod_1',
          variants: existingVariants,
        }),
        update: async (args: unknown) => args,
      },
      productVariant: {
        update: async () => {},
        create: async () => {},
        delete: async (args: unknown) => {
          deleteCalledWith = args;
        },
        findMany: async () => [{ id: 'var_keep', stock: 10 }],
      },
      orderItem: {
        count: async () => 0, // No order items
      },
    } as unknown as TransactionClient;

    await updateProductWithVariants(fakeTx, {
      id: 'prod_1',
      variants: [
        {
          id: 'var_keep',
          sku: 'SKU-KEEP',
          title: 'Keep',
          price: 100000,
          stock: 10,
          isActive: true,
        },
      ],
    });

    assert.deepEqual(deleteCalledWith, { where: { id: 'var_remove_no_orders' } });
  });

  it('should soft-delete removed variant (isActive: false, stock: 0) when it HAS order items', async () => {
    const existingVariants = [
      { id: 'var_keep', sku: 'SKU-KEEP', title: 'Keep', price: 100000, stock: 10 },
      { id: 'var_remove_ordered', sku: 'SKU-ORDERED', title: 'Has Orders', price: 100000, stock: 8 },
    ];

    const updatedVariants: Array<{ where?: { id?: string }; data?: unknown }> = [];
    let deleteCalled = false;

    const fakeTx = {
      product: {
        findUnique: async () => ({
          id: 'prod_1',
          variants: existingVariants,
        }),
        update: async (args: unknown) => args,
      },
      productVariant: {
        update: async (args: { where?: { id?: string }; data?: unknown }) => {
          updatedVariants.push(args);
        },
        create: async () => {},
        delete: async () => {
          deleteCalled = true;
        },
        findMany: async () => [{ id: 'var_keep', stock: 10 }, { id: 'var_remove_ordered', stock: 0 }],
      },
      orderItem: {
        count: async (args: { where: { variantId: string } }) => {
          return args.where.variantId === 'var_remove_ordered' ? 3 : 0;
        },
      },
    } as unknown as TransactionClient;

    await updateProductWithVariants(fakeTx, {
      id: 'prod_1',
      variants: [
        {
          id: 'var_keep',
          sku: 'SKU-KEEP',
          title: 'Keep',
          price: 100000,
          stock: 10,
          isActive: true,
        },
      ],
    });

    assert.equal(deleteCalled, false);
    const softDeleted = updatedVariants.find(
      (u: { where?: { id?: string } }) => u.where?.id === 'var_remove_ordered'
    );
    assert.deepEqual(softDeleted, {
      where: { id: 'var_remove_ordered' },
      data: { isActive: false, stock: 0 },
    });
  });
});

describe('deleteProductOrVariant - Granular Deletion & Inventory Restitution', () => {
  it('should throw VARIANT_NOT_FOUND when variantId does not exist', async () => {
    const fakeTx = {
      productVariant: {
        findUnique: async () => null,
      },
    } as unknown as TransactionClient;

    await assert.rejects(
      async () => {
        await deleteProductOrVariant(fakeTx, { variantId: 'missing_var' });
      },
      { message: 'VARIANT_NOT_FOUND' }
    );
  });

  it('should delete variant without order items and re-sync base product stock', async () => {
    let deletedWith: unknown = null;
    let productUpdatedWith: unknown = null;

    const fakeTx = {
      productVariant: {
        findUnique: async () => ({
          id: 'var_delete_me',
          productId: 'prod_parent',
          stock: 10,
        }),
        delete: async (args: unknown) => {
          deletedWith = args;
        },
        findMany: async () => [{ id: 'var_remaining', stock: 20 }],
      },
      orderItem: {
        count: async () => 0,
      },
      product: {
        update: async (args: unknown) => {
          productUpdatedWith = args;
          return { id: 'prod_parent', stock: 20 };
        },
      },
    } as unknown as TransactionClient;

    const result = await deleteProductOrVariant(fakeTx, { variantId: 'var_delete_me' });
    assert.equal(result.type, 'VARIANT');
    assert.deepEqual(deletedWith, { where: { id: 'var_delete_me' } });
    assert.deepEqual(productUpdatedWith, {
      where: { id: 'prod_parent' },
      data: { stock: 20 },
      include: {
        variants: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  });

  it('should soft-delete variant with order items (isActive: false, stock: 0) and re-sync stock', async () => {
    let variantUpdatedWith: unknown = null;

    const fakeTx = {
      productVariant: {
        findUnique: async () => ({
          id: 'var_has_orders',
          productId: 'prod_parent',
          stock: 10,
        }),
        update: async (args: unknown) => {
          variantUpdatedWith = args;
        },
        delete: async () => {
          throw new Error('Should not delete variant with order items');
        },
        findMany: async () => [{ id: 'var_has_orders', stock: 0 }, { id: 'var_other', stock: 15 }],
      },
      orderItem: {
        count: async () => 2, // Has order items
      },
      product: {
        update: async (args: unknown) => args,
      },
    } as unknown as TransactionClient;

    const result = await deleteProductOrVariant(fakeTx, { variantId: 'var_has_orders' });
    assert.equal(result.type, 'VARIANT');
    assert.deepEqual(variantUpdatedWith, {
      where: { id: 'var_has_orders' },
      data: { isActive: false, stock: 0 },
    });
  });

  it('should deactivate base product and all its variants when productId is provided', async () => {
    let variantsUpdateArgs: unknown = null;
    let productUpdateArgs: unknown = null;

    const fakeTx = {
      product: {
        findUnique: async () => ({ id: 'prod_to_deactivate' }),
        update: async (args: unknown) => {
          productUpdateArgs = args;
          return { id: 'prod_to_deactivate', isActive: false };
        },
      },
      productVariant: {
        updateMany: async (args: unknown) => {
          variantsUpdateArgs = args;
          return { count: 3 };
        },
      },
    } as unknown as TransactionClient;

    const result = await deleteProductOrVariant(fakeTx, { productId: 'prod_to_deactivate' });
    assert.equal(result.type, 'PRODUCT');
    assert.deepEqual(variantsUpdateArgs, {
      where: { productId: 'prod_to_deactivate' },
      data: { isActive: false },
    });
    assert.deepEqual(productUpdateArgs, {
      where: { id: 'prod_to_deactivate' },
      data: { isActive: false },
      include: {
        variants: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  });
});
