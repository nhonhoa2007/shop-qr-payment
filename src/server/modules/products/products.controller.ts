import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@server/database/prisma';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  buildProductCacheKey,
  getCachedProductList,
  setCachedProductList,
  invalidateProductCache,
} from '@server/infrastructure/redis';

interface ProductBody {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  price?: unknown;
  image?: unknown;
  category?: unknown;
  stock?: unknown;
  isActive?: unknown;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNonNegativeInt(value: unknown): number | null {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return null;
  return Math.round(numberValue);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const all = searchParams.get('all') === 'true';

    // Query Cache: Chỉ cache danh mục sản phẩm công khai cho khách mua
    const cacheKey = !all ? buildProductCacheKey(category, search) : null;
    if (cacheKey) {
      const cached = await getCachedProductList(cacheKey);
      if (cached) {
        return NextResponse.json({ products: cached }, { headers: { 'X-Cache': 'HIT' } });
      }
    }

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
      orderBy: { createdAt: 'desc' },
    });

    if (cacheKey) {
      await setCachedProductList(cacheKey, products, 60);
    }

    return NextResponse.json({ products }, { headers: { 'X-Cache': 'MISS' } });
  } catch (error) {
    console.error('Get products error:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const body = (await req.json()) as ProductBody;
    const name = normalizeText(body.name);
    const price = normalizeNonNegativeInt(body.price);
    const stock = body.stock === undefined ? 0 : normalizeNonNegativeInt(body.stock);

    if (!name || price === null || stock === null) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        name,
        description: normalizeText(body.description),
        price,
        image: normalizeText(body.image),
        category: normalizeText(body.category),
        stock,
        isActive: body.isActive !== false,
      },
    });

    // Invalidate product cache
    await invalidateProductCache();

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json({ error: 'Lỗi tạo sản phẩm' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
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

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(body.description !== undefined && { description: normalizeText(body.description) }),
        ...(price !== undefined && { price }),
        ...(body.image !== undefined && { image: normalizeText(body.image) }),
        ...(body.category !== undefined && { category: normalizeText(body.category) }),
        ...(stock !== undefined && { stock }),
        ...(typeof body.isActive === 'boolean' && { isActive: body.isActive }),
      },
    });

    // Invalidate product cache
    await invalidateProductCache();

    return NextResponse.json({ product });
  } catch (error) {
    console.error('Update product error:', error);
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
    if (!id) {
      return NextResponse.json({ error: 'Thiếu ID sản phẩm' }, { status: 400 });
    }

    const product = await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    // Invalidate product cache
    await invalidateProductCache();

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json({ error: 'Lỗi xóa sản phẩm' }, { status: 500 });
  }
}
