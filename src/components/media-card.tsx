"use client";

import * as React from "react";
import Link from "next/link";
import { Play, Sparkles, Repeat2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { ASPECT_CLASS, posterStyle, recreateHref, type FeedItem } from "@/lib/placeholder";

type MediaCardProps = {
  item: FeedItem;
  /** Optional poster image. Falls back to the seeded gradient. */
  src?: string;
  /** Plays on hover / focus when present. */
  videoSrc?: string;
  seed?: number;
  className?: string;
  priority?: boolean;
};

export function MediaCard({ item, src, videoSrc, seed = 0, className }: MediaCardProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [active, setActive] = React.useState(false);

  const start = React.useCallback(() => {
    setActive(true);
    const el = videoRef.current;
    if (el) void el.play().catch(() => {});
  }, []);

  const stop = React.useCallback(() => {
    setActive(false);
    const el = videoRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  }, []);

  return (
    <article
      className={cn(
        "group relative isolate w-full overflow-hidden rounded-lg border border-border/70 bg-card",
        "hover:glow-ember transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5",
        "focus-within:glow-ember focus-within:-translate-y-0.5",
        className,
      )}
      onMouseEnter={start}
      onMouseLeave={stop}
      onFocus={start}
      onBlur={stop}
    >
      <div className={cn("relative w-full overflow-hidden", ASPECT_CLASS[item.aspect])}>
        <div
          className={cn(
            "absolute inset-0 transition-transform ease-out [transition-duration:1200ms]",
            active ? "scale-[1.06]" : "scale-100",
          )}
          style={
            src
              ? {
                  backgroundImage: `url(${src})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : posterStyle(item.palette, seed)
          }
        />
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            muted
            loop
            playsInline
            preload="none"
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
              active ? "opacity-100" : "opacity-0",
            )}
          />
        ) : null}

        {/* Legibility scrim — media stays the subject. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

        {item.kind === "video" ? (
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 text-micro font-medium uppercase tracking-[0.12em] text-white/90 backdrop-blur">
            <Play className="size-3 fill-current" />
            {item.durationSeconds ? `${item.durationSeconds}s` : "Video"}
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="line-clamp-2 text-sm text-white/90">{item.prompt}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="truncate text-micro uppercase tracking-[0.14em] text-white/55">
              {item.author} · {item.model}
            </span>
            <Link
              href={recreateHref(item)}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-micro font-medium uppercase tracking-[0.12em] text-white backdrop-blur",
                "transition-[opacity,background-color] duration-200 hover:bg-white/20",
                // Always reachable by keyboard; revealed on hover for the mouse.
                "opacity-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 group-focus-within:opacity-100 group-hover:opacity-100",
              )}
            >
              <Repeat2 className="size-3" />
              {item.effectSlug ? "Recreate" : "Remix"}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export function MediaCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg border border-border/70",
        className,
      )}
    >
      <div className="aspect-[4/5] w-full animate-pulse bg-muted/60" />
      <div className="absolute inset-x-0 bottom-0 space-y-2 p-3">
        <div className="h-3 w-4/5 rounded bg-white/10" />
        <div className="h-3 w-2/5 rounded bg-white/[0.06]" />
      </div>
    </div>
  );
}

export function MediaCardPlaceholder() {
  return (
    <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-muted-foreground">
      <Sparkles className="size-5" />
      <span className="text-xs">Your next render lands here</span>
    </div>
  );
}
