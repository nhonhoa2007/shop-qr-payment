import { notFound } from 'next/navigation';
import { CatalogService } from '@/server/modules/catalog/catalog.service';
import { ProductDetailView } from '@/client/views/ProductDetailView';
import type { Metadata } from 'next';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await CatalogService.getProductDetail(id);

  if (!product) {
    return { title: 'Sản phẩm không tìm thấy - Shop QR Payment' };
  }

  return {
    title: `${product.name} | Shop QR Payment`,
    description: product.description || undefined,
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await CatalogService.getProductDetail(id);

  if (!product) {
    notFound();
  }

  return <ProductDetailView product={product} />;
}
