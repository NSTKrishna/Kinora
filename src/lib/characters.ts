import { z } from "zod";

import { MAX_MULTI_REFERENCES, takesMultipleReferences, type AnyModel } from "@/lib/models";

/**
 * Characters are stored reference images under a name. No training, no
 * fine-tune, no embedding — AGENTS.md puts that out of scope, and calling a
 * folder of photos a "trained character" would be a lie about what the product
 * does. What they buy is consistency of input: the same faces, props or
 * locations attached to every render without hunting through the library.
 */

export const CHARACTER_MIN_PHOTOS = 3;
export const CHARACTER_MAX_PHOTOS = 10;

export const characterNameSchema = z
  .string()
  .trim()
  .min(1, "Give the character a name.")
  .max(60, "That name is too long.");

/**
 * A reference to one of the user's own stills.
 *
 * Asset URLs are whatever produced them: absolute for Blob uploads and for a
 * real provider, site-relative for the mock. Demanding a full URL here quietly
 * broke saving a character from anything rendered in-app, so both are accepted
 * and normalised before they are matched against the library.
 */
export const assetRefSchema = z
  .string()
  .min(1)
  .refine(
    (value) => value.startsWith("/") || /^https?:\/\//i.test(value),
    "That is not a Kinora image.",
  );

/** Every form a stored asset URL could take, for an exact-match lookup. */
export function assetUrlCandidates(url: string): string[] {
  if (url.startsWith("/")) return [url];
  try {
    const parsed = new URL(url);
    return [url, `${parsed.pathname}${parsed.search}`];
  } catch {
    return [url];
  }
}

export const characterCreateSchema = z.object({
  name: characterNameSchema,
  urls: z
    .array(assetRefSchema)
    .min(CHARACTER_MIN_PHOTOS, `A character needs at least ${CHARACTER_MIN_PHOTOS} photos.`)
    .max(CHARACTER_MAX_PHOTOS, `A character holds at most ${CHARACTER_MAX_PHOTOS} photos.`),
});

export type CharacterView = {
  id: string;
  name: string;
  urls: string[];
  createdAt: string;
};

/**
 * How many of a character's photos a given model can actually take.
 *
 * Read off the registry's capabilities rather than hardcoded per model, so a
 * new model gets the right answer without touching this file.
 */
export function referenceCapacity(model: AnyModel): number {
  if (!model.capabilities.referenceImages) return 0;
  return takesMultipleReferences(model) ? MAX_MULTI_REFERENCES : 1;
}

export type Attachment = {
  /** Params to merge into the model call. Empty when the model cannot use them. */
  values: Record<string, string | string[]>;
  used: number;
  /** Shown to the user whenever what they picked is not what will be sent. */
  notice: string | null;
};

/**
 * Attach a character's photos to a model.
 *
 * The rule that matters: never silently drop references. A model that takes
 * one photo out of ten, or none at all, has to say so before anything is
 * charged — otherwise the render comes back wrong and the credits are gone.
 */
export function attachReferences(model: AnyModel, urls: string[]): Attachment {
  const capacity = referenceCapacity(model);

  if (capacity === 0) {
    return {
      values: {},
      used: 0,
      notice: `${model.label} cannot use reference images. Pick a model that can, or the character will be ignored.`,
    };
  }

  const used = Math.min(capacity, urls.length);
  const dropped = urls.length - used;

  const values: Record<string, string | string[]> = takesMultipleReferences(model)
    ? { image_urls: urls.slice(0, used) }
    : { image_url: urls[0] };

  return {
    values,
    used,
    notice: dropped
      ? `${model.label} takes ${capacity} reference${capacity === 1 ? "" : "s"} — the first ${used} of ${urls.length} ${used === 1 ? "photo is" : "photos are"} attached.`
      : null,
  };
}
