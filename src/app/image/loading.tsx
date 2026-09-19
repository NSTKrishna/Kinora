import { ComposerSkeleton, HeaderSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <div className="container py-8">
      <HeaderSkeleton />
      <ComposerSkeleton />
    </div>
  );
}
