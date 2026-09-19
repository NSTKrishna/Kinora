"use client";

import * as React from "react";
import Link from "next/link";
import { Coins, Wand2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { paletteFor, posterStyle } from "@/lib/placeholder";
import type { EffectView } from "@/lib/presets";

/**
 * One effect in the grid or the landing rail.
 *
 * The example loop is the pitch, so it plays on hover and on keyboard focus,
 * muted, and rewinds when you leave. Nothing downloads until you point at it
 * (`preload="none"`) — a grid of eight clips must not cost a visitor a couple
 * of megabytes before they have chosen anything.
 */
export function EffectCard({ effect, className }: { effect: EffectView; className?: string }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = React.useState(false);

  const start = () => {
    const el = videoRef.current;
    if (!el) return;
    setPlaying(true);
    void el.play().catch(() => setPlaying(false));
  };

  const stop = () => {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setPlaying(false);
  };

  return (
    <Link
      href={`/effects/${effect.slug}`}
      onMouseEnter={start}
      onMouseLeave={stop}
      onFocus={start}
      onBlur={stop}
      className={cn(
        "hover:glow-ember group relative isolate block overflow-hidden rounded-lg border border-border/70",
        "transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden">
        <div className="absolute inset-0" style={posterStyle(paletteFor(effect.slug), 3)} />
        {effect.exampleUrl ? (
          <video
            ref={videoRef}
            src={effect.exampleUrl}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
              playing ? "opacity-100" : "opacity-0",
            )}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-medium text-white">{effect.title}</h3>
          {effect.description ? (
            <p className="line-clamp-2 text-xs text-white/60">{effect.description}</p>
          ) : null}
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-micro uppercase tracking-[0.12em] text-white backdrop-blur">
          <Wand2 className="size-3" />
          <span className="hidden sm:inline">Use</span>
        </span>
      </div>

      <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-micro font-medium uppercase tracking-[0.12em] text-white/90 backdrop-blur">
        <Coins className="size-3" />
        {effect.credits}
      </span>
    </Link>
  );
}
