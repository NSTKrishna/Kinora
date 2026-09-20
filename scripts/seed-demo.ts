/**
 * Renders the demo seed set, once.
 *
 * Explore is a community feed, and a community feed with nothing in it reads as
 * broken rather than new. This fills `public/seed/` from one of three sources,
 * transcodes everything to something a landing page can afford, and writes
 * `src/lib/seed.ts`.
 *
 *   PROVIDER=mock  pnpm seed:demo    # free, Kinora's own gradient plates
 *   PROVIDER=fal   pnpm seed:demo    # real renders, real money, run once
 *   SOURCE=pexels  pnpm seed:demo    # real footage, free, curated by hand
 *
 * `SOURCE=pexels` bypasses the provider entirely and downloads the pinned
 * stock picks in scripts/pexels.ts. It exists because the mock's gradients are
 * not media — nothing is in focus because there is nothing to focus on — and a
 * judged build cannot lead with that. What it produces is showcase media for
 * Explore, the hero and the effect rail. Generated job results are untouched:
 * those still come from the provider, so the product never shows stock footage
 * as something a model rendered.
 *
 * The output is committed, so the deployed site never depends on this having
 * run.
 *
 * Budget: images become webp at up to 2048px, clips are capped at 8 seconds
 * and 4MB at up to 1080p. Every clip also gets a poster frame, because a video
 * with no `poster` shows black until it decodes and that reads as broken.
 * ffmpeg must be on PATH.
 */
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { config } from "dotenv";

config({ path: ".env.local" });

const run = promisify(execFile);

const OUT_DIR = join(process.cwd(), "public", "seed");
const MODULE_PATH = join(process.cwd(), "src", "lib", "seed.ts");

/**
 * Budget. The old caps (720p, 3MB, CRF 30) were set when every clip was a
 * gradient plate, where detail could not survive because there was none. Real
 * footage has detail worth keeping, so the ceiling moves to 1080p and the
 * quality target to CRF 25 — roughly 1-3MB for eight seconds of this
 * material, which a landing page can still afford. The first pass at CRF 23
 * put two water-heavy shots over 8MB on their own; high-entropy footage needs
 * the hard ceiling below, not just a quality target.
 */
const MAX_VIDEO_BYTES = 4 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 8;
const MAX_VIDEO_SHORT_EDGE = 1080;
const VIDEO_CRF = 25;
const MAX_IMAGE_WIDTH = 2048;
const WEBP_QUALITY = 86;
/** Poster frames are the first thing anyone sees, so they are not thumbnails. */
const POSTER_QUALITY = 5;

const POLL_MS = 2_000;
const GIVE_UP_MS = 5 * 60 * 1000;

/** `pexels` skips the provider; anything else runs the configured one. */
const SOURCE = process.env.SOURCE ?? "provider";

type Recipe = {
  slug: string;
  prompt: string;
  kind: "image" | "video";
  aspect: "16:9" | "9:16" | "1:1" | "4:5";
};

/**
 * Twenty prompts chosen to show range rather than to flatter one model:
 * different subjects, lighting, focal lengths and both aspect families. All
 * original, and none of them names a studio, a film or a living artist.
 */
const RECIPES: Recipe[] = [
  {
    slug: "rain-platform",
    kind: "image",
    aspect: "4:5",
    prompt:
      "A lone figure waits at the end of an empty subway platform, sodium light on wet tile, long lens compression, heavy film grain",
  },
  {
    slug: "brutalist-dusk",
    kind: "image",
    aspect: "16:9",
    prompt:
      "A brutalist concrete tower at dusk, haze between the floors, long lens, the last of the sun on one corner",
  },
  {
    slug: "practical-lamp",
    kind: "image",
    aspect: "4:5",
    prompt:
      "A portrait lit by a single practical lamp just out of frame, steep falloff into darkness, 85mm, shallow focus",
  },
  {
    slug: "desert-vanish",
    kind: "image",
    aspect: "16:9",
    prompt:
      "A desert highway running to a vanishing point, heat shimmer lifting off the asphalt, anamorphic flare across the frame",
  },
  {
    slug: "studio-glass",
    kind: "image",
    aspect: "1:1",
    prompt:
      "Editorial still life of glass and brushed steel on seamless black, one hard key, clean specular roll",
  },
  {
    slug: "pigment-macro",
    kind: "image",
    aspect: "4:5",
    prompt:
      "Macro of cracked pigment on a studio wall, raking light picking out every ridge, razor-thin plane of focus",
  },
  {
    slug: "underpass",
    kind: "image",
    aspect: "9:16",
    prompt:
      "A silhouette under a sodium-vapour underpass, wet asphalt throwing the light back, deep unlit gaps",
  },
  {
    slug: "greenhouse",
    kind: "image",
    aspect: "16:9",
    prompt:
      "Morning light through a derelict greenhouse, condensation on cracked panes, overgrowth reclaiming the benches",
  },
  {
    slug: "market-lanterns",
    kind: "image",
    aspect: "4:5",
    prompt:
      "A night market alley strung with paper lanterns, steam rising through the light, shallow depth of field",
  },
  {
    slug: "cliff-fog",
    kind: "image",
    aspect: "16:9",
    prompt:
      "A coastal cliff path swallowed by fog, a single figure barely readable, soft overcast light, cool desaturated palette",
  },
  {
    slug: "workshop-hands",
    kind: "image",
    aspect: "1:1",
    prompt:
      "Close on weathered hands working a lathe, sawdust suspended in a shaft of window light, warm midtones",
  },
  {
    slug: "neon-diner",
    kind: "image",
    aspect: "16:9",
    prompt: "A roadside diner at 3am, neon sign bleeding across the wet lot, nobody in the windows",
  },

  {
    slug: "alley-dolly",
    kind: "video",
    aspect: "16:9",
    prompt:
      "Slow dolly forward through a rain-slick alley, neon bleeding into the puddles, steam crossing the frame",
  },
  {
    slug: "monolith-orbit",
    kind: "video",
    aspect: "16:9",
    prompt: "The camera arcs in a level orbit around a floating monolith above still water at dusk",
  },
  {
    slug: "pines-push",
    kind: "video",
    aspect: "9:16",
    prompt: "Handheld push-in through fog-lit pines, volumetric shafts breaking between the trunks",
  },
  {
    slug: "curtain-window",
    kind: "video",
    aspect: "4:5",
    prompt:
      "Locked-off shot of a curtain breathing in front of an open window, afternoon light moving across the floor",
  },
  {
    slug: "helmet-zoom",
    kind: "video",
    aspect: "16:9",
    prompt:
      "Crash zoom onto a chrome helmet, sparks drifting past in slow motion, hard rim light from behind",
  },
  {
    slug: "crane-rooftops",
    kind: "video",
    aspect: "16:9",
    prompt:
      "The camera cranes upward off a rooftop at golden hour and tilts down over the blocks below",
  },
  {
    slug: "tide-lockoff",
    kind: "video",
    aspect: "9:16",
    prompt:
      "Locked-off camera on a black sand beach as the tide runs in and out over the frame, overcast and flat",
  },
  {
    slug: "corridor-track",
    kind: "video",
    aspect: "16:9",
    prompt:
      "The camera tracks sideways down a hotel corridor, doors passing in rhythm, practical sconces streaking",
  },
];

const IMAGE_SIZE = {
  "16:9": "landscape_16_9",
  "4:5": "portrait_4_3",
  "1:1": "square_hd",
  "9:16": "portrait_16_9",
} as const;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  if (SOURCE === "pexels") return seedFromPexels();

  const { getProvider, providerFor, providerMode } = await import("@/lib/providers");
  const { getModel } = await import("@/lib/models");

  const name = providerMode();

  console.log(`\nSeeding ${RECIPES.length} prompts through the ${name} provider.`);
  if (name === "live") {
    console.log("This spends real money. Ctrl-C now if that was not the intention.\n");
    await new Promise((done) => setTimeout(done, 4000));
  }

  const entries: SeedEntry[] = [];

  for (const recipe of RECIPES) {
    process.stdout.write(`  ${recipe.slug.padEnd(18)} `);

    try {
      const modelId = recipe.kind === "image" ? "flux-schnell" : "ltx-t2v";
      const model = getModel(modelId)!;
      const provider = getProvider(providerFor(model));

      const params = model.schema.parse(
        recipe.kind === "image"
          ? { prompt: recipe.prompt, image_size: IMAGE_SIZE[recipe.aspect], num_images: 1 }
          : {
              prompt: recipe.prompt,
              aspect_ratio: recipe.aspect === "9:16" || recipe.aspect === "4:5" ? "9:16" : "16:9",
              duration: MAX_VIDEO_SECONDS,
              resolution: "1080p",
            },
      ) as Record<string, unknown>;

      const { providerRequestId } = await provider.submit({
        model,
        params,
        jobId: `seed-${recipe.slug}`,
      });

      const started = Date.now();
      for (;;) {
        const status = await provider.status(model, providerRequestId);
        if (status.state === "completed") break;
        if (status.state === "failed" || status.state === "nsfw") {
          throw new Error(`${status.state}: ${status.error}`);
        }
        if (Date.now() - started > GIVE_UP_MS) throw new Error("timed out");
        await new Promise((done) => setTimeout(done, POLL_MS));
      }

      const result = await provider.result(model, providerRequestId);
      const asset = result.assets[0];
      if (!asset) throw new Error("no output");

      const file = await materialise(recipe, asset.url);
      entries.push({
        slug: recipe.slug,
        prompt: recipe.prompt,
        kind: recipe.kind,
        aspect: recipe.aspect,
        url: `/seed/${file.name}`,
        posterUrl: file.posterName ? `/seed/${file.posterName}` : null,
        width: asset.width ?? file.width,
        height: asset.height ?? file.height,
        durationMs: asset.durationMs ?? null,
        modelId,
        credit: null,
        bytes: file.bytes,
      });

      console.log(`ok  ${(file.bytes / 1024).toFixed(0)}kB  ${file.name}`);
    } catch (error) {
      console.log(`SKIPPED (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  await writeModule(entries, name);
  report(entries);
}

/**
 * The stock path. No provider, no polling, no spend — each recipe resolves to
 * the Pexels asset pinned for its slug and takes the same transcode as
 * everything else, so the output shape is identical whichever source ran.
 */
async function seedFromPexels() {
  const { resolvePexels } = await import("./pexels");

  console.log(`\nSeeding ${RECIPES.length} slots from Pexels (curated, pinned by id).`);
  console.log("Showcase media only — job results still come from the provider.\n");

  const entries: SeedEntry[] = [];

  for (const recipe of RECIPES) {
    process.stdout.write(`  ${recipe.slug.padEnd(18)} `);

    try {
      const source = await resolvePexels(recipe.slug, recipe.kind);
      const file = await materialise(recipe, source.downloadUrl);

      entries.push({
        slug: recipe.slug,
        prompt: recipe.prompt,
        kind: recipe.kind,
        aspect: recipe.aspect,
        url: `/seed/${file.name}`,
        posterUrl: file.posterName ? `/seed/${file.posterName}` : null,
        // The transcode decides the final pixels, so probe wins over the
        // source dimensions — otherwise the grid reserves the wrong box and
        // every tile shifts once the file lands.
        width: file.width,
        height: file.height,
        durationMs: file.durationMs ?? source.durationMs,
        modelId: null,
        credit: source.credit,
        bytes: file.bytes,
      });

      console.log(`ok  ${(file.bytes / 1024).toFixed(0)}kB  ${file.width}x${file.height}`);
    } catch (error) {
      console.log(`SKIPPED (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  await writeModule(entries, "pexels");
  await seedEffectPreviews();
  report(entries);
}

/**
 * Effect previews.
 *
 * The effect rail is the first thing on the landing page after the hero, and
 * it was showing the same gradient plate eight times. These are the clips that
 * sell each effect — deliberately NOT `EffectDefinition.exampleUrl`, which the
 * mock provider returns as a job result and which therefore has to stay media
 * we made ourselves. See PEXELS_EFFECT_PICKS.
 */
async function seedEffectPreviews() {
  const { resolvePexels, PEXELS_EFFECT_PICKS } = await import("./pexels");

  const dir = join(OUT_DIR, "effects");
  await mkdir(dir, { recursive: true });

  console.log(`\nEffect previews (${Object.keys(PEXELS_EFFECT_PICKS).length}):`);

  const previews: Record<
    string,
    { url: string; posterUrl: string; credit: { author: string; url: string } }
  > = {};

  for (const slug of Object.keys(PEXELS_EFFECT_PICKS)) {
    process.stdout.write(`  ${slug.padEnd(18)} `);
    try {
      const source = await resolvePexels(slug, "video", PEXELS_EFFECT_PICKS);

      const raw = join(dir, `.${slug}.src`);
      await writeFile(raw, await fetchBytes(source.downloadUrl));
      const clip = join(dir, `${slug}.mp4`);
      await encodeVideo(raw, clip);
      await encodePoster(clip, join(dir, `${slug}-poster.jpg`));
      await rm(raw, { force: true });

      previews[slug] = {
        url: `/seed/effects/${slug}.mp4`,
        posterUrl: `/seed/effects/${slug}-poster.jpg`,
        credit: source.credit,
      };

      const { size } = await stat(clip);
      console.log(`ok  ${(size / 1024).toFixed(0)}kB`);
    } catch (error) {
      console.log(`SKIPPED (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  // A run where every fetch failed — a rate limit, a dropped connection —
  // must not overwrite a good module with an empty one. That happened once
  // during development and the failure was silent: the build succeeded and
  // every card quietly fell back to the old placeholder.
  if (Object.keys(previews).length === 0) {
    console.log("  no previews resolved; keeping the existing module");
    return;
  }

  const path = join(process.cwd(), "src", "lib", "effect-previews.ts");
  await writeFile(
    path,
    `/**
 * Effect preview clips — generated, do not edit by hand.
 *
 * Written by \`scripts/seed-demo.ts\` on ${new Date().toISOString().slice(0, 10)}.
 *
 * These illustrate the effect cards and the runner's reference tile. They are
 * licensed footage, not model output, and every surface that shows one credits
 * it. The effect's own \`exampleUrl\` is a separate asset and stays ours,
 * because the mock provider returns it as a generated result.
 */

export type EffectPreview = {
  url: string;
  posterUrl: string;
  credit: { author: string; url: string };
};

export const EFFECT_PREVIEWS: Record<string, EffectPreview> = ${JSON.stringify(previews, null, 2)};

export function effectPreview(slug: string): EffectPreview | null {
  return EFFECT_PREVIEWS[slug] ?? null;
}
`,
  );
}

function report(entries: SeedEntry[]) {
  const total = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  console.log(
    `\nWrote ${entries.length}/${RECIPES.length} entries to src/lib/seed.ts (${(total / 1024 / 1024).toFixed(2)}MB in public/seed/).`,
  );
}

type SeedEntry = {
  slug: string;
  prompt: string;
  kind: "image" | "video";
  aspect: Recipe["aspect"];
  url: string;
  /** First frame of a clip, as a still. Null for images, which are their own. */
  posterUrl: string | null;
  width?: number;
  height?: number;
  durationMs: number | null;
  /** Null when the media did not come from a model. */
  modelId: string | null;
  credit: { author: string; url: string } | null;
  bytes: number;
};

/** Fetch (or read) the source and transcode it into public/seed/. */
async function materialise(recipe: Recipe, url: string) {
  const source = join(OUT_DIR, `.${recipe.slug}.src`);
  await writeFile(source, await fetchBytes(url));

  const name = recipe.kind === "image" ? `${recipe.slug}.webp` : `${recipe.slug}.mp4`;
  const target = join(OUT_DIR, name);

  let posterName: string | null = null;
  let durationMs: number | null = null;

  if (recipe.kind === "image") {
    await encodeWebp(source, target);
  } else {
    await encodeVideo(source, target);
    posterName = `${recipe.slug}-poster.jpg`;
    await encodePoster(target, join(OUT_DIR, posterName));
    durationMs = await probeDurationMs(target);
  }

  await rm(source, { force: true });
  const { size } = await stat(target);
  const { width, height } = await probe(target);

  // The poster ships to every visitor alongside the clip, so it counts.
  const posterBytes = posterName ? (await stat(join(OUT_DIR, posterName))).size : 0;

  return { name, posterName, bytes: size + posterBytes, width, height, durationMs };
}

/**
 * The poster frame.
 *
 * Taken a beat in rather than at t=0: the first frame of a stock clip is often
 * mid-fade or still settling, and a black poster is worse than none. Scaled to
 * the clip's own dimensions so it swaps to video without a visible resize.
 */
async function encodePoster(clip: string, target: string) {
  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    "0.5",
    "-i",
    clip,
    "-frames:v",
    "1",
    "-q:v",
    String(POSTER_QUALITY),
    target,
  ]);
}

/**
 * The mock provider serves SVG, which ffmpeg cannot decode; a real provider
 * returns PNG or JPEG and never takes this path. Rasterising here keeps one
 * pipeline for both instead of a separate mock-only branch.
 */
async function isSvg(file: string): Promise<boolean> {
  const head = (await readFile(file)).subarray(0, 400).toString("utf8").trimStart();
  return head.startsWith("<svg") || head.startsWith("<?xml");
}

async function rasterise(source: string): Promise<string> {
  const png = `${source}.raster.png`;
  await run("rsvg-convert", ["-w", "1280", "-f", "png", "-o", png, source]);
  return png;
}

/**
 * webp at quality 86 is visually clean and a fraction of a jpeg here.
 *
 * Homebrew's ffmpeg ships without a webp encoder, so the reliable path is
 * ffmpeg for the decode and resize, then cwebp for the encode. If neither is
 * available the seed falls back to jpeg rather than skipping the image — a
 * slightly larger tile beats an empty grid.
 */
async function encodeWebp(source: string, target: string) {
  const resized = `${source}.png`;
  const raster = (await isSvg(source)) ? await rasterise(source) : source;

  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    raster,
    "-vf",
    `scale='min(${MAX_IMAGE_WIDTH},iw)':-2`,
    resized,
  ]);
  if (raster !== source) await rm(raster, { force: true });

  try {
    await run("cwebp", ["-quiet", "-q", String(WEBP_QUALITY), resized, "-o", target]);
  } catch {
    try {
      await run("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        resized,
        "-c:v",
        "libwebp",
        "-quality",
        String(WEBP_QUALITY),
        target,
      ]);
    } catch {
      console.warn("    no webp encoder; falling back to jpeg");
      await run("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        resized,
        "-q:v",
        "4",
        target.replace(/\.webp$/, ".jpg"),
      ]);
    }
  } finally {
    await rm(resized, { force: true });
  }
}

/**
 * Clips are capped at eight seconds and 4MB. CRF 23 gets there for most of
 * this material; if a busier shot does not, the bitrate is pinned on a second
 * pass rather than shipping a landing page that costs someone 20MB.
 *
 * The cap applies to the clip alone; the poster is counted separately in the
 * totals, because both ship together and page weight is what actually matters.
 *
 * The ceiling is on the SHORT edge, not the width. Capping width alone left a
 * 1080x1920 portrait clip at its full 1920 height — the vertical seeds were
 * the largest files here while the landscape ones were being downscaled.
 */
async function encodeVideo(source: string, target: string) {
  const common = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    source,
    "-t",
    String(MAX_VIDEO_SECONDS),
    "-an",
    "-movflags",
    "+faststart",
    "-pix_fmt",
    "yuv420p",
    "-vf",
    `scale='if(gt(iw,ih),-2,min(${MAX_VIDEO_SHORT_EDGE},iw))':'if(gt(iw,ih),min(${MAX_VIDEO_SHORT_EDGE},ih),-2)'`,
  ];

  await run("ffmpeg", [
    ...common,
    "-c:v",
    "libx264",
    "-crf",
    String(VIDEO_CRF),
    "-preset",
    "slow",
    target,
  ]);

  const { size } = await stat(target);
  if (size <= MAX_VIDEO_BYTES) return;

  const bitrate = Math.floor((MAX_VIDEO_BYTES * 8) / MAX_VIDEO_SECONDS / 1000) - 64;
  await run("ffmpeg", [
    ...common,
    "-c:v",
    "libx264",
    "-b:v",
    `${bitrate}k`,
    "-maxrate",
    `${bitrate}k`,
    "-bufsize",
    `${bitrate * 2}k`,
    "-preset",
    "slow",
    target,
  ]);
}

async function probe(file: string) {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "csv=p=0",
    file,
  ]);
  const [width, height] = stdout.trim().split(",").map(Number);
  return { width, height };
}

/**
 * The clip's real length after the transcode, which is what the UI must show.
 * The source may have been longer than MAX_VIDEO_SECONDS, and a badge claiming
 * 15s over a file that runs 8 is the seed lying about what it shipped.
 */
async function probeDurationMs(file: string): Promise<number | null> {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    file,
  ]);
  const seconds = Number(stdout.trim());
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
}

/** Provider output is a URL; the mock's is a path on this very app. */
async function fetchBytes(url: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(url)) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`download failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  const base = process.env.SEED_BASE_URL;
  if (base) {
    const response = await fetch(new URL(url, base));
    if (!response.ok) throw new Error(`download failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  // No running app: fall back to the file the mock would have served.
  const local = join(process.cwd(), "public", url.replace(/^\//, ""));
  return readFile(local);
}

async function writeModule(entries: SeedEntry[], source: string) {
  // Same reasoning as the preview guard: a wholly failed run leaves the last
  // good seed set in place rather than blanking Explore.
  if (entries.length === 0) {
    console.log("\nNo entries resolved; keeping the existing seed module.");
    return;
  }

  const isStock = source === "pexels";

  const body = `/**
 * The demo seed set — generated, do not edit by hand.
 *
 * Written by \`scripts/seed-demo.ts\` on ${new Date().toISOString().slice(0, 10)} from the
 * \`${source}\` source. Explore falls back to these when there is not enough
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
  /** First frame of a clip, for the \`poster\` attribute. Null for images. */
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
export const SEED_SOURCE = ${JSON.stringify(source)} as "mock" | "fal" | "pexels";

/** True when these came from a real model rather than the mock placeholders. */
export const SEED_IS_REAL = ${source === "fal"};

/**
 * True when the set is licensed footage rather than model output. Surfaces
 * that show it must not imply a model made it.
 */
export const SEED_IS_STOCK = ${isStock};

export const SEED_ASSETS: SeedAsset[] = ${JSON.stringify(
    entries.map(({ bytes: _bytes, ...rest }) => rest),
    null,
    2,
  )};
`;

  await writeFile(MODULE_PATH, body);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
