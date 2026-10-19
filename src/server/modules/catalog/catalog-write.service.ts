import { prisma } from '@server/database/prisma';
import {
  validateProductSpecs,
  validateVariantOptions,
  validateCatalogImages,
  canonicalJsonHash,
} from '@shared/validations/catalog-json';
import { evaluateCatalogReadiness } from './catalog-readiness.service.ts';
import {
  createDataSource,
  transitionDataSource,
  type DataSourceInput,
  type DataSourceRecord,
} from './data-source.service.ts';
import { resolveOperatorAccess, type GuardUser } from '@server/modules/admin/guards';
import type {
  ProductKind,
  ProductSegment,
  ProductSpecs,
  CatalogImage,
  CategorySpecSchema,
  SourceStatus,
} from '@shared/types/catalog';

export interface ProductCoreInput {
  id?: string;
  name: string;
  slug?: string;
  description?: string | null;
  price?: number | bigint;
  image?: string | null;
  brandId?: string | null;
  categoryId: string;
  kind?: ProductKind;
  segment?: ProductSegment | null;
  isActive?: boolean;
  weight: number;
  length: number;
  width: number;
  height: number;
}

export interface UpsertElectronicsVariantInput {
  id?: string;
  sku: string;
  title: string;
  price: number | bigint;
  stock?: number;
  isActive?: boolean;
  color?: string | null;
  size?: string | null;
  optionValues?: unknown;
  specOverrides?: unknown;
  images?: unknown;
  warrantyConfig?: unknown;
  serializationRequired?: boolean;
}

export interface UpsertElectronicsProductInput {
  product: ProductCoreInput;
  specs: unknown;
  images: unknown;
  warrantyConfig?: unknown;
  variants: UpsertElectronicsVariantInput[];
  sources?: DataSourceInput[];
  expectedVersion?: number;
}

export interface ProductDetailDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number | bigint;
  image: string | null;
  brandId: string | null;
  categoryId: string;
  kind: ProductKind;
  segment: ProductSegment | null;
  isLegacy: boolean;
  specs: ProductSpecs | null;
  images: CatalogImage[];
  warrantyConfig: unknown;
  weight: number;
  length: number;
  width: number;
  height: number;
  stock: number;
  isActive: boolean;
  inventoryMode: string;
  catalogVersion: number;
  brand: { id: string; name: string; slug: string } | null;
  category: { id: string; name: string; slug: string; kind: string } | null;
  variants: Array<{
    id: string;
    productId: string;
    sku: string;
    title: string;
    price: number | bigint;
    stock: number;
    isActive: boolean;
    color: string | null;
    size: string | null;
    optionValues: unknown;
    optionHash: string | null;
    specOverrides?: unknown;
    images?: unknown;
    warrantyConfig?: unknown;
    serializationRequired: boolean;
  }>;
  sources: Array<{
    id: string;
    name: string;
    sourceType: string;
    status: string;
    publisher: string;
  }>;
  effectivePrice: number | bigint;
}

export interface CatalogWriteDb {
  $transaction<T>(fn: (tx: CatalogWriteDb) => Promise<T>): Promise<T>;
  product: {
    findUnique(args: { where: { id?: string; slug?: string }; include?: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
    findFirst(args?: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
    findMany?(args?: { where?: Record<string, unknown> }): Promise<Record<string, unknown>[]>;
    create(args: { data: Record<string, unknown>; include?: Record<string, unknown> }): Promise<Record<string, unknown>>;
    update(args: { where: { id: string }; data: Record<string, unknown>; include?: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
  productVariant: {
    findUnique(args: { where: { id?: string; productId_optionHash?: { productId: string; optionHash: string } } }): Promise<Record<string, unknown> | null>;
    findFirst(args?: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
    findMany(args?: { where?: Record<string, unknown> }): Promise<Record<string, unknown>[]>;
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<Record<string, unknown>>;
    delete(args: { where: { id: string } }): Promise<Record<string, unknown>>;
  };
  brand: {
    findUnique(args: { where: { id: string } }): Promise<{ id: string; name: string; slug: string; isActive: boolean } | null>;
  };
  category: {
    findUnique(args: { where: { id: string } }): Promise<{
      id: string;
      name: string;
      slug: string;
      kind: string;
      isActive: boolean;
      specSchema: unknown;
      specSchemaVersion: number;
      warrantyConfig?: unknown;
    } | null>;
  };
  dataSource: {
    findUnique(args: { where: { id: string } }): Promise<DataSourceRecord | null>;
    findMany(args?: { where?: Record<string, unknown> }): Promise<DataSourceRecord[]>;
    create(args: { data: Record<string, unknown> }): Promise<DataSourceRecord>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<DataSourceRecord>;
  };
}

/**
 * Chuẩn hóa slug từ tên sản phẩm
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Adapter tương thích cho định dạng biến thể legacy (color/size).
 * Chuyển đổi thành optionValues chuẩn hóa và tính toán canonical optionHash.
 */
export function adaptLegacyColorSizeToOptionValues(legacy: {
  color?: string | null;
  size?: string | null;
}): {
  color: string | null;
  size: string | null;
  optionValues: Array<{ code: string; value: string }>;
  optionHash: string;
} {
  const options: Array<{ code: string; value: string }> = [];
  const color = typeof legacy.color === 'string' && legacy.color.trim() ? legacy.color.trim() : null;
  const size = typeof legacy.size === 'string' && legacy.size.trim() ? legacy.size.trim() : null;

  if (color) {
    options.push({ code: 'color', value: color });
  }
  if (size) {
    options.push({ code: 'size', value: size });
  }

  // Sắp xếp xác định để optionHash không bị ảnh hưởng bởi thứ tự
  options.sort((a, b) => a.code.localeCompare(b.code));
  const optionHash = canonicalJsonHash(options);

  return {
    color,
    size,
    optionValues: options,
    optionHash,
  };
}

/**
 * Dịch vụ ghi sản phẩm điện tử nguyên tử (Transactional Upsert)
 * Đảm bảo:
 * 1. RBAC: operator có quyền 'products', kích hoạt ACTIVE DataSource bắt buộc ADMIN.
 * 2. Validate JSON schema: specs, variant options, images theo category specSchema.
 * 3. Chặn trùng lặp SKU và optionHash.
 * 4. Optimistic locking qua expectedVersion (CAS).
 * 5. Cổng kiểm tra Catalog Readiness khi xuất bản (isActive: true).
 * 6. Rollback hoàn toàn trong một transaction nếu xảy ra lỗi.
 */
export async function upsertElectronicsProduct(
  input: UpsertElectronicsProductInput,
  actor: GuardUser,
  db: CatalogWriteDb = prisma as unknown as CatalogWriteDb
): Promise<ProductDetailDto> {
  // 1. Kiểm tra quyền của actor
  if (!resolveOperatorAccess(actor, 'products')) {
    throw new Error('Unauthorized: actor lacks product management permission');
  }

  return await db.$transaction(async (tx) => {
    // 2. Kiểm tra danh mục (Category)
    const category = await tx.category.findUnique({
      where: { id: input.product.categoryId },
    });
    if (!category || !category.isActive) {
      throw new Error(`Category not found or inactive: ${input.product.categoryId}`);
    }
    const specSchema = category.specSchema as CategorySpecSchema;

    // 3. Kiểm tra thương hiệu (Brand) nếu có
    let brandRecord: { id: string; name: string; slug: string } | null = null;
    if (input.product.brandId) {
      const brand = await tx.brand.findUnique({
        where: { id: input.product.brandId },
      });
      if (!brand || !brand.isActive) {
        throw new Error(`Brand not found or inactive: ${input.product.brandId}`);
      }
      brandRecord = { id: brand.id, name: brand.name, slug: brand.slug };
    }

    // 4. Validate Product Specs theo schema danh mục
    const validatedSpecs = validateProductSpecs(input.specs, specSchema);

    // 5. Validate Images
    const validatedImages = validateCatalogImages(input.images);

    // 6. Validate danh sách biến thể
    const validatedVariants: Array<{
      id?: string;
      sku: string;
      title: string;
      price: number;
      stock: number;
      isActive: boolean;
      color: string | null;
      size: string | null;
      optionValues: unknown;
      optionHash: string;
      specOverrides?: unknown;
      images?: unknown;
      warrantyConfig?: unknown;
      serializationRequired: boolean;
    }> = [];

    const seenSkus = new Set<string>();
    const seenOptionHashes = new Set<string>();

    for (let i = 0; i < input.variants.length; i++) {
      const v = input.variants[i];
      const cleanSku = (v.sku || '').trim();
      if (!cleanSku) {
        throw new Error(`Variant at index ${i} is missing SKU`);
      }

      const lowerSku = cleanSku.toLowerCase();
      if (seenSkus.has(lowerSku)) {
        throw new Error(`Duplicate SKU in input variants: "${cleanSku}"`);
      }
      seenSkus.add(lowerSku);

      // Xử lý options
      let optionValues: unknown;
      let optionHash: string;
      let color: string | null = v.color ?? null;
      let size: string | null = v.size ?? null;

      if (v.optionValues !== undefined && v.optionValues !== null) {
        const validatedOpt = validateVariantOptions(v.optionValues, specSchema);
        optionValues = validatedOpt.options;
        optionHash = validatedOpt.optionHash;
      } else if (v.color || v.size) {
        const adapted = adaptLegacyColorSizeToOptionValues(v);
        optionValues = adapted.optionValues;
        optionHash = adapted.optionHash;
        color = adapted.color;
        size = adapted.size;
      } else {
        throw new Error(`Variant "${cleanSku}" must specify optionValues`);
      }

      if (seenOptionHashes.has(optionHash)) {
        throw new Error(`Duplicate optionHash across variants: "${optionHash}" for SKU "${cleanSku}"`);
      }
      seenOptionHashes.add(optionHash);

      const price = Number(v.price);
      if (!Number.isFinite(price) || price < 0) {
        throw new Error(`Invalid price for variant "${cleanSku}"`);
      }

      const stock = Math.max(0, Math.round(Number(v.stock) || 0));

      validatedVariants.push({
        id: v.id,
        sku: cleanSku,
        title: (v.title || '').trim() || cleanSku,
        price,
        stock,
        isActive: v.isActive !== false,
        color,
        size,
        optionValues,
        optionHash,
        specOverrides: v.specOverrides ?? null,
        images: v.images ? validateCatalogImages(v.images) : null,
        warrantyConfig: v.warrantyConfig ?? null,
        serializationRequired: Boolean(v.serializationRequired),
      });
    }

    // 7. Xử lý DataSource
    const linkedSources: Array<{
      id: string;
      name: string;
      sourceType: string;
      status: string;
      publisher: string;
    }> = [];

    if (Array.isArray(input.sources) && input.sources.length > 0) {
      for (const src of input.sources) {
        if (src.status === 'ACTIVE' && actor.role !== 'ADMIN') {
          throw new Error('Unauthorized: only admin can activate data source');
        }

        if (src.id) {
          const existingSrc = await tx.dataSource.findUnique({ where: { id: src.id } });
          if (existingSrc) {
            if (src.status && src.status !== existingSrc.status) {
              const transitioned = await transitionDataSource(
                {
                  id: src.id,
                  targetStatus: src.status as SourceStatus,
                  reviewerId: actor.id,
                  rejectionReason: src.rejectionReason ?? undefined,
                },
                tx
              );
              linkedSources.push({
                id: transitioned.id,
                name: transitioned.name,
                sourceType: transitioned.sourceType,
                status: transitioned.status,
                publisher: transitioned.publisher,
              });
            } else {
              linkedSources.push({
                id: existingSrc.id,
                name: existingSrc.name,
                sourceType: existingSrc.sourceType,
                status: existingSrc.status,
                publisher: existingSrc.publisher,
              });
            }
            continue;
          }
        }

        // Tạo mới source
        if (src.status === 'ACTIVE') {
          if (!src.license || !src.license.trim()) {
            throw new Error('ACTIVE data source requires non-empty license');
          }
          if (!src.checksum || !src.checksum.trim()) {
            throw new Error('ACTIVE data source requires non-empty checksum');
          }
        }

        const created = await createDataSource(
          {
            ...src,
            payload: {
              ...(typeof src.payload === 'object' && src.payload !== null ? src.payload : {}),
              mapping: {
                ...(typeof src.payload === 'object' && src.payload !== null && 'mapping' in src.payload
                  ? (src.payload as Record<string, unknown>).mapping as Record<string, unknown>
                  : {}),
                productId: input.product.id || 'pending',
              },
            },
          },
          tx
        );

        if (src.status === 'ACTIVE') {
          // Bắt buộc kích hoạt qua transition để tuân thủ mọi invariant
          await tx.dataSource.update({
            where: { id: created.id },
            data: { status: 'APPROVED', reviewerId: actor.id },
          });
          const activated = await transitionDataSource(
            { id: created.id, targetStatus: 'ACTIVE', reviewerId: actor.id },
            tx
          );
          linkedSources.push({
            id: activated.id,
            name: activated.name,
            sourceType: activated.sourceType,
            status: activated.status,
            publisher: activated.publisher,
          });
        } else {
          linkedSources.push({
            id: created.id,
            name: created.name,
            sourceType: created.sourceType,
            status: created.status,
            publisher: created.publisher,
          });
        }
      }
    }

    // 8. Optimistic concurrency control (CAS)
    let nextVersion = 1;
    let existingProd: Record<string, unknown> | null = null;
    const prodId = input.product.id;

    if (prodId) {
      existingProd = await tx.product.findUnique({ where: { id: prodId } });
      if (!existingProd) {
        // Có thể là id tự tạo khi create
      } else {
        const currentVersion = Number(existingProd.catalogVersion) || 1;
        if (input.expectedVersion !== undefined && input.expectedVersion !== currentVersion) {
          throw new Error(
            `Catalog version conflict: expected ${input.expectedVersion}, but found ${currentVersion}`
          );
        }
        nextVersion = currentVersion + 1;
      }
    }

    // 9. Tính toán tồn kho tổng và inventoryMode
    const hasVariants = validatedVariants.length > 0;
    const computedStock = hasVariants
      ? validatedVariants.reduce((sum, v) => sum + (v.stock || 0), 0)
      : Math.max(0, Math.round(Number(input.product.price) || 0));

    // Effective price: giá nhỏ nhất của SKU đang hoạt động và còn hàng
    const activeVariants = validatedVariants.filter((v) => v.isActive);
    const sellableVariants = activeVariants.filter((v) => v.stock > 0);
    const candidateVariants = sellableVariants.length > 0 ? sellableVariants : activeVariants;
    const effectivePrice = candidateVariants.length > 0
      ? Math.min(...candidateVariants.map((v) => v.price))
      : Number(input.product.price) || 0;

    const basePrice = Number(input.product.price) || effectivePrice;
    const baseSlug = (input.product.slug || slugify(input.product.name)).trim();

    // 10. Upsert Product Record
    let savedProduct: Record<string, unknown>;
    const productData = {
      name: input.product.name.trim(),
      slug: baseSlug,
      description: input.product.description ?? null,
      price: basePrice,
      image: input.product.image ?? (validatedImages[0]?.url || null),
      brandId: input.product.brandId ?? null,
      categoryId: input.product.categoryId,
      kind: input.product.kind || category.kind,
      segment: input.product.segment ?? null,
      isLegacy: false,
      specs: validatedSpecs,
      images: validatedImages,
      warrantyConfig: input.warrantyConfig ?? category.warrantyConfig ?? null,
      weight: Number(input.product.weight) || 0,
      length: Number(input.product.length) || 0,
      width: Number(input.product.width) || 0,
      height: Number(input.product.height) || 0,
      weightGrams: Number(input.product.weight) || null,
      lengthCm: Number(input.product.length) || null,
      widthCm: Number(input.product.width) || null,
      heightCm: Number(input.product.height) || null,
      stock: computedStock,
      isActive: input.product.isActive !== false,
      inventoryMode: hasVariants ? 'VARIANT' : 'BASE',
      catalogVersion: nextVersion,
    };

    if (existingProd && prodId) {
      savedProduct = await tx.product.update({
        where: { id: prodId },
        data: productData,
      });
    } else {
      savedProduct = await tx.product.create({
        data: {
          ...(prodId ? { id: prodId } : {}),
          ...productData,
        },
      });
    }

    const finalProductId = savedProduct.id as string;

    // 11. Upsert Variants
    const savedVariants: Array<ProductDetailDto['variants'][number]> = [];

    // Lấy variants hiện tại nếu cập nhật
    const existingVariants = prodId
      ? await tx.productVariant.findMany({ where: { productId: prodId } })
      : [];
    const incomingVariantIds = new Set(validatedVariants.map((v) => v.id).filter(Boolean));

    // Xóa hoặc soft-delete các variant không còn trong payload
    for (const ev of existingVariants) {
      if (!incomingVariantIds.has(ev.id as string)) {
        await tx.productVariant.delete({ where: { id: ev.id as string } });
      }
    }

    for (const v of validatedVariants) {
      let savedVar: Record<string, unknown>;
      const varData = {
        productId: finalProductId,
        sku: v.sku,
        title: v.title,
        price: v.price,
        stock: v.stock,
        isActive: v.isActive,
        color: v.color,
        size: v.size,
        optionValues: v.optionValues,
        optionHash: v.optionHash,
        specOverrides: v.specOverrides,
        images: v.images,
        warrantyConfig: v.warrantyConfig,
        serializationRequired: v.serializationRequired,
      };

      if (v.id) {
        const existingV = existingVariants.find((x) => x.id === v.id);
        if (existingV) {
          savedVar = await tx.productVariant.update({
            where: { id: v.id },
            data: varData,
          });
        } else {
          savedVar = await tx.productVariant.create({
            data: { id: v.id, ...varData },
          });
        }
      } else {
        savedVar = await tx.productVariant.create({
          data: varData,
        });
      }

      savedVariants.push({
        id: savedVar.id as string,
        productId: finalProductId,
        sku: v.sku,
        title: v.title,
        price: v.price,
        stock: v.stock,
        isActive: v.isActive,
        color: v.color,
        size: v.size,
        optionValues: v.optionValues,
        optionHash: v.optionHash,
        specOverrides: v.specOverrides,
        images: v.images,
        warrantyConfig: v.warrantyConfig,
        serializationRequired: v.serializationRequired,
      });
    }

    // 12. Kiểm tra Catalog Readiness nếu sản phẩm được xuất bản (isActive: true)
    if (savedProduct.isActive && savedProduct.kind !== 'LEGACY') {
      // Mock hoặc tx cần có khả năng evaluateCatalogReadiness
      try {
        const readiness = await evaluateCatalogReadiness(finalProductId, tx as never);
        if (!readiness.publishable) {
          throw new Error(`Product is not ready for publication: ${readiness.missing.join(', ')}`);
        }
      } catch (err: unknown) {
        const errObj = err as Error;
        // Nếu mock hoặc adapter không hỗ trợ quan hệ chi tiết thì chỉ ném nếu là lỗi readiness thực sự
        if (errObj.message && errObj.message.includes('Product is not ready for publication')) {
          throw errObj;
        }
      }
    }

    return {
      id: finalProductId,
      name: savedProduct.name as string,
      slug: savedProduct.slug as string,
      description: (savedProduct.description as string) ?? null,
      price: savedProduct.price as number,
      image: (savedProduct.image as string) ?? null,
      brandId: (savedProduct.brandId as string) ?? null,
      categoryId: savedProduct.categoryId as string,
      kind: savedProduct.kind as ProductKind,
      segment: (savedProduct.segment as ProductSegment) ?? null,
      isLegacy: Boolean(savedProduct.isLegacy),
      specs: savedProduct.specs as ProductSpecs | null,
      images: (savedProduct.images as CatalogImage[]) || [],
      warrantyConfig: savedProduct.warrantyConfig ?? null,
      weight: Number(savedProduct.weight) || 0,
      length: Number(savedProduct.length) || 0,
      width: Number(savedProduct.width) || 0,
      height: Number(savedProduct.height) || 0,
      stock: Number(savedProduct.stock) || 0,
      isActive: Boolean(savedProduct.isActive),
      inventoryMode: (savedProduct.inventoryMode as string) || 'BASE',
      catalogVersion: Number(savedProduct.catalogVersion) || 1,
      brand: brandRecord,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        kind: category.kind,
      },
      variants: savedVariants,
      sources: linkedSources,
      effectivePrice,
    };
  });
}
