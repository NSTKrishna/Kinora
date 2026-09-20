"use client";

import * as React from "react";
import { Play } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AssetView } from "@/lib/serialize";

/**
 * Renders one asset. Video autoplays muted on hover or keyboard focus and
 * rewinds when you leave, so a grid of clips stays calm until you point at one.
 */
export function AssetMedia({
  asset,
  className,
  autoPlayOnHover = true,
}: {
  asset: AssetView;
  className?: string;
  autoPlayOnHover?: boolean;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = React.useState(false);

  const start = () => {
    if (!autoPlayOnHover) return;
    const el = videoRef.current;
    if (!el) return;
    setPlaying(true);
    void el.play().catch(() => setPlaying(false));
  };

  const stop = () => {
    if (!autoPlayOnHover) return;
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setPlaying(false);
  };

  if (asset.kind === "video") {
    return (
      <div
        className={cn("relative isolate overflow-hidden", className)}
        onMouseEnter={start}
        onMouseLeave={stop}
        onFocus={start}
        onBlur={stop}
      >
        <video
          ref={videoRef}
          src={asset.url}
          muted
          loop
          playsInline
          preload="metadata"
          controls={!autoPlayOnHover}
          className="h-full w-full object-cover"
        />
        {autoPlayOnHover ? (
          <span
            className={cn(
              "pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-sm bg-black/60 px-2 py-1 text-micro font-450 uppercase tracking-[0.12em] text-white/90 backdrop-blur transition-opacity",
              playing ? "opacity-0" : "opacity-100",
            )}
          >
            <Play className="size-3 fill-current" />
            {asset.durationMs ? `${Math.round(asset.durationMs / 1000)}s` : "Video"}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset.url}
      alt={asset.prompt ?? "Generated image"}
      loading="lazy"
      className={cn("object-cover", className)}
    />
  );
}
