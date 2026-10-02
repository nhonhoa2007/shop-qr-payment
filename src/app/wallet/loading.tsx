import { CardListSkeleton, Skeleton } from '@client/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8" aria-busy="true">
      <Skeleton className="h-8 w-48 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-[28px] p-6 shadow-card space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-12 w-full rounded-full" />
          </div>
          <CardListSkeleton count={4} />
        </div>
        <div className="bg-white rounded-[28px] p-6 shadow-card space-y-3 h-fit">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
