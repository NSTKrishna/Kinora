/**
 * Placeholder feed data for the scaffold.
 *
 * Every tile is rendered from a seeded gradient recipe — no third-party media,
 * no scraped assets. Real outputs replace these once the jobs pipeline lands.
 */

export type MediaKind = "image" | "video";

export type FeedItem = {
  id: string;
  kind: MediaKind;
  prompt: string;
  model: string;
  author: string;
  aspect: "1:1" | "4:5" | "3:4" | "16:9" | "9:16";
  /** Seeded gradient stops, in order. */
  palette: [string, string, string];
  durationSeconds?: number;
  /** When the shot is one of our effects, Recreate opens that effect instead. */
  effectSlug?: string;
};

export const ASPECT_CLASS: Record<FeedItem["aspect"], string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "3:4": "aspect-[3/4]",
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
};

export const FEED_ITEMS: FeedItem[] = [
  {
    id: "f01",
    kind: "video",
    prompt: "Slow dolly through a rain-slick alley, neon signage bleeding into puddles",
    model: "Kinora Motion v1",
    author: "orbit.studio",
    aspect: "9:16",
    palette: ["#2b1055", "#7f2b8e", "#ff6a3d"],
    durationSeconds: 6,
  },
  {
    id: "f02",
    kind: "image",
    prompt: "Portrait lit by a single practical lamp, 85mm, heavy film grain",
    model: "Kinora Still XL",
    author: "mara.k",
    aspect: "4:5",
    palette: ["#1a1109", "#9a4b18", "#f3b27a"],
  },
  {
    id: "f03",
    effectSlug: "colossus",
    kind: "image",
    prompt: "Brutalist tower at golden hour, long lens compression, haze",
    model: "Kinora Still XL",
    author: "n.void",
    aspect: "1:1",
    palette: ["#12161f", "#3b5d7a", "#e9a33c"],
  },
  {
    id: "f04",
    effectSlug: "vertigo",
    kind: "video",
    prompt: "Crash zoom onto a chrome helmet, sparks drifting in slow motion",
    model: "Kinora Motion v1",
    author: "kilo.frames",
    aspect: "16:9",
    palette: ["#05070a", "#4a5b6b", "#ff7a2f"],
    durationSeconds: 4,
  },
  {
    id: "f05",
    kind: "image",
    prompt: "Desert highway vanishing point, heat shimmer, anamorphic flare",
    model: "Kinora Still XL",
    author: "ana.sol",
    aspect: "3:4",
    palette: ["#241405", "#a85b1f", "#ffd9a0"],
  },
  {
    id: "f06",
    effectSlug: "bullet-orbit",
    kind: "video",
    prompt: "Orbit around a floating monolith above still water at dusk",
    model: "Kinora Motion v1",
    author: "orbit.studio",
    aspect: "1:1",
    palette: ["#0b1020", "#2d3f73", "#8fb8ff"],
    durationSeconds: 8,
  },
  {
    id: "f07",
    kind: "image",
    prompt: "Macro of cracked pigment on a studio wall, raking light",
    model: "Kinora Still XL",
    author: "t.ferro",
    aspect: "4:5",
    palette: ["#170f0b", "#6f3a24", "#d9a06b"],
  },
  {
    id: "f08",
    kind: "video",
    prompt: "Handheld push-in through fog-lit pines, volumetric shafts",
    model: "Kinora Motion v1",
    author: "quiet.hours",
    aspect: "9:16",
    palette: ["#060d0b", "#1f4c40", "#7fd8b4"],
    durationSeconds: 5,
  },
  {
    id: "f09",
    effectSlug: "hero-spin",
    kind: "image",
    prompt: "Editorial still life, glass and steel, hard key with black backdrop",
    model: "Kinora Still XL",
    author: "mara.k",
    aspect: "1:1",
    palette: ["#0a0a0c", "#3a3a45", "#cfd4dd"],
  },
  {
    id: "f10",
    kind: "video",
    prompt: "Whip pan across a night market, bokeh lanterns streaking",
    model: "Kinora Motion v1",
    author: "kilo.frames",
    aspect: "16:9",
    palette: ["#1b0a14", "#8c1f4b", "#ffb15c"],
    durationSeconds: 6,
  },
  {
    id: "f11",
    kind: "image",
    prompt: "Silhouette against a sodium-vapour underpass, wet asphalt",
    model: "Kinora Still XL",
    author: "n.void",
    aspect: "3:4",
    palette: ["#0d0b06", "#6b4a12", "#ffcf6b"],
  },
  {
    id: "f12",
    kind: "video",
    prompt: "Locked-off shot, curtain breathing in front of an open window",
    model: "Kinora Motion v1",
    author: "quiet.hours",
    aspect: "4:5",
    palette: ["#10131a", "#4c5a6e", "#e6ecf5"],
    durationSeconds: 7,
  },
];

const POSTER_PALETTES: [string, string, string][] = [
  ["#1b0a14", "#8c1f4b", "#ff7a2f"],
  ["#0b1020", "#2d3f73", "#8fb8ff"],
  ["#241405", "#a85b1f", "#ffd9a0"],
  ["#060d0b", "#1f4c40", "#7fd8b4"],
  ["#2b1055", "#7f2b8e", "#ff6a3d"],
  ["#0a0a0c", "#3a3a45", "#cfd4dd"],
];

/** A stable palette for anything with a slug, so posters never reshuffle. */
export function paletteFor(seed: string): [string, string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return POSTER_PALETTES[hash % POSTER_PALETTES.length];
}

/**
 * Where Recreate on an Explore card goes.
 *
 * A shot that one of our effects makes opens that effect — one photo and it is
 * done. Anything else drops the prompt into the matching composer, which is the
 * honest fallback: the visitor gets a starting point, not a promise we cannot
 * keep that the render will match.
 */
export function recreateHref(item: FeedItem): string {
  if (item.effectSlug) return `/effects/${item.effectSlug}`;
  const page = item.kind === "video" ? "/video" : "/image";
  return `${page}?prompt=${encodeURIComponent(item.prompt)}`;
}

/** Deterministic CSS background for a seeded gradient poster. */
export function posterStyle(palette: readonly string[], seed = 0) {
  const [a, b, c] = palette;
  const angle = 120 + ((seed * 37) % 120);
  return {
    backgroundColor: a,
    backgroundImage: [
      `radial-gradient(120% 90% at ${20 + ((seed * 13) % 60)}% ${15 + ((seed * 7) % 50)}%, ${c}66 0%, transparent 60%)`,
      `radial-gradient(90% 70% at ${70 - ((seed * 11) % 50)}% ${80 - ((seed * 5) % 40)}%, ${b}88 0%, transparent 65%)`,
      `linear-gradient(${angle}deg, ${a} 0%, ${b}cc 55%, ${c}55 100%)`,
    ].join(","),
  } satisfies React.CSSProperties;
}
