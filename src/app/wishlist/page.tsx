import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { WishlistView } from './wishlist-view';
import { Heart } from 'lucide-react';

export const metadata = {
  title: 'Danh sách sản phẩm yêu thích | Shop QR Payment',
};

export default async function WishlistPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login?callbackUrl=/wishlist');
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center">
          <Heart className="w-5 h-5 fill-red-500" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Sản phẩm yêu thích
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Danh sách các sản phẩm bạn đã lưu để theo dõi và mua sắm sau
          </p>
        </div>
      </div>

      <WishlistView />
    </div>
  );
}
