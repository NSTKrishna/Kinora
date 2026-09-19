import { describe, expect, it } from "vitest";

import {
  CHARACTER_MAX_PHOTOS,
  CHARACTER_MIN_PHOTOS,
  attachReferences,
  characterCreateSchema,
  referenceCapacity,
} from "@/lib/characters";
import { MODELS, type AnyModel } from "@/lib/models";
import { recreateAssetHref } from "@/lib/recreate";
import type { ExploreItem } from "@/lib/serialize";

const PHOTOS = Array.from({ length: 10 }, (_, i) => `https://kinora.test/${i}.png`);

function item(overrides: Partial<ExploreItem> = {}): ExploreItem {
  return {
    id: "a1",
    jobId: "j1",
    kind: "image",
    url: "https://kinora.test/out.png",
    thumbUrl: null,
    width: 1024,
    height: 1024,
    durationMs: null,
    prompt: "a lone figure on a rain-slick street",
    modelId: "flux-schnell",
    isPublic: true,
    createdAt: "2026-09-20T00:00:00.000Z",
    presetSlug: null,
    modelLabel: "Kinora Still Fast",
    ...overrides,
  };
}

/* ------------------------------------------------------------ characters */

describe("attaching a character", () => {
  it("reads capacity off the registry, not a hardcoded list", () => {
    expect(referenceCapacity(MODELS["flux-schnell"])).toBe(0);
    expect(referenceCapacity(MODELS["flux-kontext"])).toBe(1);
    expect(referenceCapacity(MODELS["nano-banana-edit"])).toBe(4);
    expect(referenceCapacity(MODELS["ltx-i2v"])).toBe(1);
  });

  it("says so when the model cannot use references at all", () => {
    const result = attachReferences(MODELS["flux-schnell"], PHOTOS);

    expect(result.values).toEqual({});
    expect(result.used).toBe(0);
    expect(result.notice).toContain("cannot use reference images");
  });

  it("never silently drops photos", () => {
    // A model that takes one of ten has to say so before anything is charged.
    const single = attachReferences(MODELS["flux-kontext"], PHOTOS);
    expect(single.values).toEqual({ image_url: PHOTOS[0] });
    expect(single.used).toBe(1);
    expect(single.notice).toMatch(/first 1 of 10/);

    const multi = attachReferences(MODELS["nano-banana-edit"], PHOTOS);
    expect(multi.values).toEqual({ image_urls: PHOTOS.slice(0, 4) });
    expect(multi.used).toBe(4);
    expect(multi.notice).toMatch(/first 4 of 10/);
  });

  it("stays quiet when everything fits", () => {
    const three = PHOTOS.slice(0, 3);
    expect(attachReferences(MODELS["nano-banana-edit"], three).notice).toBeNull();
    expect(attachReferences(MODELS["flux-kontext"], [PHOTOS[0]]).notice).toBeNull();
  });

  it("produces params the target model actually accepts", () => {
    for (const model of Object.values(MODELS) as AnyModel[]) {
      const result = attachReferences(model, PHOTOS);
      if (result.used === 0) continue;

      const parsed = model.schema.safeParse({
        prompt: "a quiet room at dusk",
        ...result.values,
      });
      expect(parsed.success, `${model.id}: ${JSON.stringify(result.values)}`).toBe(true);
    }
  });
});

describe("the character schema", () => {
  it("wants between three and ten photos", () => {
    const name = "Mara";
    expect(() =>
      characterCreateSchema.parse({ name, urls: PHOTOS.slice(0, CHARACTER_MIN_PHOTOS - 1) }),
    ).toThrow();
    expect(() =>
      characterCreateSchema.parse({
        name,
        urls: [...PHOTOS, "https://kinora.test/extra.png"],
      }),
    ).toThrow();

    expect(
      characterCreateSchema.parse({ name, urls: PHOTOS.slice(0, CHARACTER_MIN_PHOTOS) }).urls,
    ).toHaveLength(CHARACTER_MIN_PHOTOS);
    expect(characterCreateSchema.parse({ name, urls: PHOTOS }).urls).toHaveLength(
      CHARACTER_MAX_PHOTOS,
    );
  });

  it("wants a name", () => {
    expect(() => characterCreateSchema.parse({ name: "  ", urls: PHOTOS })).toThrow();
  });
});

/* --------------------------------------------------------------- explore */

describe("Recreate on a public asset", () => {
  it("opens the effect when the render came from one", () => {
    expect(recreateAssetHref(item({ presetSlug: "levitation", kind: "video" }))).toBe(
      "/effects/levitation",
    );
  });

  it("prefills the matching composer with the prompt and model", () => {
    // Another visitor's job id is not ours to read, so Recreate carries what
    // the feed already shows rather than pretending to reopen their job.
    const href = recreateAssetHref(item());
    expect(href.startsWith("/image?")).toBe(true);

    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("prompt")).toBe("a lone figure on a rain-slick street");
    expect(params.get("model")).toBe("flux-schnell");
  });

  it("sends a clip to the video composer", () => {
    const href = recreateAssetHref(item({ kind: "video", modelId: "ltx-t2v" }));
    expect(href.startsWith("/video?")).toBe(true);
    expect(new URLSearchParams(href.split("?")[1]).get("model")).toBe("ltx-t2v");
  });

  it("still goes somewhere useful with nothing to carry", () => {
    expect(recreateAssetHref(item({ prompt: null, modelId: null }))).toBe("/image");
  });
});
