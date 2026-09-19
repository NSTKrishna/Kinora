import { z } from "zod";

import catalogue from "@/data/cinema.json";
import { getModel, parseAndPrice, VIDEO_DURATIONS, type AnyModel } from "@/lib/models";

/**
 * The Cinema prompt compiler.
 *
 * Pure and data-driven: every choice a director makes on the panel is a row in
 * `src/data/cinema.json` carrying the prompt fragment it contributes, so adding
 * a lens or a camera move is a data edit and never a code change. Nothing here
 * touches the database, the network or the clock, which is what makes the
 * compiled prompt something you can actually pin down in a test.
 *
 * Camera and lens options describe the *look of a medium* — grain, latitude,
 * flare, bokeh shape — rather than naming a manufacturer's product. Kinora
 * ships its own identity, and in practice a description steers a model at
 * least as well as a brand name does.
 */

/* --------------------------------------------------------------- catalogue */

const optionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  note: z.string().min(1),
  fragment: z.string().min(10),
});

export type CinemaOption = z.infer<typeof optionSchema>;

/** Ids have to be unique inside a group — they are what a saved project stores. */
const groupSchema = z
  .array(optionSchema)
  .min(1)
  .refine((options) => new Set(options.map((o) => o.id)).size === options.length, {
    message: "Duplicate option id in the cinema catalogue",
  });

const catalogueSchema = z.object({
  cameras: groupSchema,
  lenses: groupSchema,
  focalLengths: groupSchema,
  apertures: groupSchema,
  genres: groupSchema,
  lighting: groupSchema,
  motions: groupSchema,
});

/**
 * Parsed once, at import. A malformed catalogue is a mistake in a committed
 * file, not a runtime condition, so it should stop the build rather than
 * quietly compile half a prompt.
 */
export const CINEMA = catalogueSchema.parse(catalogue);

export type CinemaGroup = keyof typeof CINEMA;

export function optionsIn(group: CinemaGroup): CinemaOption[] {
  return CINEMA[group];
}

export function findOption(group: CinemaGroup, id: string): CinemaOption | undefined {
  return CINEMA[group].find((option) => option.id === id);
}

/** A zod enum built from whatever the catalogue actually contains. */
function idIn(group: CinemaGroup) {
  const ids = CINEMA[group].map((option) => option.id);
  return z.enum(ids as [string, ...string[]]);
}

/* ------------------------------------------------------------------ steps */

/** The panel, in order. Mirrors the `cinema_step` enum in the schema. */
export const CINEMA_STEPS = [
  { id: "scene", label: "Scene", hint: "What is in the shot" },
  { id: "rig", label: "Rig", hint: "How it is shot" },
  { id: "frames", label: "Frames", hint: "Four candidates" },
  { id: "motion", label: "Motion", hint: "How the camera moves" },
  { id: "result", label: "Result", hint: "The clip" },
] as const;

export type CinemaStep = (typeof CINEMA_STEPS)[number]["id"];

export function stepRank(step: CinemaStep): number {
  return CINEMA_STEPS.findIndex((entry) => entry.id === step);
}

/**
 * The saved step is a high-water mark, not a cursor.
 *
 * Stepping back to re-read the rig is a view change; it must not throw away
 * the fact that four frames already exist. What a refresh should restore is
 * the furthest point the sequence actually reached.
 */
export function furthestStep(current: CinemaStep, next: CinemaStep): CinemaStep {
  return stepRank(next) > stepRank(current) ? next : current;
}

/* -------------------------------------------------------------------- spec */

/** The model prompt ceiling the registry enforces; we stay inside it. */
const MAX_PROMPT = 2000;

export const MAX_REFERENCES = 4;
/** The Frames step always offers a choice of four. */
export const FRAME_COUNT = 4;

export const rigSchema = z.object({
  camera: idIn("cameras"),
  lens: idIn("lenses"),
  focalLength: idIn("focalLengths"),
  aperture: idIn("apertures"),
  genre: idIn("genres"),
  lighting: idIn("lighting"),
});

export type CinemaRig = z.infer<typeof rigSchema>;

/** Which catalogue group each rig slot draws from, for building the pickers. */
export const RIG_SLOTS: { key: keyof CinemaRig; group: CinemaGroup; label: string }[] = [
  { key: "camera", group: "cameras", label: "Camera" },
  { key: "lens", group: "lenses", label: "Lens" },
  { key: "focalLength", group: "focalLengths", label: "Focal length" },
  { key: "aperture", group: "apertures", label: "Aperture" },
  { key: "genre", group: "genres", label: "Genre / era" },
  { key: "lighting", group: "lighting", label: "Lighting" },
];

/**
 * How much room the rig can take at its most verbose, so the scene cap can be
 * derived rather than guessed. Adding a wordier lens or a seventh rig slot
 * tightens this automatically — the compiled prompt cannot drift past what the
 * model accepts because someone wrote a long fragment.
 */
const WORST_CASE_RIG = RIG_SLOTS.reduce(
  (total, slot) =>
    total + Math.max(...CINEMA[slot.group].map((option) => option.fragment.length + 2)),
  0,
);

export const SCENE_MAX = MAX_PROMPT - WORST_CASE_RIG - 8;

export const sceneSchema = z.object({
  text: z
    .string()
    .trim()
    .min(8, "Describe the shot in a little more detail.")
    .max(SCENE_MAX, "That scene description is too long."),
  referenceUrls: z.array(z.string().url()).max(MAX_REFERENCES).default([]),
});

export const cinemaSpecSchema = z.object({
  scene: sceneSchema,
  rig: rigSchema,
  motion: idIn("motions"),
  duration: z.coerce
    .number()
    .int()
    .refine((value) => (VIDEO_DURATIONS as readonly number[]).includes(value), {
      message: "Unsupported clip length.",
    }),
});

export type CinemaSpec = z.infer<typeof cinemaSpecSchema>;

/**
 * What a saved project holds.
 *
 * Every field has a default and falls back rather than throwing, because the
 * catalogue is data: retiring a lens must leave old sequences readable, with
 * that one slot reset, instead of making the project impossible to open. Use
 * `cinemaSpecSchema` — not this — before spending anything.
 */
function draftIdIn(group: CinemaGroup) {
  return idIn(group).catch(CINEMA[group][0].id);
}

export const draftSpecSchema = z.object({
  scene: z
    .object({
      text: z.string().max(SCENE_MAX).catch(""),
      referenceUrls: z.array(z.string().url()).max(MAX_REFERENCES).catch([]),
    })
    .catch({ text: "", referenceUrls: [] }),
  rig: z
    .object(
      Object.fromEntries(RIG_SLOTS.map((slot) => [slot.key, draftIdIn(slot.group)])) as Record<
        keyof CinemaRig,
        ReturnType<typeof draftIdIn>
      >,
    )
    .catch(() => defaultRig()),
  motion: draftIdIn("motions"),
  duration: z.coerce
    .number()
    .int()
    .refine((value) => (VIDEO_DURATIONS as readonly number[]).includes(value))
    .catch(6),
});

export type CinemaDraft = z.infer<typeof draftSpecSchema>;

/** Reads whatever is in the `spec` column, however old or partial. */
export function readDraft(stored: unknown): CinemaDraft {
  return draftSpecSchema.parse(stored ?? {});
}

/** A draft is runnable once it would survive the strict schema. */
export function toRunnable(draft: CinemaDraft): CinemaSpec | null {
  const parsed = cinemaSpecSchema.safeParse(draft);
  return parsed.success ? parsed.data : null;
}

/** The opening position of the panel: the first option in every group. */
export function defaultRig(): CinemaRig {
  return Object.fromEntries(
    RIG_SLOTS.map((slot) => [slot.key, CINEMA[slot.group][0].id]),
  ) as CinemaRig;
}

export function defaultSpec(): CinemaSpec {
  return {
    scene: { text: "", referenceUrls: [] },
    rig: defaultRig(),
    motion: CINEMA.motions[0].id,
    duration: 6,
  };
}

/* ---------------------------------------------------------------- compiler */

function fragment(group: CinemaGroup, id: string): string {
  return findOption(group, id)?.fragment ?? "";
}

/**
 * Joins fragments into one prompt: single spaces, every clause closed, and
 * never longer than the model will accept. Truncation cuts at a sentence
 * boundary so the prompt never ends mid-word.
 *
 * `SCENE_MAX` already makes this unreachable for anything the schema lets
 * through. It stays as the backstop for a caller that skipped validation.
 */
function assemble(parts: string[]): string {
  const prompt = parts
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (/[.!?]$/.test(part) ? part : `${part}.`))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (prompt.length <= MAX_PROMPT) return prompt;

  const clipped = prompt.slice(0, MAX_PROMPT);
  const lastStop = clipped.lastIndexOf(". ");
  return lastStop > 0 ? clipped.slice(0, lastStop + 1) : clipped.trimEnd();
}

/**
 * The still.
 *
 * Everything the rig decides goes in, because a frame is where the look is
 * fixed — the anchor you pick here is what the motion step animates.
 */
export function compileFramePrompt(spec: CinemaSpec): string {
  return assemble([
    spec.scene.text,
    fragment("cameras", spec.rig.camera),
    fragment("lenses", spec.rig.lens),
    fragment("focalLengths", spec.rig.focalLength),
    fragment("apertures", spec.rig.aperture),
    fragment("genres", spec.rig.genre),
    fragment("lighting", spec.rig.lighting),
  ]);
}

/**
 * The move.
 *
 * The camera move leads, because that is the one thing the anchor frame cannot
 * already show. Aperture and lighting are deliberately left out: they are baked
 * into the anchor, and repeating them only gives the video model something to
 * argue with. The medium and the era stay, since grain and palette have to
 * survive across the whole clip.
 */
export function compileMotionPrompt(spec: CinemaSpec): string {
  return assemble([
    fragment("motions", spec.motion),
    spec.scene.text,
    fragment("cameras", spec.rig.camera),
    fragment("genres", spec.rig.genre),
  ]);
}

/* ------------------------------------------------------------ model calls */

export type CompiledCall = {
  modelId: string;
  prompt: string;
  params: Record<string, unknown>;
  credits: number;
};

/**
 * With references the frames need a model that can hold several at once;
 * without them the cheap four-step model is the right tool for a draft you are
 * going to throw three quarters of away.
 */
export function framesModelId(referenceCount: number): string {
  return referenceCount > 0 ? "nano-banana-edit" : "flux-schnell";
}

function priced(modelId: string, raw: Record<string, unknown>): CompiledCall {
  const model = getModel(modelId);
  if (!model) throw new Error(`Cinema points at a model that no longer exists: ${modelId}`);
  const { params, credits } = parseAndPrice(model as AnyModel, raw);
  return { modelId, prompt: String(params.prompt), params, credits };
}

/** Four widescreen candidates. One job, four images — one charge, one poll. */
export function compileFrames(spec: CinemaSpec): CompiledCall {
  const prompt = compileFramePrompt(spec);
  const references = spec.scene.referenceUrls;

  if (references.length > 0) {
    return priced("nano-banana-edit", {
      prompt,
      image_urls: references,
      aspect_ratio: "16:9",
      num_images: FRAME_COUNT,
    });
  }

  return priced("flux-schnell", {
    prompt,
    image_size: "landscape_16_9",
    num_images: FRAME_COUNT,
  });
}

/** The clip, animated from whichever frame was chosen as the anchor. */
export function compileMotion(spec: CinemaSpec, anchorUrl: string): CompiledCall {
  return priced("ltx-i2v", {
    prompt: compileMotionPrompt(spec),
    image_url: anchorUrl,
    aspect_ratio: "16:9",
    resolution: "1080p",
    duration: spec.duration,
  });
}

/** One line for the header, e.g. "35mm Film · Anamorphic 35mm · f/2.8". */
export function describeRig(rig: CinemaRig): string {
  return [
    findOption("cameras", rig.camera)?.label,
    [findOption("lenses", rig.lens)?.label, findOption("focalLengths", rig.focalLength)?.label]
      .filter(Boolean)
      .join(" "),
    findOption("apertures", rig.aperture)?.label,
  ]
    .filter(Boolean)
    .join(" · ");
}
