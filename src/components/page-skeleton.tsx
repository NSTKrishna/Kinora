import { Skeleton } from "@/components/ui/skeleton";

/** The header every page shares, while its data is still in flight. */
export function HeaderSkeleton() {
  return (
    <div className="space-y-3 border-b border-border pb-6">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-full max-w-md" />
    </div>
  );
}

export function ChipsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mt-6 flex gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-7 w-20 rounded-sm" />
      ))}
    </div>
  );
}

/**
 * A composer-shaped placeholder: the sticky panel on one side, the results
 * column on the other. Holding the real layout means the page does not jump
 * when the data lands.
 */
export function ComposerSkeleton() {
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <div className="surface flex flex-col gap-4 p-4">
        <Skeleton className="h-3 w-16" />
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-md" />
        ))}
        <Skeleton className="h-24 w-full rounded-md" />
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
      <Skeleton className="min-h-[320px] w-full rounded-lg" />
    </div>
  );
}
