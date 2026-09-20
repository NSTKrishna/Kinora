"use client";

import * as React from "react";
import Image from "next/image";
import { Play } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AssetView } from "@/lib/serialize";

/**
 * Matches the Explore grid (1/2/3/4 columns). Callers that lay out differently
 * — a full-width preview, a fixed rail — pass their own, because a wrong
 * `sizes` makes the optimizer fetch the wrong rendition every time.
 */
const GRID_SIZES =
  "(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

/**
 * Renders one asset. Video autoplays muted on hover or keyboard focus and
 * rewinds when you leave, so a grid of clips stays calm until you point at one.
 * Clips carry a poster frame, so the tile shows the shot rather than a black
 * box while the file decodes.
 */
export function AssetMedia({
  asset,
  className,
  autoPlayOnHover = true,
  sizes = GRID_SIZES,
}: {
  asset: AssetView;
  className?: string;
  autoPlayOnHover?: boolean;
  sizes?: string;
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
          poster={asset.thumbUrl ?? undefined}
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

  const alt = asset.prompt ?? "Generated image";

  // A 2048px still behind a 300px tile is the difference between a grid that
  // settles instantly and one that streams megabytes. next/image resizes and
  // re-encodes per breakpoint, so the tile gets a tile and the preview gets
  // the full file.
  if (optimizable(asset.url) && asset.width && asset.height) {
    return (
      <Image
        src={asset.url}
        alt={alt}
        width={asset.width}
        height={asset.height}
        sizes={sizes}
        className={cn("object-cover", className)}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={asset.url} alt={alt} loading="lazy" className={cn("object-cover", className)} />
  );
}

/**
 * Whether next/image can serve this URL.
 *
 * The mock provider answers with SVG from an API route. Running SVG through
 * the image optimizer means enabling `dangerouslyAllowSVG`, which turns the
 * optimizer into an SVG proxy — not a trade worth making for placeholder
 * media. Those keep the plain `img` path, which is also the correct renderer
 * for a vector.
 */
function optimizable(url: string): boolean {
  if (url.endsWith(".svg") || url.includes("/api/mock/media/")) return false;
  return url.startsWith("/") || /^https:\/\//i.test(url);
}
