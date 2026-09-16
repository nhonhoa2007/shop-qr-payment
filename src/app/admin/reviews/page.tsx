import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { AdminService } from '@/server/modules/admin/admin.service';
import { ReviewManager as AdminReviewsView } from '@/client/views/admin/AdminReviewsView';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Kiểm duyệt đánh giá | Quản trị viên Shop QR',
};

export default async function AdminReviewsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const reviews = await AdminService.getAdminReviews();

  return <AdminReviewsView initialReviews={reviews} />;
}
