/**
 * Renders the demo seed set, once.
 *
 * Explore is a community feed, and a community feed with nothing in it reads as
 * broken rather than new. This renders ~20 curated prompts through whatever
 * provider is configured, downloads the results into `public/seed/`, transcodes
 * them to something a landing page can afford, and writes `src/lib/seed.ts`.
 *
 *   PROVIDER=mock pnpm seed:demo     # free, Kinora's own sample media
 *   PROVIDER=fal  pnpm seed:demo     # real renders, real money, run once
 *
 * The output is committed, so the deployed site never depends on this having
 * run. Re-running with PROVIDER=fal replaces the placeholders in place.
 *
 * Budget: images become webp, clips are capped at 6 seconds and 3MB. ffmpeg
 * must be on PATH.
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
const MAX_VIDEO_BYTES = 3 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 6;
const POLL_MS = 2_000;
const GIVE_UP_MS = 5 * 60 * 1000;

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
  const { getProvider, providerFor, providerMode } = await import("@/lib/providers");
  const { getModel } = await import("@/lib/models");

  const name = providerMode();

  console.log(`\nSeeding ${RECIPES.length} prompts through the ${name} provider.`);
  if (name === "live") {
    console.log("This spends real money. Ctrl-C now if that was not the intention.\n");
    await new Promise((done) => setTimeout(done, 4000));
  }

  await mkdir(OUT_DIR, { recursive: true });

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
        width: asset.width ?? file.width,
        height: asset.height ?? file.height,
        durationMs: asset.durationMs ?? null,
        modelId,
        bytes: file.bytes,
      });

      console.log(`ok  ${(file.bytes / 1024).toFixed(0)}kB  ${file.name}`);
    } catch (error) {
      console.log(`SKIPPED (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  await writeModule(entries, name);
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
  width?: number;
  height?: number;
  durationMs: number | null;
  modelId: string;
  bytes: number;
};

/** Fetch (or read) the provider's output and transcode it into public/seed/. */
async function materialise(recipe: Recipe, url: string) {
  const source = join(OUT_DIR, `.${recipe.slug}.src`);
  await writeFile(source, await fetchBytes(url));

  const name = recipe.kind === "image" ? `${recipe.slug}.webp` : `${recipe.slug}.mp4`;
  const target = join(OUT_DIR, name);

  if (recipe.kind === "image") {
    await encodeWebp(source, target);
  } else {
    await encodeVideo(source, target);
  }

  await rm(source, { force: true });
  const { size } = await stat(target);
  const { width, height } = await probe(target);
  return { name, bytes: size, width, height };
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
 * webp at quality 82 is visually clean and a fraction of a jpeg here.
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
    "scale='min(1280,iw)':-2",
    resized,
  ]);
  if (raster !== source) await rm(raster, { force: true });

  try {
    await run("cwebp", ["-quiet", "-q", "82", resized, "-o", target]);
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
        "82",
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
 * Clips are capped at six seconds and 3MB. CRF 30 gets there for everything
 * here; if a busier shot does not, the bitrate is pinned on a second pass
 * rather than shipping a landing page that costs someone 8MB.
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
    "scale='min(1280,iw)':-2",
  ];

  await run("ffmpeg", [...common, "-c:v", "libx264", "-crf", "30", "-preset", "slow", target]);

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

async function writeModule(entries: SeedEntry[], provider: string) {
  const body = `/**
 * The demo seed set — generated, do not edit by hand.
 *
 * Written by \`scripts/seed-demo.ts\` on ${new Date().toISOString().slice(0, 10)} using the
 * \`${provider}\` provider. Explore falls back to these when there is not enough
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
export const SEED_IS_REAL = ${provider === "fal"};

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
