import { z } from "zod";

/**
 * The model registry.
 *
 * One entry per thing a user can run. Everything the rest of the app needs —
 * validation, pricing, what the form looks like, what the provider is called —
 * lives here, so adding a model is a single edit.
 *
 * Pricing checked against fal's model pages on 2026-09-20:
 *   fal-ai/flux/schnell     $0.003 per megapixel (billed rounded up to the MP)
 *   fal-ai/flux-pro/kontext $0.04  per image
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
  /** What the provider calls it. */
  providerModelId: string;
  schema: TSchema;
  fields: FieldSpec[];
  capabilities: ModelCapabilities;
  /** Credits for one run of these params. Always computed server-side. */
  credits: (params: z.infer<TSchema>) => number;
  /** Human note about real provider cost, shown in dev tooling. */
  costNote: string;
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

const kontextParams = z.object({
  prompt: promptSchema,
  image_url: z.string().url("Pick a reference image first."),
  guidance_scale: z.coerce.number().min(1).max(20).default(3.5),
  num_images: z.coerce.number().int().min(1).max(2).default(1),
  seed: seedSchema,
});

const sizeOptions = Object.entries(IMAGE_SIZES).map(([value, size]) => ({
  value,
  label: `${size.label} · ${size.width}×${size.height}`,
}));

/* -------------------------------------------------------------- registry */

export const MODELS = {
  "flux-schnell": {
    id: "flux-schnell",
    label: "Kinora Still Fast",
    blurb: "Four-step render. Quick drafts, cheap iterations.",
    kind: "image",
    providerModelId: "fal-ai/flux/schnell",
    schema: schnellParams,
    capabilities: { referenceImages: false, startEndFrames: false },
    // $0.003/MP, billed rounded up — a 1024² still is 2MP to fal. One credit
    // per billed megapixel keeps a standard still at ~2 credits.
    credits: (params) => megapixels(params.image_size) * params.num_images,
    costNote: "fal-ai/flux/schnell — $0.003 per megapixel (2026-09-20)",
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
} as const;

export type ModelId = keyof typeof MODELS;

export type AnyModel = (typeof MODELS)[ModelId];

export function getModel(id: string): AnyModel | undefined {
  return (MODELS as Record<string, AnyModel>)[id];
}

export function modelsByKind(kind: "image" | "video"): AnyModel[] {
  return Object.values(MODELS).filter((model) => model.kind === kind);
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
