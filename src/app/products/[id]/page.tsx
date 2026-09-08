import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ProductDetailView } from '@/components/product/ProductDetailView';
import type { Metadata } from 'next';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
  });

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
  const product = await prisma.product.findUnique({
    where: { id },
  });

  if (!product || !product.isActive) {
    notFound();
  }

  return <ProductDetailView product={product} />;
}
