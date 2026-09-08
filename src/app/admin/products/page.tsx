import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { AdminProductManager } from './product-manager';
import type { Product } from '@/types';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const products: Product[] = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <AdminProductManager initialProducts={products} />
    </div>
  );
}
