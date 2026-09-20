import { z } from "zod";

/**
 * The model registry.
 *
 * One entry per thing a user can run. Everything the rest of the app needs —
 * validation, pricing, what the form looks like, what the provider is called —
 * lives here, so adding a model is a single edit.
 *
 * Pricing checked against fal's model pages on 2026-09-20:
 *   fal-ai/flux/schnell                  $0.003 per megapixel (rounded up)
 *   fal-ai/flux-pro/kontext              $0.04  per image
 *   fal-ai/nano-banana/edit              $0.039 per image (takes several refs)
 *   fal-ai/ltx-2.3/image-to-video/fast   $0.04/s at 1080p, $0.08 at 1440p, $0.16 at 2160p
 *   fal-ai/ltx-2.3/text-to-video/fast    same rates
 *
 * On video the scale stops being a straight conversion: a 6s 1080p clip really
 * costs ~$0.24, which at the image rate would be ~80 credits. The brief anchors
 * video at ~20, so the demo subsidises it and the proportionality is kept
 * *within* video — twice the seconds or twice the resolution costs twice.
 *
 * Credits are deliberately not a currency conversion — they are a coarse,
 * user-legible scale where a standard still is ~2 and a video is ~20, while
 * the ratio between models still tracks what each one actually costs us.
 */

/* ------------------------------------------------------------------ sizes */

export const IMAGE_SIZES = {
  square: { label: "Square", width: 512, height: 512 },
  square_hd: { label: "Square HD", width: 1024, height: 1024 },
  portrait_4_3: { label: "Portrait 4:5", width: 768, height: 1024 },
  portrait_16_9: { label: "Portrait 9:16", width: 576, height: 1024 },
  landscape_4_3: { label: "Landscape 4:3", width: 1024, height: 768 },
  landscape_16_9: { label: "Landscape 16:9", width: 1024, height: 576 },
} as const;

export type ImageSizeId = keyof typeof IMAGE_SIZES;

export const imageSizeSchema = z.enum(Object.keys(IMAGE_SIZES) as [ImageSizeId, ...ImageSizeId[]]);

/** fal bills per megapixel, rounded up. Mirror that so credits track cost. */
function megapixels(size: ImageSizeId): number {
  const { width, height } = IMAGE_SIZES[size];
  return Math.ceil((width * height) / 1_000_000);
}

/* ------------------------------------------------------------ definitions */

/** A form control, derived from the same registry entry as the zod schema. */
export type FieldSpec =
  | {
      name: string;
      label: string;
      type: "select";
      options: { value: string; label: string }[];
      help?: string;
    }
  | {
      name: string;
      label: string;
      type: "number";
      min: number;
      max: number;
      step?: number;
      help?: string;
    }
  | { name: string; label: string; type: "image"; help?: string }
  | { name: string; label: string; type: "seed"; help?: string };

export type ModelCapabilities = {
  /** Takes more than one reference image at a time. */
  multiReference?: boolean;
  /** Takes a reference image as input. */
  referenceImages: boolean;
  /** Takes explicit first/last frames (video models). */
  startEndFrames: boolean;
};

export type ModelDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  id: string;
  label: string;
  blurb: string;
  kind: "image" | "video";
  /** What the provider named in `provider` calls it. */
  providerModelId: string;
  /**
   * Who runs it when PROVIDER is live. Defaults to fal. Cloudflare is free
   * within a daily allowance but only does plain text-to-image.
   */
  provider?: "fal" | "cloudflare";
  /**
   * What fal calls it, for a model whose primary provider is not fal.
   *
   * `providerFor()` falls back to fal when Cloudflare has no credentials, and
   * that fallback is worthless without this: `providerModelId` then holds a
   * Cloudflare "@cf/..." path, and sending one of those to fal is a 404
   * ("Application black-forest-labs not found") on every single render.
   */
  falModelId?: string;
  schema: TSchema;
  fields: FieldSpec[];
  capabilities: ModelCapabilities;
  /** Credits for one run of these params. Always computed server-side. */
  credits: (params: z.infer<TSchema>) => number;
  /** Human note about real provider cost, shown in dev tooling. */
  costNote: string;
  /**
   * Kept out of the composer's model list. The Studio builds its form from
   * `fields`, which has no control for an array of images — this model is
   * driven by Cinema, which knows how to fill it.
   */
  hidden?: boolean;
};

/* --------------------------------------------------------------- schemas */

const promptSchema = z
  .string()
  .trim()
  .min(3, "Say a little more than that.")
  .max(2000, "That prompt is too long.");

const seedSchema = z.coerce.number().int().min(0).max(2_147_483_647).optional();

const schnellParams = z.object({
  prompt: promptSchema,
  image_size: imageSizeSchema.default("square_hd"),
  num_images: z.coerce.number().int().min(1).max(4).default(1),
  seed: seedSchema,
});

/** How many references a multi-reference model accepts in one call. */
export const MAX_MULTI_REFERENCES = 4;

const nanoBananaParams = z.object({
  prompt: promptSchema,
  image_urls: z
    .array(z.string().url())
    .min(1, "Add at least one reference image.")
    .max(MAX_MULTI_REFERENCES, `${MAX_MULTI_REFERENCES} references is the limit.`),
  aspect_ratio: z.enum(["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"]).default("16:9"),
  num_images: z.coerce.number().int().min(1).max(4).default(1),
  seed: seedSchema,
});

const kontextParams = z.object({
  prompt: promptSchema,
  image_url: z.string().url("Pick a reference image first."),
  guidance_scale: z.coerce.number().min(1).max(20).default(3.5),
  num_images: z.coerce.number().int().min(1).max(2).default(1),
  seed: seedSchema,
});

/* ---------------------------------------------------------------- video */

/** Mirrors fal's own rate card: 1080p, 1440p (2x), 2160p (4x). */
const RESOLUTION_MULTIPLIER = { "1080p": 1, "1440p": 2, "2160p": 4 } as const;

export const VIDEO_RESOLUTIONS = Object.keys(RESOLUTION_MULTIPLIER) as [
  keyof typeof RESOLUTION_MULTIPLIER,
  ...(keyof typeof RESOLUTION_MULTIPLIER)[],
];

/** fal accepts 6..20 in steps of two; anything past 10 needs 25fps at 1080p. */
export const VIDEO_DURATIONS = [6, 8, 10] as const;

const BASE_VIDEO_CREDITS = 20;
const BASE_VIDEO_SECONDS = 6;

function videoCredits(params: {
  duration: number;
  resolution: keyof typeof RESOLUTION_MULTIPLIER;
}) {
  const seconds = params.duration / BASE_VIDEO_SECONDS;
  return Math.round(BASE_VIDEO_CREDITS * seconds * RESOLUTION_MULTIPLIER[params.resolution]);
}

const videoCommon = {
  resolution: z.enum(VIDEO_RESOLUTIONS).default("1080p"),
  duration: z.coerce
    .number()
    .int()
    .refine((value): value is (typeof VIDEO_DURATIONS)[number] =>
      (VIDEO_DURATIONS as readonly number[]).includes(value),
    )
    .default(6),
  // Audio and lipsync are out of scope for this build, so never ask for it.
  generate_audio: z.literal(false).default(false),
};

const t2vParams = z.object({
  prompt: promptSchema,
  aspect_ratio: z.enum(["16:9", "9:16"]).default("16:9"),
  ...videoCommon,
});

const i2vParams = z.object({
  prompt: promptSchema,
  image_url: z.string().url("Pick a start frame first."),
  end_image_url: z.string().url().optional(),
  aspect_ratio: z.enum(["auto", "16:9", "9:16"]).default("auto"),
  ...videoCommon,
});

const durationOptions = VIDEO_DURATIONS.map((value) => ({
  value: String(value),
  label: `${value}s`,
}));

const resolutionOptions = VIDEO_RESOLUTIONS.map((value) => ({
  value,
  label: value === "1080p" ? "1080p" : `${value} ·  ${RESOLUTION_MULTIPLIER[value]}x`,
}));

const sizeOptions = Object.entries(IMAGE_SIZES).map(([value, size]) => ({
  value,
  label: `${size.label} · ${size.width}×${size.height}`,
}));

/* -------------------------------------------------------------- registry */

export const MODELS = {
  "flux-schnell": {
    id: "flux-schnell",
    label: "Kinora Still Fast",
    blurb: "Four-step render. Free, fast, composed square and cropped to frame.",
    kind: "image",
    // Cloudflare Workers AI runs the same model free within a daily allowance.
    // It only makes 1024 squares, so the requested frame is centre-cropped from
    // one — the dimensions are honest, the composition is a square's.
    providerModelId: "@cf/black-forest-labs/flux-1-schnell",
    provider: "cloudflare",
    // The same weights, billed, for when Cloudflare is not configured.
    falModelId: "fal-ai/flux/schnell",
    schema: schnellParams,
    capabilities: { referenceImages: false, startEndFrames: false },
    // $0.003/MP, billed rounded up — a 1024² still is 2MP to fal. One credit
    // per billed megapixel keeps a standard still at ~2 credits.
    credits: (params) => megapixels(params.image_size) * params.num_images,
    costNote:
      "@cf/black-forest-labs/flux-1-schnell on Cloudflare Workers AI — free within 10,000 neurons/day, ~57.6 per image (2026-09-20)",
    fields: [
      { name: "image_size", label: "Frame", type: "select", options: sizeOptions },
      {
        name: "num_images",
        label: "Count",
        type: "select",
        options: [1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) })),
      },
      { name: "seed", label: "Seed", type: "seed", help: "Leave empty for a new roll." },
    ],
  } satisfies ModelDefinition<typeof schnellParams>,

  "flux-kontext": {
    id: "flux-kontext",
    label: "Kinora Still Reference",
    blurb: "Edits and transforms an image you give it, keeping the subject.",
    kind: "image",
    providerModelId: "fal-ai/flux-pro/kontext",
    schema: kontextParams,
    capabilities: { referenceImages: true, startEndFrames: false },
    // $0.04/image against ~$0.006 for a 1024² schnell render: ~6.7x. At 12
    // credits against 2, the scale users see tracks what we actually pay.
    credits: (params) => 12 * params.num_images,
    costNote: "fal-ai/flux-pro/kontext — $0.04 per image (2026-09-20)",
    fields: [
      {
        name: "image_url",
        label: "Reference image",
        type: "image",
        help: "Required. Use any image from Explore or your library.",
      },
      {
        name: "num_images",
        label: "Count",
        type: "select",
        options: [1, 2].map((n) => ({ value: String(n), label: String(n) })),
      },
      {
        name: "guidance_scale",
        label: "Adherence",
        type: "number",
        min: 1,
        max: 20,
        step: 0.5,
        help: "Higher follows the prompt more literally.",
      },
      { name: "seed", label: "Seed", type: "seed", help: "Leave empty for a new roll." },
    ],
  } satisfies ModelDefinition<typeof kontextParams>,
  "nano-banana-edit": {
    id: "nano-banana-edit",
    label: "Kinora Still Multi-Reference",
    blurb: "Holds up to four references at once — the same face, prop or place across every frame.",
    kind: "image",
    providerModelId: "fal-ai/nano-banana/edit",
    schema: nanoBananaParams,
    capabilities: { referenceImages: true, multiReference: true, startEndFrames: false },
    // $0.039/image, within a rounding error of kontext's $0.04, so it sits on
    // the same 12-credit step. What it buys is several references, not a
    // cheaper render.
    credits: (params) => 12 * params.num_images,
    costNote: "fal-ai/nano-banana/edit — $0.039 per image (2026-09-20)",
    hidden: true,
    fields: [],
  } satisfies ModelDefinition<typeof nanoBananaParams>,

  "ltx-i2v": {
    id: "ltx-i2v",
    label: "Kinora Motion",
    blurb: "Animates a still you give it. Add an end frame for a transition.",
    kind: "video",
    providerModelId: "fal-ai/ltx-2.3/image-to-video/fast",
    schema: i2vParams,
    capabilities: { referenceImages: true, startEndFrames: true },
    credits: videoCredits,
    costNote: "fal-ai/ltx-2.3/image-to-video/fast — $0.04/s at 1080p (2026-09-20)",
    fields: [
      {
        name: "image_url",
        label: "Start frame",
        type: "image",
        help: "Required. Animate any render from your library.",
      },
      {
        name: "end_image_url",
        label: "End frame",
        type: "image",
        help: "Optional. Given both, it renders the transition between them.",
      },
      { name: "duration", label: "Duration", type: "select", options: durationOptions },
      { name: "resolution", label: "Resolution", type: "select", options: resolutionOptions },
      {
        name: "aspect_ratio",
        label: "Aspect",
        type: "select",
        options: [
          { value: "auto", label: "Match source" },
          { value: "16:9", label: "16:9" },
          { value: "9:16", label: "9:16" },
        ],
      },
    ],
  } satisfies ModelDefinition<typeof i2vParams>,

  "ltx-t2v": {
    id: "ltx-t2v",
    label: "Kinora Motion Text",
    blurb: "Straight from a prompt. No source image needed.",
    kind: "video",
    providerModelId: "fal-ai/ltx-2.3/text-to-video/fast",
    schema: t2vParams,
    capabilities: { referenceImages: false, startEndFrames: false },
    credits: videoCredits,
    costNote: "fal-ai/ltx-2.3/text-to-video/fast — $0.04/s at 1080p (2026-09-20)",
    fields: [
      { name: "duration", label: "Duration", type: "select", options: durationOptions },
      { name: "resolution", label: "Resolution", type: "select", options: resolutionOptions },
      {
        name: "aspect_ratio",
        label: "Aspect",
        type: "select",
        options: [
          { value: "16:9", label: "16:9" },
          { value: "9:16", label: "9:16" },
        ],
      },
    ],
  } satisfies ModelDefinition<typeof t2vParams>,
} as const;

export type ModelId = keyof typeof MODELS;

export type AnyModel = (typeof MODELS)[ModelId];

export function getModel(id: string): AnyModel | undefined {
  return (MODELS as Record<string, AnyModel>)[id];
}

/** Optional fields are narrowed away by `satisfies`, so read them through this. */
export function modelProvider(model: AnyModel): "fal" | "cloudflare" {
  return "provider" in model && model.provider ? model.provider : "fal";
}

/** Capability flags are optional, so read them through these rather than inline. */
export function takesMultipleReferences(model: AnyModel): boolean {
  return "multiReference" in model.capabilities && model.capabilities.multiReference === true;
}

/** Reachable only by the flow that owns it, never by the composer or an API caller. */
export function isHidden(model: AnyModel): boolean {
  return "hidden" in model && model.hidden === true;
}

/** What the composer offers. */
export function modelsByKind(kind: "image" | "video"): AnyModel[] {
  return Object.values(MODELS).filter((model) => model.kind === kind && !isHidden(model));
}

/** Validate raw client input and price it. Never trust the client's number. */
export function parseAndPrice(
  model: AnyModel,
  raw: unknown,
): { params: Record<string, unknown>; credits: number } {
  const params = model.schema.parse(raw) as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const credits = model.credits(params as any);
  return { params, credits };
}
