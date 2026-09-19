import { z } from "zod";

import { getModel, parseAndPrice, type AnyModel } from "@/lib/models";

/**
 * Effects — the one-click presets.
 *
 * These are the source of truth in code; `pnpm db:seed` upserts them into the
 * `presets` table (kind='effect'), which is what the app reads at runtime. Code
 * keeps them reviewable in a diff; the table keeps them editable without a
 * deploy, and lets a job point at a preset that has since been reworded.
 *
 * Every effect is the same shape: one required photo, one optional line of
 * extra direction, a fixed model and fixed params. That is the whole point —
 * the user makes one decision, not eight.
 *
 * The prompts are ours. They describe camera work and physics in plain terms
 * rather than naming any studio, film or artist.
 */

/** A slot the user must fill before the effect can run. */
export type InputSlot = {
  name: string;
  label: string;
  type: "image";
  required: boolean;
  help?: string;
};

export type EffectCategory = "camera" | "motion" | "transform" | "scale" | "product";

export type EffectDefinition = {
  slug: string;
  title: string;
  description: string;
  category: EffectCategory;
  modelId: string;
  /** `{{subject}}` and `{{extra}}` are filled in at submit time. */
  promptTemplate: string;
  /** Model params. `vars` is reserved for prompt placeholders, not the model. */
  defaultParams: Record<string, unknown> & { vars: Record<string, string> };
  inputSlots: InputSlot[];
  exampleUrl: string;
  sort: number;
};

const PHOTO_SLOT: InputSlot = {
  name: "image_url",
  label: "Your photo",
  type: "image",
  required: true,
  help: "One clear photo. It becomes the first frame of the clip.",
};

/** 6s at 1080p on the image-to-video model. Priced by the registry, not here. */
const CLIP: Record<string, unknown> = { duration: 6, resolution: "1080p" };

export const EFFECTS: EffectDefinition[] = [
  {
    slug: "levitation",
    title: "Levitation",
    description: "The subject lifts off the ground, clothes and dust drifting upward.",
    category: "motion",
    modelId: "ltx-i2v",
    promptTemplate:
      "{{subject}} slowly rises a metre off the ground and hangs there, weightless. Clothing and hair drift upward, loose dust and grit lift off the floor and float. The camera stays locked off on a tripod; only the subject moves. Soft overhead key light, gentle shadow separating from the feet. {{extra}}",
    defaultParams: { ...CLIP, aspect_ratio: "9:16", vars: { subject: "The person in the photo" } },
    inputSlots: [PHOTO_SLOT],
    exampleUrl: "/mock/effects/levitation.mp4",
    sort: 10,
  },
  {
    slug: "liquid-melt",
    title: "Liquid Melt",
    description: "Everything softens and runs like warm wax, then keeps its shape.",
    category: "transform",
    modelId: "ltx-i2v",
    promptTemplate:
      "{{subject}} softens and begins to run like warm wax, edges sagging and stretching downward in slow viscous ribbons that catch the light. The form stays recognisable as it melts. Locked-off camera, shallow depth of field, wet specular highlights. {{extra}}",
    defaultParams: { ...CLIP, aspect_ratio: "auto", vars: { subject: "The subject in the photo" } },
    inputSlots: [PHOTO_SLOT],
    exampleUrl: "/mock/effects/liquid-melt.mp4",
    sort: 20,
  },
  {
    slug: "colossus",
    title: "Giant in the City",
    description: "The subject towers over a skyline as the camera pulls back to reveal the scale.",
    category: "scale",
    modelId: "ltx-i2v",
    promptTemplate:
      "{{subject}}, scaled to the height of a skyscraper, standing among city towers at golden hour. The camera pulls back and tilts up to reveal the full scale, traffic and pedestrians tiny at street level, long shadow thrown across the blocks below. Hazy long-lens compression, birds crossing the frame. {{extra}}",
    defaultParams: { ...CLIP, aspect_ratio: "16:9", vars: { subject: "The person in the photo" } },
    inputSlots: [PHOTO_SLOT],
    exampleUrl: "/mock/effects/colossus.mp4",
    sort: 30,
  },
  {
    slug: "bullet-orbit",
    title: "Bullet Orbit",
    description: "Time stops and the camera arcs a full turn around the frozen moment.",
    category: "camera",
    modelId: "ltx-i2v",
    promptTemplate:
      "Time freezes on {{subject}}. The camera arcs smoothly around them in a wide orbit while everything else holds perfectly still — suspended debris, motionless dust, a held breath. Cold rim light rakes across as the angle changes, background falling into soft focus. {{extra}}",
    defaultParams: { ...CLIP, aspect_ratio: "16:9", vars: { subject: "the person in the photo" } },
    inputSlots: [PHOTO_SLOT],
    exampleUrl: "/mock/effects/bullet-orbit.mp4",
    sort: 40,
  },
  {
    slug: "paper-cutout",
    title: "Paper Cutout",
    description: "The scene becomes layered paper, moving in flat planes with visible fibre.",
    category: "transform",
    modelId: "ltx-i2v",
    promptTemplate:
      "{{subject}} becomes a layered paper cutout — flat planes of matte coloured card with torn fibrous edges and visible grain, separated by a few millimetres of depth. The layers slide and parallax against each other as the light moves across them, casting small hard shadows onto the sheets behind. {{extra}}",
    defaultParams: { ...CLIP, aspect_ratio: "auto", vars: { subject: "The subject in the photo" } },
    inputSlots: [PHOTO_SLOT],
    exampleUrl: "/mock/effects/paper-cutout.mp4",
    sort: 50,
  },
  {
    slug: "portal-step",
    title: "Portal Step",
    description: "A ring of light opens and the camera travels straight through it.",
    category: "motion",
    modelId: "ltx-i2v",
    promptTemplate:
      "A ring of light tears open in the air in front of {{subject}}, its edge burning and rippling. The camera pushes forward and passes straight through the opening into a different place on the other side, light wrapping around the frame at the moment of transit. Continuous single take, no cut. {{extra}}",
    defaultParams: { ...CLIP, aspect_ratio: "auto", vars: { subject: "the subject in the photo" } },
    inputSlots: [PHOTO_SLOT],
    exampleUrl: "/mock/effects/portal-step.mp4",
    sort: 60,
  },
  {
    slug: "hero-spin",
    title: "Product Hero Spin",
    description: "A slow turntable on black, studio lit, built for a product shot.",
    category: "product",
    modelId: "ltx-i2v",
    promptTemplate:
      "{{subject}} on a slow turntable against seamless black, rotating a quarter turn. Studio lighting: a large soft key from the left, a hard rim from behind picking out the top edge, a subtle gradient falloff on the floor. Clean specular roll across the surface as it turns. Nothing else in frame. {{extra}}",
    defaultParams: { ...CLIP, aspect_ratio: "16:9", vars: { subject: "The product in the photo" } },
    inputSlots: [PHOTO_SLOT],
    exampleUrl: "/mock/effects/hero-spin.mp4",
    sort: 70,
  },
  {
    slug: "vertigo",
    title: "Vertigo Dolly",
    description:
      "The camera tracks in while the lens zooms out — the background warps, the subject does not.",
    category: "camera",
    modelId: "ltx-i2v",
    promptTemplate:
      "The camera tracks steadily towards {{subject}} while the lens zooms out by the same amount. The subject stays exactly the same size in frame as the background stretches and rushes away behind them, perspective distorting. Smooth, unbroken move, slight unease. {{extra}}",
    defaultParams: { ...CLIP, aspect_ratio: "auto", vars: { subject: "the person in the photo" } },
    inputSlots: [PHOTO_SLOT],
    exampleUrl: "/mock/effects/vertigo.mp4",
    sort: 80,
  },
];

export const EFFECT_CATEGORIES: { id: EffectCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "camera", label: "Camera" },
  { id: "motion", label: "Motion" },
  { id: "transform", label: "Transform" },
  { id: "scale", label: "Scale" },
  { id: "product", label: "Product" },
];

/* ----------------------------------------------------------- compilation */

/**
 * Fills `{{name}}` placeholders and tidies what is left.
 *
 * An empty `{{extra}}` must not leave a dangling space or a stray full stop,
 * because the compiled string is shown to the user in "How this was made".
 */
export function compilePrompt(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name: string) => (vars[name] ?? "").trim())
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

/** What the client is allowed to send for an effect. Nothing else is read. */
export const effectRequestSchema = z.object({
  presetSlug: z.string().min(1),
  // The message has to cover a missing value too, not just a malformed one —
  // an effect with no photo is the likeliest bad request there is.
  imageUrl: z.string("Add a photo first.").url("That photo link is not a valid URL."),
  extra: z.string().trim().max(400, "Keep the extra direction short.").optional(),
});

export type EffectRequest = z.infer<typeof effectRequestSchema>;

/** The fields of a preset row this module needs. Keeps DB and code in step. */
export type PresetLike = {
  slug: string;
  title: string;
  modelId: string;
  promptTemplate: string;
  defaultParams: unknown;
  inputSlots: unknown;
};

export class EffectError extends Error {}

/** The model params a preset carries, with the prompt placeholders split off. */
function splitParams(preset: PresetLike): {
  params: Record<string, unknown>;
  vars: Record<string, string>;
} {
  const stored = (preset.defaultParams ?? {}) as Record<string, unknown>;
  const params: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(stored)) {
    if (key !== "vars") params[key] = value;
  }
  return { params, vars: (stored.vars ?? {}) as Record<string, string> };
}

/**
 * Turns a preset plus the user's photo into a priced, validated model call.
 *
 * The client sends a slug, a photo and one optional line. Everything else —
 * model, params, prompt, cost — comes from the preset row and the registry, so
 * there is nothing here a client could tamper with to get a cheaper render.
 */
export function resolveEffectInput(
  preset: PresetLike,
  request: EffectRequest,
): { model: AnyModel; params: Record<string, unknown>; credits: number; compiledPrompt: string } {
  const model = getModel(preset.modelId);
  if (!model)
    throw new EffectError(`Preset ${preset.slug} points at a model that no longer exists.`);

  const slots = (Array.isArray(preset.inputSlots) ? preset.inputSlots : []) as InputSlot[];
  const photoSlot = slots.find((slot) => slot.required);
  if (!photoSlot) throw new EffectError(`Preset ${preset.slug} has no photo slot.`);

  const { params: defaults, vars } = splitParams(preset);

  const compiledPrompt = compilePrompt(preset.promptTemplate, {
    ...vars,
    extra: request.extra ?? "",
  });

  const { params, credits } = parseAndPrice(model, {
    ...defaults,
    [photoSlot.name]: request.imageUrl,
    prompt: compiledPrompt,
  });

  return { model, params, credits, compiledPrompt };
}

/** Advertised price for a preset, computed from the registry — never stored by hand. */
export function priceEffect(preset: PresetLike): number {
  const model = getModel(preset.modelId);
  if (!model) return 0;
  const { params: defaults } = splitParams(preset);
  const { credits } = parseAndPrice(model, {
    ...defaults,
    image_url: "https://example.invalid/price-probe.png",
    prompt: "pricing probe",
  });
  return credits;
}
