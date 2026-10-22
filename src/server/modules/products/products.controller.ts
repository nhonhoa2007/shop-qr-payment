import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { ProductKind, ProductSegment } from '@prisma/client';
import { prisma } from '@server/database/prisma';
import { authOptions } from '@server/modules/auth/auth-options';
import {
  buildProductCacheKey,
  getCachedProductList,
  setCachedProductList,
  invalidateProductCache,
} from '@server/infrastructure/redis';
import {
  normalizeText,
  normalizeNonNegativeInt,
  validateVariantsArray,
  createProductWithVariants,
  updateProductWithVariants,
  deleteProductOrVariant,
  upsertElectronicsProduct,
  type UpsertElectronicsProductInput,
} from './product.service.ts';
import { resolveOperatorAccess, type GuardUser } from '@server/modules/admin/guards';
import {
  serializeProductDto,
  serializeProductMutationResult,
} from '@server/modules/money/money-serialization';

interface ProductBody {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  price?: unknown;
  image?: unknown;
  category?: unknown;
  stock?: unknown;
  isActive?: unknown;
  variants?: unknown;
  brandId?: unknown;
  categoryId?: unknown;
  kind?: unknown;
  segment?: unknown;
  specs?: unknown;
  images?: unknown;
  warrantyConfig?: unknown;
  weight?: unknown;
  length?: unknown;
  width?: unknown;
  height?: unknown;
  sources?: unknown;
  expectedVersion?: unknown;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const all = searchParams.get('all') === 'true';
    // Phân trang + sắp xếp (mặc định: trang 1, không giới hạn — giữ tương thích ngược)
    const page = Math.max(normalizeNonNegativeInt(searchParams.get('page')) ?? 1, 1);
    const rawLimit = normalizeNonNegativeInt(searchParams.get('limit'));
    const limit = rawLimit === null ? null : Math.min(rawLimit, 48);
    const sortParam = searchParams.get('sort');
    const sort =
      sortParam === 'price-asc' || sortParam === 'price-desc' ? sortParam : 'newest';

    // Hỗ trợ lấy chi tiết một sản phẩm theo ID kèm toàn bộ biến thể
    if (id) {
      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          variants: {
            where: all ? {} : { isActive: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!product) {
        return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404 });
      }

      return NextResponse.json({ product: serializeProductDto(product) });
    }

    // Query Cache: Chỉ cache danh mục sản phẩm công khai cho khách mua
    const cacheKey = !all
      ? buildProductCacheKey(category, search, { page, limit: limit ?? 0, sort })
      : null;
    if (cacheKey) {
      const cached = await getCachedProductList(cacheKey);
      if (cached) {
        return NextResponse.json({ products: cached }, { headers: { 'X-Cache': 'HIT' } });
      }
    }

    const orderBy: Record<string, 'asc' | 'desc'> =
      sort === 'price-asc'
        ? { price: 'asc' }
        : sort === 'price-desc'
          ? { price: 'desc' }
          : { createdAt: 'desc' };

    const products = await prisma.product.findMany({
      where: {
        ...(all ? {} : { isActive: true }),
        ...(category && { category }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }),
      },
      include: {
        variants: {
          where: all ? {} : { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy,
      ...(limit !== null && { skip: (page - 1) * limit, take: limit }),
    });

    if (cacheKey) {
      await setCachedProductList(cacheKey, products, 60);
    }

    const serializedProducts = products.map(serializeProductDto);
    return NextResponse.json({ products: serializedProducts }, { headers: { 'X-Cache': 'MISS' } });
  } catch (error) {
    console.error('Get products error:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !resolveOperatorAccess(session.user, 'products')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const body = (await req.json()) as ProductBody;
    const name = normalizeText(body.name);
    const price = normalizeNonNegativeInt(body.price);
    const stock = body.stock === undefined ? 0 : normalizeNonNegativeInt(body.stock);

    if (!name || price === null || stock === null) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    // Nếu có categoryId hoặc specs -> Xử lý theo quy trình ghi sản phẩm điện tử nguyên tử (M1)
    if (body.specs !== undefined || body.categoryId !== undefined) {
      if (!body.categoryId) {
        return NextResponse.json({ error: 'Sản phẩm điện tử yêu cầu categoryId hợp lệ' }, { status: 400 });
      }

      const product = await upsertElectronicsProduct(
        {
          product: {
            id: normalizeText(body.id) || undefined,
            name: name!,
            description: normalizeText(body.description),
            price,
            image: normalizeText(body.image),
            brandId: normalizeText(body.brandId),
            categoryId: String(body.categoryId),
            kind: body.kind ? (body.kind as ProductKind) : undefined,
            segment: body.segment ? (body.segment as ProductSegment) : undefined,
            weight: Number(body.weight) || 0,
            length: Number(body.length) || 0,
            width: Number(body.width) || 0,
            height: Number(body.height) || 0,
            isActive: body.isActive !== false,
          },
          specs: body.specs,
          images: body.images || (body.image ? [{ url: body.image, alt: name!, sortOrder: 0 }] : []),
          warrantyConfig: body.warrantyConfig,
          variants: Array.isArray(body.variants)
            ? (body.variants as UpsertElectronicsProductInput['variants'])
            : [],
          sources: Array.isArray(body.sources)
            ? (body.sources as NonNullable<UpsertElectronicsProductInput['sources']>)
            : [],
          expectedVersion: typeof body.expectedVersion === 'number' ? body.expectedVersion : undefined,
        },
        session.user as GuardUser
      );

      await invalidateProductCache();
      return NextResponse.json({ product }, { status: 201 });
    }

    let parsedVariants: ReturnType<typeof validateVariantsArray>['variants'];
    if (body.variants !== undefined) {
      const vValidation = validateVariantsArray(body.variants);
      if (!vValidation.valid) {
        return NextResponse.json({ error: vValidation.error || 'Dữ liệu biến thể không hợp lệ' }, { status: 400 });
      }
      parsedVariants = vValidation.variants;
    }

    // Thực thi trong Prisma Transaction lồng nhau để đảm bảo toàn vẹn dữ liệu
    const product = await prisma.$transaction(async (tx) => {
      return await createProductWithVariants(tx, {
        name,
        description: normalizeText(body.description),
        price,
        image: normalizeText(body.image),
        category: normalizeText(body.category),
        stock,
        isActive: body.isActive !== false,
        variants: parsedVariants,
      });
    });

    // Invalidate product cache
    await invalidateProductCache();

    return NextResponse.json({ product: serializeProductDto(product) }, { status: 201 });
  } catch (error: unknown) {
    console.error('Create product error:', error);
    if (error instanceof Error) {
      if (error.message.includes('version conflict')) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (error.message.startsWith('Unauthorized:')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('not ready for publication')) {
        return NextResponse.json({ error: error.message }, { status: 422 });
      }
      if (
        error.message.includes('Category not found') ||
        error.message.includes('violates') ||
        error.message.includes('Duplicate') ||
        error.message.includes('Invalid') ||
        error.message.includes('required') ||
        error.message.includes('missing')
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    const errObj = error as { code?: string; message?: string };
    if (errObj.code === 'P2002') {
      return NextResponse.json(
        { error: 'Mã SKU đã tồn tại trên hệ thống. Vui lòng nhập SKU khác.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Lỗi tạo sản phẩm' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !resolveOperatorAccess(session.user, 'products')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const body = (await req.json()) as ProductBody;
    const id = normalizeText(body.id);
    if (!id) {
      return NextResponse.json({ error: 'Thiếu ID sản phẩm' }, { status: 400 });
    }

    const price = body.price === undefined ? undefined : normalizeNonNegativeInt(body.price);
    const stock = body.stock === undefined ? undefined : normalizeNonNegativeInt(body.stock);
    if (price === null || stock === null) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    const name = body.name === undefined ? undefined : normalizeText(body.name);
    if (body.name !== undefined && !name) {
      return NextResponse.json({ error: 'Tên sản phẩm không hợp lệ' }, { status: 400 });
    }

    // Nếu có categoryId hoặc specs -> Xử lý theo quy trình ghi sản phẩm điện tử nguyên tử (M1)
    if (body.specs !== undefined || body.categoryId !== undefined) {
      if (!body.categoryId) {
        return NextResponse.json({ error: 'Sản phẩm điện tử yêu cầu categoryId hợp lệ' }, { status: 400 });
      }

      const product = await upsertElectronicsProduct(
        {
          product: {
            id,
            name: name || '',
            description: body.description !== undefined ? normalizeText(body.description) : undefined,
            price: price ?? 0,
            image: body.image !== undefined ? normalizeText(body.image) : undefined,
            brandId: normalizeText(body.brandId),
            categoryId: String(body.categoryId),
            kind: body.kind ? (body.kind as ProductKind) : undefined,
            segment: body.segment ? (body.segment as ProductSegment) : undefined,
            weight: Number(body.weight) || 0,
            length: Number(body.length) || 0,
            width: Number(body.width) || 0,
            height: Number(body.height) || 0,
            isActive: body.isActive !== false,
          },
          specs: body.specs,
          images: body.images,
          warrantyConfig: body.warrantyConfig,
          variants: Array.isArray(body.variants)
            ? (body.variants as UpsertElectronicsProductInput['variants'])
            : [],
          sources: Array.isArray(body.sources)
            ? (body.sources as NonNullable<UpsertElectronicsProductInput['sources']>)
            : [],
          expectedVersion: typeof body.expectedVersion === 'number' ? body.expectedVersion : undefined,
        },
        session.user as GuardUser
      );

      await invalidateProductCache();
      return NextResponse.json({ product });
    }

    let parsedVariants: ReturnType<typeof validateVariantsArray>['variants'];
    if (body.variants !== undefined) {
      const vValidation = validateVariantsArray(body.variants);
      if (!vValidation.valid) {
        return NextResponse.json({ error: vValidation.error || 'Dữ liệu biến thể không hợp lệ' }, { status: 400 });
      }
      parsedVariants = vValidation.variants;
    }

    // Thực thi cập nhật lồng nhau trong Prisma Transaction
    const product = await prisma.$transaction(async (tx) => {
      return await updateProductWithVariants(tx, {
        id,
        name: name ?? undefined,
        description: body.description !== undefined ? normalizeText(body.description) : undefined,
        price,
        image: body.image !== undefined ? normalizeText(body.image) : undefined,
        category: body.category !== undefined ? normalizeText(body.category) : undefined,
        stock,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
        variants: parsedVariants,
      });
    });

    // Invalidate product cache
    await invalidateProductCache();

    return NextResponse.json({ product: serializeProductDto(product) });
  } catch (error: unknown) {
    console.error('Update product error:', error);
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404 });
      }
      if (error.message.includes('version conflict')) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (error.message.startsWith('Unauthorized:')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('not ready for publication')) {
        return NextResponse.json({ error: error.message }, { status: 422 });
      }
      if (
        error.message.includes('Category not found') ||
        error.message.includes('violates') ||
        error.message.includes('Duplicate') ||
        error.message.includes('Invalid') ||
        error.message.includes('required') ||
        error.message.includes('missing')
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    const errObj = error as { code?: string; message?: string };
    if (errObj.code === 'P2002') {
      return NextResponse.json(
        { error: 'Mã SKU đã tồn tại trên hệ thống. Vui lòng nhập SKU khác.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Lỗi cập nhật sản phẩm' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const variantId = searchParams.get('variantId');

    if (!id && !variantId) {
      return NextResponse.json({ error: 'Thiếu ID sản phẩm hoặc ID biến thể' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      return await deleteProductOrVariant(tx, {
        productId: id || undefined,
        variantId: variantId || undefined,
      });
    });

    // Invalidate product cache
    await invalidateProductCache();

    return NextResponse.json({
      success: true,
      ...serializeProductMutationResult(result),
    });
  } catch (error: unknown) {
    console.error('Delete product/variant error:', error);
    if (error instanceof Error) {
      if (error.message === 'VARIANT_NOT_FOUND') {
        return NextResponse.json({ error: 'Không tìm thấy biến thể' }, { status: 404 });
      }
      if (error.message === 'PRODUCT_NOT_FOUND') {
        return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404 });
      }
    }
    return NextResponse.json({ error: 'Lỗi xóa sản phẩm hoặc biến thể' }, { status: 500 });
  }
}
