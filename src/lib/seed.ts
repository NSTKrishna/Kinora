/**
 * The demo seed set — generated, do not edit by hand.
 *
 * Written by `scripts/seed-demo.ts` on 2026-09-20 from the
 * `pexels` source. Explore falls back to these when there is not enough
 * published work to fill the grid, so the landing page is never blank.
 *
 * Re-render them with:  SOURCE=pexels pnpm seed:demo   (free, curated stock)
 *                       PROVIDER=fal   pnpm seed:demo   (real renders, real money)
 */

export type SeedCredit = {
  author: string;
  url: string;
};

export type SeedAsset = {
  slug: string;
  prompt: string;
  kind: "image" | "video";
  aspect: "16:9" | "9:16" | "1:1" | "4:5";
  url: string;
  /** First frame of a clip, for the `poster` attribute. Null for images. */
  posterUrl: string | null;
  width?: number;
  height?: number;
  durationMs: number | null;
  /** Null when the media did not come from a model. */
  modelId: string | null;
  /** Set for licensed stock, so the UI can credit it. Null for our own renders. */
  credit: SeedCredit | null;
};

/** Where this set came from, so the UI can describe it honestly. */
export const SEED_SOURCE = "pexels" as "mock" | "fal" | "pexels";

/** True when these came from a real model rather than the mock placeholders. */
export const SEED_IS_REAL = false;

/**
 * True when the set is licensed footage rather than model output. Surfaces
 * that show it must not imply a model made it.
 */
export const SEED_IS_STOCK = true;

export const SEED_ASSETS: SeedAsset[] = [
  {
    "slug": "rain-platform",
    "prompt": "A lone figure waits at the end of an empty subway platform, sodium light on wet tile, long lens compression, heavy film grain",
    "kind": "image",
    "aspect": "4:5",
    "url": "/seed/rain-platform.webp",
    "posterUrl": null,
    "width": 2048,
    "height": 3072,
    "durationMs": null,
    "modelId": null,
    "credit": {
      "author": "Wallace Chuck",
      "url": "https://www.pexels.com/photo/a-train-at-a-subway-station-17269843/"
    }
  },
  {
    "slug": "brutalist-dusk",
    "prompt": "A brutalist concrete tower at dusk, haze between the floors, long lens, the last of the sun on one corner",
    "kind": "image",
    "aspect": "16:9",
    "url": "/seed/brutalist-dusk.webp",
    "posterUrl": null,
    "width": 2048,
    "height": 1366,
    "durationMs": null,
    "modelId": null,
    "credit": {
      "author": "Valeriia Slobodeniuk",
      "url": "https://www.pexels.com/photo/block-of-flats-among-trees-at-night-14780198/"
    }
  },
  {
    "slug": "practical-lamp",
    "prompt": "A portrait lit by a single practical lamp just out of frame, steep falloff into darkness, 85mm, shallow focus",
    "kind": "image",
    "aspect": "4:5",
    "url": "/seed/practical-lamp.webp",
    "posterUrl": null,
    "width": 2048,
    "height": 2560,
    "durationMs": null,
    "modelId": null,
    "credit": {
      "author": "Allan Carvalho",
      "url": "https://www.pexels.com/photo/dramatic-portrait-with-red-accent-lighting-33219320/"
    }
  },
  {
    "slug": "desert-vanish",
    "prompt": "A desert highway running to a vanishing point, heat shimmer lifting off the asphalt, anamorphic flare across the frame",
    "kind": "image",
    "aspect": "16:9",
    "url": "/seed/desert-vanish.webp",
    "posterUrl": null,
    "width": 2048,
    "height": 1366,
    "durationMs": null,
    "modelId": null,
    "credit": {
      "author": "Irfan Rahat",
      "url": "https://www.pexels.com/photo/gray-asphalt-road-under-blue-sky-10999980/"
    }
  },
  {
    "slug": "studio-glass",
    "prompt": "Editorial still life of glass and brushed steel on seamless black, one hard key, clean specular roll",
    "kind": "image",
    "aspect": "1:1",
    "url": "/seed/studio-glass.webp",
    "posterUrl": null,
    "width": 2048,
    "height": 2048,
    "durationMs": null,
    "modelId": null,
    "credit": {
      "author": "Valentin Ivantsov",
      "url": "https://www.pexels.com/photo/black-and-white-artistic-bottle-and-glass-arrangement-34686418/"
    }
  },
  {
    "slug": "pigment-macro",
    "prompt": "Macro of cracked pigment on a studio wall, raking light picking out every ridge, razor-thin plane of focus",
    "kind": "image",
    "aspect": "4:5",
    "url": "/seed/pigment-macro.webp",
    "posterUrl": null,
    "width": 2048,
    "height": 2966,
    "durationMs": null,
    "modelId": null,
    "credit": {
      "author": "Ellie Burgin",
      "url": "https://www.pexels.com/photo/close-up-of-weathered-peeling-paint-texture-37011499/"
    }
  },
  {
    "slug": "underpass",
    "prompt": "A silhouette under a sodium-vapour underpass, wet asphalt throwing the light back, deep unlit gaps",
    "kind": "image",
    "aspect": "9:16",
    "url": "/seed/underpass.webp",
    "posterUrl": null,
    "width": 2048,
    "height": 3072,
    "durationMs": null,
    "modelId": null,
    "credit": {
      "author": "Samir Ali",
      "url": "https://www.pexels.com/photo/back-view-of-a-person-with-an-umbrella-walking-in-the-rain-13085571/"
    }
  },
  {
    "slug": "greenhouse",
    "prompt": "Morning light through a derelict greenhouse, condensation on cracked panes, overgrowth reclaiming the benches",
    "kind": "image",
    "aspect": "16:9",
    "url": "/seed/greenhouse.webp",
    "posterUrl": null,
    "width": 2048,
    "height": 1536,
    "durationMs": null,
    "modelId": null,
    "credit": {
      "author": "Алесь Усцінаў",
      "url": "https://www.pexels.com/photo/plants-inside-the-greenhouse-9782978/"
    }
  },
  {
    "slug": "market-lanterns",
    "prompt": "A night market alley strung with paper lanterns, steam rising through the light, shallow depth of field",
    "kind": "image",
    "aspect": "4:5",
    "url": "/seed/market-lanterns.webp",
    "posterUrl": null,
    "width": 1822,
    "height": 2430,
    "durationMs": null,
    "modelId": null,
    "credit": {
      "author": "Teresa Wang",
      "url": "https://www.pexels.com/photo/traditional-lanterns-in-asian-market-alley-34222041/"
    }
  },
  {
    "slug": "cliff-fog",
    "prompt": "A coastal cliff path swallowed by fog, a single figure barely readable, soft overcast light, cool desaturated palette",
    "kind": "image",
    "aspect": "16:9",
    "url": "/seed/cliff-fog.webp",
    "posterUrl": null,
    "width": 2048,
    "height": 1536,
    "durationMs": null,
    "modelId": null,
    "credit": {
      "author": "ArtHouse Studio",
      "url": "https://www.pexels.com/photo/fog-over-rocks-on-sea-4581101/"
    }
  },
  {
    "slug": "workshop-hands",
    "prompt": "Close on weathered hands working a lathe, sawdust suspended in a shaft of window light, warm midtones",
    "kind": "image",
    "aspect": "1:1",
    "url": "/seed/workshop-hands.webp",
    "posterUrl": null,
    "width": 2048,
    "height": 2048,
    "durationMs": null,
    "modelId": null,
    "credit": {
      "author": "Alex Grandidier",
      "url": "https://www.pexels.com/photo/close-up-of-worker-using-electric-grinder-36398006/"
    }
  },
  {
    "slug": "neon-diner",
    "prompt": "A roadside diner at 3am, neon sign bleeding across the wet lot, nobody in the windows",
    "kind": "image",
    "aspect": "16:9",
    "url": "/seed/neon-diner.webp",
    "posterUrl": null,
    "width": 2048,
    "height": 1366,
    "durationMs": null,
    "modelId": null,
    "credit": {
      "author": "Josh Hild",
      "url": "https://www.pexels.com/photo/exterior-of-diner-at-night-12161836/"
    }
  },
  {
    "slug": "alley-dolly",
    "prompt": "Slow dolly forward through a rain-slick alley, neon bleeding into the puddles, steam crossing the frame",
    "kind": "video",
    "aspect": "16:9",
    "url": "/seed/alley-dolly.mp4",
    "posterUrl": "/seed/alley-dolly-poster.jpg",
    "width": 1840,
    "height": 1034,
    "durationMs": 8000,
    "modelId": null,
    "credit": {
      "author": "Pixabay",
      "url": "https://www.pexels.com/video/video-of-people-waiting-for-a-taxi-on-a-rainy-night-855432/"
    }
  },
  {
    "slug": "monolith-orbit",
    "prompt": "The camera arcs in a level orbit around a floating monolith above still water at dusk",
    "kind": "video",
    "aspect": "16:9",
    "url": "/seed/monolith-orbit.mp4",
    "posterUrl": "/seed/monolith-orbit-poster.jpg",
    "width": 1920,
    "height": 1080,
    "durationMs": 8008,
    "modelId": null,
    "credit": {
      "author": "AP Vibes",
      "url": "https://www.pexels.com/video/aerial-view-of-the-cliffs-and-ocean-28044002/"
    }
  },
  {
    "slug": "pines-push",
    "prompt": "Handheld push-in through fog-lit pines, volumetric shafts breaking between the trunks",
    "kind": "video",
    "aspect": "9:16",
    "url": "/seed/pines-push.mp4",
    "posterUrl": "/seed/pines-push-poster.jpg",
    "width": 1080,
    "height": 1920,
    "durationMs": 8008,
    "modelId": null,
    "credit": {
      "author": "Julien Goettelmann",
      "url": "https://www.pexels.com/video/majestic-aerial-view-of-misty-forest-29792651/"
    }
  },
  {
    "slug": "curtain-window",
    "prompt": "Locked-off shot of a curtain breathing in front of an open window, afternoon light moving across the floor",
    "kind": "video",
    "aspect": "4:5",
    "url": "/seed/curtain-window.mp4",
    "posterUrl": "/seed/curtain-window-poster.jpg",
    "width": 1080,
    "height": 1920,
    "durationMs": 8008,
    "modelId": null,
    "credit": {
      "author": "Sahil Sethiya",
      "url": "https://www.pexels.com/video/curtains-and-balcony-door-in-grayscale-10531277/"
    }
  },
  {
    "slug": "helmet-zoom",
    "prompt": "Crash zoom onto a chrome helmet, sparks drifting past in slow motion, hard rim light from behind",
    "kind": "video",
    "aspect": "16:9",
    "url": "/seed/helmet-zoom.mp4",
    "posterUrl": "/seed/helmet-zoom-poster.jpg",
    "width": 1920,
    "height": 1080,
    "durationMs": 8000,
    "modelId": null,
    "credit": {
      "author": "Mikhail Nilov",
      "url": "https://www.pexels.com/video/a-woman-wearing-a-space-helmet-7664955/"
    }
  },
  {
    "slug": "crane-rooftops",
    "prompt": "The camera cranes upward off a rooftop at golden hour and tilts down over the blocks below",
    "kind": "video",
    "aspect": "16:9",
    "url": "/seed/crane-rooftops.mp4",
    "posterUrl": "/seed/crane-rooftops-poster.jpg",
    "width": 1920,
    "height": 1080,
    "durationMs": 8008,
    "modelId": null,
    "credit": {
      "author": "Tom Schönmann",
      "url": "https://www.pexels.com/video/aerial-view-of-the-city-at-sunset-17088577/"
    }
  },
  {
    "slug": "tide-lockoff",
    "prompt": "Locked-off camera on a black sand beach as the tide runs in and out over the frame, overcast and flat",
    "kind": "video",
    "aspect": "9:16",
    "url": "/seed/tide-lockoff.mp4",
    "posterUrl": "/seed/tide-lockoff-poster.jpg",
    "width": 1080,
    "height": 1920,
    "durationMs": 6507,
    "modelId": null,
    "credit": {
      "author": "U.Lucas Dubé-Cantin",
      "url": "https://www.pexels.com/video/serene-ocean-waves-on-dark-sandy-beach-38345042/"
    }
  },
  {
    "slug": "corridor-track",
    "prompt": "The camera tracks sideways down a hotel corridor, doors passing in rhythm, practical sconces streaking",
    "kind": "video",
    "aspect": "16:9",
    "url": "/seed/corridor-track.mp4",
    "posterUrl": "/seed/corridor-track-poster.jpg",
    "width": 2048,
    "height": 1080,
    "durationMs": 8000,
    "modelId": null,
    "credit": {
      "author": "cottonbro studio",
      "url": "https://www.pexels.com/video/woman-walking-to-her-hotel-room-7608928/"
    }
  }
];
