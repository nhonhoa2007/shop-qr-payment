import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ReviewManager } from './review-manager';

export const dynamic = 'force-dynamic';

export default async function AdminReviewsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const reviews = await prisma.review.findMany({
    include: {
      product: {
        select: {
          id: true,
          name: true,
          image: true,
          price: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <ReviewManager initialReviews={JSON.parse(JSON.stringify(reviews))} />
    </div>
  );
}
