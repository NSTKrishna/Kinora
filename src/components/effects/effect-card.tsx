"use client";

import * as React from "react";
import Link from "next/link";
import { Coins, Wand2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EffectView } from "@/lib/presets";
import { effectPreview } from "@/lib/effect-previews";

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
  // The preview sells the effect; `exampleUrl` is what the mock provider hands
  // back as a result, so it is not interchangeable with this.
  const preview = effectPreview(effect.slug);
  const clipUrl = preview?.url ?? effect.exampleUrl;
  const start = () => {
    void videoRef.current?.play().catch(() => {});
  };

  const stop = () => {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  };

  return (
    <Link
      href={`/effects/${effect.slug}`}
      onMouseEnter={start}
      onMouseLeave={stop}
      onFocus={start}
      onBlur={stop}
      className={cn(
        "hover:glow-ember group relative isolate block overflow-hidden rounded-lg border border-border",
        "transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {/* The clip is the card. DESIGN.md keeps gradients out of the interface,
          so the still under the loop is the clip's own poster frame — it paints
          immediately, while `preload="none"` keeps a grid of eight cards from
          costing a visitor megabytes before they have chosen anything. */}
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        {clipUrl ? (
          <video
            ref={videoRef}
            src={clipUrl}
            poster={preview?.posterUrl}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-medium text-white">{effect.title}</h3>
          {effect.description ? (
            <p className="line-clamp-2 text-xs text-white/60">{effect.description}</p>
          ) : null}
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-sm bg-white/10 px-2.5 py-1 text-micro uppercase tracking-[0.12em] text-white backdrop-blur">
          <Wand2 className="size-3" />
          <span className="hidden sm:inline">Use</span>
        </span>
      </div>

      <span className="absolute left-3 top-3 flex items-center gap-1 rounded-sm bg-black/55 px-2 py-1 text-micro font-450 uppercase tracking-[0.12em] text-white/90 backdrop-blur">
        <Coins className="size-3" />
        {effect.credits}
      </span>
    </Link>
  );
}
