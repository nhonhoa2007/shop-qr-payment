import { CardListSkeleton } from '@client/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="h-8 w-40 bg-[#ececec] rounded-xl animate-pulse mb-6" aria-hidden="true" />
      <CardListSkeleton count={5} />
    </div>
  );
}
