/**
 * Effect preview clips — generated, do not edit by hand.
 *
 * Written by `scripts/seed-demo.ts` on 2026-09-20.
 *
 * These illustrate the effect cards and the runner's reference tile. They are
 * licensed footage, not model output, and every surface that shows one credits
 * it. The effect's own `exampleUrl` is a separate asset and stays ours,
 * because the mock provider returns it as a generated result.
 */

export type EffectPreview = {
  url: string;
  posterUrl: string;
  credit: { author: string; url: string };
};

export const EFFECT_PREVIEWS: Record<string, EffectPreview> = {
  "levitation": {
    "url": "/seed/effects/levitation.mp4",
    "posterUrl": "/seed/effects/levitation-poster.jpg",
    "credit": {
      "author": "Orhan Pergel",
      "url": "https://www.pexels.com/video/woman-running-with-flowing-cloth-on-bridge-31921087/"
    }
  },
  "liquid-melt": {
    "url": "/seed/effects/liquid-melt.mp4",
    "posterUrl": "/seed/effects/liquid-melt-poster.jpg",
    "credit": {
      "author": "StefWithAnF",
      "url": "https://www.pexels.com/video/close-up-shot-of-paints-mixing-4006561/"
    }
  },
  "colossus": {
    "url": "/seed/effects/colossus.mp4",
    "posterUrl": "/seed/effects/colossus-poster.jpg",
    "credit": {
      "author": "Kurt Von",
      "url": "https://www.pexels.com/video/low-angle-view-of-the-skyscrapers-5941931/"
    }
  },
  "bullet-orbit": {
    "url": "/seed/effects/bullet-orbit.mp4",
    "posterUrl": "/seed/effects/bullet-orbit-poster.jpg",
    "credit": {
      "author": "Altaf Shah",
      "url": "https://www.pexels.com/video/tiny-planet-view-of-urban-landscape-in-black-and-white-36277763/"
    }
  },
  "paper-cutout": {
    "url": "/seed/effects/paper-cutout.mp4",
    "posterUrl": "/seed/effects/paper-cutout-poster.jpg",
    "credit": {
      "author": "Vanessa Loring",
      "url": "https://www.pexels.com/video/making-a-sun-out-of-paper-cutouts-7868555/"
    }
  },
  "portal-step": {
    "url": "/seed/effects/portal-step.mp4",
    "posterUrl": "/seed/effects/portal-step-poster.jpg",
    "credit": {
      "author": "Alexander Grigorian",
      "url": "https://www.pexels.com/video/blurred-footage-of-a-person-walking-on-a-hallway-7523663/"
    }
  },
  "hero-spin": {
    "url": "/seed/effects/hero-spin.mp4",
    "posterUrl": "/seed/effects/hero-spin-poster.jpg",
    "credit": {
      "author": "cottonbro studio",
      "url": "https://www.pexels.com/video/close-up-of-priest-6276699/"
    }
  },
  "vertigo": {
    "url": "/seed/effects/vertigo.mp4",
    "posterUrl": "/seed/effects/vertigo-poster.jpg",
    "credit": {
      "author": "tunnel motions",
      "url": "https://www.pexels.com/video/videography-of-an-octagon-tunnel-2759485/"
    }
  }
};

export function effectPreview(slug: string): EffectPreview | null {
  return EFFECT_PREVIEWS[slug] ?? null;
}
