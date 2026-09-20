import { FlaskConical } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Says out loud that the media beside it is not a real render.
 *
 * A placeholder reaches a viewer two ways: the whole deployment is in mock
 * mode, or hybrid mode stood one in because a provider could not serve us.
 * The promise to the viewer is identical in both cases, so both look the same
 * here, and the wording claims no specific cause — the client is not told
 * which mode the server is in, and guessing would be worse than not saying.
 *
 * Kinora never shows generated-looking media without saying where it came
 * from. This is the render-side counterpart of the "Reference" badge that the
 * licensed seed footage carries in Explore.
 */

/** True when this job's output is placeholder media rather than a real render. */
export function isPlaceholder(provider: string | null | undefined): boolean {
  return provider === "mock";
}

/** Overlay pill, for a corner of the media itself. */
export function PlaceholderBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none inline-flex items-center gap-1 rounded-sm bg-black/60 px-2 py-1",
        "text-micro font-450 uppercase tracking-[0.12em] text-white/80 backdrop-blur",
        className,
      )}
    >
      <FlaskConical aria-hidden className="size-3" />
      Placeholder
    </span>
  );
}

/** One line of prose, for a result panel or the "How this was made" drawer. */
export function PlaceholderNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      <FlaskConical aria-hidden className="mr-1 inline size-3 align-[-2px]" />
      Placeholder media — a stand-in clip, not a real render. The prompt above is exactly what
      would have been sent to the model.
    </p>
  );
}
