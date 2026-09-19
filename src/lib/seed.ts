/**
 * The demo seed set — generated, do not edit by hand.
 *
 * Written by `scripts/seed-demo.ts` on 2026-09-19 using the
 * `mock` provider. Explore falls back to these when there is not enough
 * published work to fill the grid, so the landing page is never blank.
 *
 * Re-render them with:  PROVIDER=fal pnpm seed:demo
 */

export type SeedAsset = {
  slug: string;
  prompt: string;
  kind: "image" | "video";
  aspect: "16:9" | "9:16" | "1:1" | "4:5";
  url: string;
  width?: number;
  height?: number;
  durationMs: number | null;
  modelId: string;
};

/** True when these came from a real provider rather than the mock. */
export const SEED_IS_REAL = false;

export const SEED_ASSETS: SeedAsset[] = [
  {
    slug: "rain-platform",
    prompt:
      "A lone figure waits at the end of an empty subway platform, sodium light on wet tile, long lens compression, heavy film grain",
    kind: "image",
    aspect: "4:5",
    url: "/seed/rain-platform.webp",
    width: 768,
    height: 1024,
    durationMs: null,
    modelId: "flux-schnell",
  },
  {
    slug: "brutalist-dusk",
    prompt:
      "A brutalist concrete tower at dusk, haze between the floors, long lens, the last of the sun on one corner",
    kind: "image",
    aspect: "16:9",
    url: "/seed/brutalist-dusk.webp",
    width: 1024,
    height: 576,
    durationMs: null,
    modelId: "flux-schnell",
  },
  {
    slug: "practical-lamp",
    prompt:
      "A portrait lit by a single practical lamp just out of frame, steep falloff into darkness, 85mm, shallow focus",
    kind: "image",
    aspect: "4:5",
    url: "/seed/practical-lamp.webp",
    width: 768,
    height: 1024,
    durationMs: null,
    modelId: "flux-schnell",
  },
  {
    slug: "desert-vanish",
    prompt:
      "A desert highway running to a vanishing point, heat shimmer lifting off the asphalt, anamorphic flare across the frame",
    kind: "image",
    aspect: "16:9",
    url: "/seed/desert-vanish.webp",
    width: 1024,
    height: 576,
    durationMs: null,
    modelId: "flux-schnell",
  },
  {
    slug: "studio-glass",
    prompt:
      "Editorial still life of glass and brushed steel on seamless black, one hard key, clean specular roll",
    kind: "image",
    aspect: "1:1",
    url: "/seed/studio-glass.webp",
    width: 1024,
    height: 1024,
    durationMs: null,
    modelId: "flux-schnell",
  },
  {
    slug: "pigment-macro",
    prompt:
      "Macro of cracked pigment on a studio wall, raking light picking out every ridge, razor-thin plane of focus",
    kind: "image",
    aspect: "4:5",
    url: "/seed/pigment-macro.webp",
    width: 768,
    height: 1024,
    durationMs: null,
    modelId: "flux-schnell",
  },
  {
    slug: "underpass",
    prompt:
      "A silhouette under a sodium-vapour underpass, wet asphalt throwing the light back, deep unlit gaps",
    kind: "image",
    aspect: "9:16",
    url: "/seed/underpass.webp",
    width: 576,
    height: 1024,
    durationMs: null,
    modelId: "flux-schnell",
  },
  {
    slug: "greenhouse",
    prompt:
      "Morning light through a derelict greenhouse, condensation on cracked panes, overgrowth reclaiming the benches",
    kind: "image",
    aspect: "16:9",
    url: "/seed/greenhouse.webp",
    width: 1024,
    height: 576,
    durationMs: null,
    modelId: "flux-schnell",
  },
  {
    slug: "market-lanterns",
    prompt:
      "A night market alley strung with paper lanterns, steam rising through the light, shallow depth of field",
    kind: "image",
    aspect: "4:5",
    url: "/seed/market-lanterns.webp",
    width: 768,
    height: 1024,
    durationMs: null,
    modelId: "flux-schnell",
  },
  {
    slug: "cliff-fog",
    prompt:
      "A coastal cliff path swallowed by fog, a single figure barely readable, soft overcast light, cool desaturated palette",
    kind: "image",
    aspect: "16:9",
    url: "/seed/cliff-fog.webp",
    width: 1024,
    height: 576,
    durationMs: null,
    modelId: "flux-schnell",
  },
  {
    slug: "workshop-hands",
    prompt:
      "Close on weathered hands working a lathe, sawdust suspended in a shaft of window light, warm midtones",
    kind: "image",
    aspect: "1:1",
    url: "/seed/workshop-hands.webp",
    width: 1024,
    height: 1024,
    durationMs: null,
    modelId: "flux-schnell",
  },
  {
    slug: "neon-diner",
    prompt: "A roadside diner at 3am, neon sign bleeding across the wet lot, nobody in the windows",
    kind: "image",
    aspect: "16:9",
    url: "/seed/neon-diner.webp",
    width: 1024,
    height: 576,
    durationMs: null,
    modelId: "flux-schnell",
  },
  {
    slug: "alley-dolly",
    prompt:
      "Slow dolly forward through a rain-slick alley, neon bleeding into the puddles, steam crossing the frame",
    kind: "video",
    aspect: "16:9",
    url: "/seed/alley-dolly.mp4",
    width: 640,
    height: 360,
    durationMs: 6000,
    modelId: "ltx-t2v",
  },
  {
    slug: "monolith-orbit",
    prompt: "The camera arcs in a level orbit around a floating monolith above still water at dusk",
    kind: "video",
    aspect: "16:9",
    url: "/seed/monolith-orbit.mp4",
    width: 640,
    height: 360,
    durationMs: 6000,
    modelId: "ltx-t2v",
  },
  {
    slug: "pines-push",
    prompt: "Handheld push-in through fog-lit pines, volumetric shafts breaking between the trunks",
    kind: "video",
    aspect: "9:16",
    url: "/seed/pines-push.mp4",
    width: 360,
    height: 640,
    durationMs: 6000,
    modelId: "ltx-t2v",
  },
  {
    slug: "curtain-window",
    prompt:
      "Locked-off shot of a curtain breathing in front of an open window, afternoon light moving across the floor",
    kind: "video",
    aspect: "4:5",
    url: "/seed/curtain-window.mp4",
    width: 360,
    height: 640,
    durationMs: 6000,
    modelId: "ltx-t2v",
  },
  {
    slug: "helmet-zoom",
    prompt:
      "Crash zoom onto a chrome helmet, sparks drifting past in slow motion, hard rim light from behind",
    kind: "video",
    aspect: "16:9",
    url: "/seed/helmet-zoom.mp4",
    width: 640,
    height: 360,
    durationMs: 6000,
    modelId: "ltx-t2v",
  },
  {
    slug: "crane-rooftops",
    prompt:
      "The camera cranes upward off a rooftop at golden hour and tilts down over the blocks below",
    kind: "video",
    aspect: "16:9",
    url: "/seed/crane-rooftops.mp4",
    width: 640,
    height: 360,
    durationMs: 6000,
    modelId: "ltx-t2v",
  },
  {
    slug: "tide-lockoff",
    prompt:
      "Locked-off camera on a black sand beach as the tide runs in and out over the frame, overcast and flat",
    kind: "video",
    aspect: "9:16",
    url: "/seed/tide-lockoff.mp4",
    width: 360,
    height: 640,
    durationMs: 6000,
    modelId: "ltx-t2v",
  },
  {
    slug: "corridor-track",
    prompt:
      "The camera tracks sideways down a hotel corridor, doors passing in rhythm, practical sconces streaking",
    kind: "video",
    aspect: "16:9",
    url: "/seed/corridor-track.mp4",
    width: 640,
    height: 360,
    durationMs: 6000,
    modelId: "ltx-t2v",
  },
];
