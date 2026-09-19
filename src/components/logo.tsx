import { cn } from "@/lib/utils";

/** Kinora mark: an aperture blade opening — original, drawn here, not borrowed. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("shrink-0", className)} aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <path d="M12 2a10 10 0 0 1 8.66 5L12 12Z" fill="hsl(var(--primary))" />
      <path d="M20.66 17A10 10 0 0 1 3.34 17L12 12Z" fill="currentColor" opacity="0.55" />
    </svg>
  );
}
