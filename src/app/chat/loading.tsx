import { Skeleton } from '@client/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8" aria-busy="true">
      <div className="bg-white rounded-[28px] shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#ebebeb]">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="p-5 space-y-3">
          <Skeleton className="h-12 w-2/3 rounded-2xl" />
          <Skeleton className="h-12 w-1/2 rounded-2xl ml-auto" />
          <Skeleton className="h-12 w-3/5 rounded-2xl" />
        </div>
        <div className="px-5 py-4 border-t border-[#ebebeb]">
          <Skeleton className="h-11 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
