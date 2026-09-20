/**
 * Pexels as a seed source.
 *
 * Explore is a showcase, and a showcase made of procedurally drawn gradients
 * reads as broken the moment anyone opens a preview. Until there is budget to
 * render the whole seed set through fal, the landing surfaces borrow real
 * footage from Pexels — whose licence permits commercial use without
 * attribution, though we credit anyway (see `credit` below).
 *
 * The picks are PINNED BY ID, not re-searched. A search re-run would quietly
 * reshuffle the landing page on every seed, and "whatever Pexels ranked first
 * today" is not a design decision. The ids below were curated once, by eye,
 * from six candidates per slot.
 *
 * This is showcase media only. Generated job results still come from the
 * configured provider (mock or fal) — nothing here ever pretends a model made
 * it. See `SEED_SOURCE` in src/lib/seed.ts, which records the provenance the
 * UI uses to label the feed honestly.
 */

const API = "https://api.pexels.com";

/**
 * Pexels rejects the default Node/undici agent string with a 403, which
 * surfaces as an unexplained auth failure. Send a real one.
 */
const UA = "Kinora-seed/1.0";

/** slug → Pexels id. Curated by hand; see the module comment. */
export const PEXELS_PICKS: Record<string, number> = {
  // stills
  "rain-platform": 17269843,
  "brutalist-dusk": 14780198,
  "practical-lamp": 33219320,
  "desert-vanish": 10999980,
  "studio-glass": 34686418,
  "pigment-macro": 37011499,
  underpass: 13085571,
  greenhouse: 9782978,
  "market-lanterns": 34222041,
  "cliff-fog": 4581101,
  "workshop-hands": 36398006,
  "neon-diner": 12161836,
  // clips
  "alley-dolly": 855432,
  "monolith-orbit": 28044002,
  "pines-push": 29792651,
  "curtain-window": 10531277,
  "helmet-zoom": 7664955,
  "crane-rooftops": 17088577,
  "tide-lockoff": 38345042,
  "corridor-track": 7608928,
};

/**
 * slug → Pexels id for the effect PREVIEWS, which are a different thing from
 * the effect examples.
 *
 * `EffectDefinition.exampleUrl` is what the mock provider hands back as a job
 * result, so it must stay media we made — otherwise a mock run would present
 * stock footage as the user's own render. These previews only ever illustrate
 * the card and the runner's reference tile, both of which credit the source.
 */
export const PEXELS_EFFECT_PICKS: Record<string, number> = {
  levitation: 31921087,
  "liquid-melt": 4006561,
  colossus: 5941931,
  "bullet-orbit": 36277763,
  "paper-cutout": 7868555,
  "portal-step": 7523663,
  "hero-spin": 6276699,
  vertigo: 2759485,
};

export type PexelsCredit = {
  /** The photographer or videographer, as Pexels names them. */
  author: string;
  /** The asset's page on pexels.com, so the credit can link somewhere real. */
  url: string;
};

export type PexelsSource = {
  /** Highest-fidelity original we are allowed to download. */
  downloadUrl: string;
  width: number;
  height: number;
  durationMs: number | null;
  credit: PexelsCredit;
};

function key(): string {
  const value = process.env.PEXELS_API_KEY;
  if (!value) {
    throw new Error("PEXELS_API_KEY is not set — add it to .env.local (free at pexels.com/api)");
  }
  return value;
}

async function api<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: key(), "User-Agent": UA },
  });
  if (!response.ok) {
    throw new Error(`pexels ${path} → ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

type PhotoResponse = {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  src: { original: string };
};

type VideoFile = {
  link: string;
  width: number | null;
  height: number | null;
  quality: string | null;
  file_type: string;
};

type VideoResponse = {
  id: number;
  width: number;
  height: number;
  duration: number;
  url: string;
  user: { name: string };
  video_files: VideoFile[];
};

/**
 * Pexels returns several renditions per clip, unsorted, and some of them are
 * the 360p preview. Take the tallest mp4 — downscaling to our own ceiling in
 * ffmpeg beats upscaling a small rendition, and the transcode caps the size.
 */
function bestVideoFile(files: VideoFile[]): VideoFile {
  const mp4s = files.filter((file) => file.file_type === "video/mp4");
  const pool = mp4s.length > 0 ? mp4s : files;
  return pool.reduce((best, file) => ((file.height ?? 0) > (best.height ?? 0) ? file : best));
}

export async function resolvePexels(
  slug: string,
  kind: "image" | "video",
  picks: Record<string, number> = PEXELS_PICKS,
): Promise<PexelsSource> {
  const id = picks[slug];
  if (!id) throw new Error(`no pinned Pexels id for "${slug}"`);

  if (kind === "image") {
    const photo = await api<PhotoResponse>(`/v1/photos/${id}`);
    return {
      downloadUrl: photo.src.original,
      width: photo.width,
      height: photo.height,
      durationMs: null,
      credit: { author: photo.photographer, url: photo.url },
    };
  }

  const video = await api<VideoResponse>(`/videos/videos/${id}`);
  const file = bestVideoFile(video.video_files);
  return {
    downloadUrl: file.link,
    width: file.width ?? video.width,
    height: file.height ?? video.height,
    durationMs: video.duration * 1000,
    credit: { author: video.user.name, url: video.url },
  };
}
