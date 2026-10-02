import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { WishlistView } from '@client/views/WishlistView';

export const metadata = {
  title: 'Danh sách sản phẩm yêu thích | Shop QR Payment',
};

export default async function WishlistPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login?callbackUrl=/wishlist');
  }

  return <WishlistView />;
}
