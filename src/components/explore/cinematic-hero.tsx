"use client";

import * as React from "react";

import { SEED_ASSETS } from "@/lib/seed";

/**
 * The cinematic hero.
 *
 * DESIGN.md names this as Runway's defining component: a full-bleed clip with
 * the headline over it, where "the image IS the design". It replaces the seeded
 * CSS gradient that stood in before there was any real media — and the system
 * is explicit that gradients belong in photography, never in the interface.
 *
 * The clip is muted, looped and `playsInline`, so it behaves as a background
 * rather than as content: no controls, no sound, nothing to dismiss. It is not
 * announced to assistive tech either, because the headline already carries the
 * meaning and the motion carries none.
 */
const HERO = SEED_ASSETS.find((a) => a.kind === "video" && a.aspect === "16:9");

export function CinematicHero() {
  const ref = React.useRef<HTMLVideoElement>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Honour the OS setting: a hero that plays itself is exactly the kind of
    // unrequested motion prefers-reduced-motion exists to stop. The first
    // frame still shows, so the composition survives.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    void el.play().catch(() => {});
  }, []);

  if (!HERO) return <div className="absolute inset-0 -z-10 bg-background" />;

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-black">
      <video
        ref={ref}
        src={HERO.url}
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
        onLoadedData={() => setReady(true)}
        className={`h-full w-full object-cover transition-opacity duration-1000 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* Readability scrim. DESIGN.md: "dark overlays on hero images for text
          readability" — the only treatment the media gets. */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/20" />
      <div className="grain absolute inset-0" />
    </div>
  );
}
