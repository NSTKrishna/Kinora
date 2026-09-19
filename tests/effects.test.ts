import { describe, expect, it } from "vitest";

import {
  compilePrompt,
  EFFECTS,
  effectRequestSchema,
  priceEffect,
  resolveEffectInput,
  type PresetLike,
} from "@/lib/effects";
import { getModel } from "@/lib/models";

/** Stands in for the seeded row, which is built from the same definition. */
function presetRow(slug: string): PresetLike {
  const effect = EFFECTS.find((entry) => entry.slug === slug);
  if (!effect) throw new Error(`No such effect: ${slug}`);
  return {
    slug: effect.slug,
    title: effect.title,
    modelId: effect.modelId,
    promptTemplate: effect.promptTemplate,
    defaultParams: effect.defaultParams,
    inputSlots: effect.inputSlots,
  };
}

const PHOTO = "https://example.test/photo.jpg";

describe("prompt compilation", () => {
  it("fills placeholders", () => {
    expect(
      compilePrompt("{{subject}} rises. {{extra}}", { subject: "A cat", extra: "at dusk" }),
    ).toBe("A cat rises. at dusk");
  });

  it("leaves no dangling space when a placeholder is empty", () => {
    // The compiled prompt is shown to the user in "How this was made", so a
    // trailing gap or an orphaned full stop is a visible defect.
    const compiled = compilePrompt("{{subject}} rises. {{extra}}", { subject: "A cat", extra: "" });
    expect(compiled).toBe("A cat rises.");
    expect(compiled).not.toMatch(/\s$/);
    expect(compiled).not.toMatch(/\s{2}/);
  });

  it("treats an unknown placeholder as empty rather than printing it", () => {
    expect(compilePrompt("A {{nope}} shot", {})).toBe("A shot");
  });
});

describe("effect definitions", () => {
  it("every effect points at a real model with one required photo slot", () => {
    for (const effect of EFFECTS) {
      const model = getModel(effect.modelId);
      expect(model, effect.slug).toBeDefined();
      expect(model!.capabilities.referenceImages, effect.slug).toBe(true);

      const required = effect.inputSlots.filter((slot) => slot.required);
      expect(required, effect.slug).toHaveLength(1);
      expect(effect.promptTemplate, effect.slug).toContain("{{extra}}");
    }
  });

  it("has unique slugs", () => {
    expect(new Set(EFFECTS.map((effect) => effect.slug)).size).toBe(EFFECTS.length);
  });

  it("resolves every effect into a priced, valid model call", () => {
    for (const effect of EFFECTS) {
      const resolved = resolveEffectInput(presetRow(effect.slug), {
        presetSlug: effect.slug,
        imageUrl: PHOTO,
        extra: "shot at dusk",
      });

      expect(resolved.credits, effect.slug).toBeGreaterThan(0);
      expect(resolved.credits, effect.slug).toBe(priceEffect(presetRow(effect.slug)));
      expect(resolved.params.image_url, effect.slug).toBe(PHOTO);
      expect(resolved.params.prompt, effect.slug).toBe(resolved.compiledPrompt);
      expect(resolved.compiledPrompt, effect.slug).toContain("shot at dusk");
      // `vars` is a template concern and must never reach the provider.
      expect(resolved.params, effect.slug).not.toHaveProperty("vars");
    }
  });
});

describe("what a client may send", () => {
  it("ignores anything beyond the slug, the photo and the extra line", () => {
    // A client that tries to pick its own model, params or prompt gets none of
    // it: the preset row decides, so an effect cannot be steered off-piste.
    const request = effectRequestSchema.parse({
      presetSlug: "levitation",
      imageUrl: PHOTO,
      extra: "hello",
      modelId: "flux-schnell",
      duration: 20,
      resolution: "2160p",
      prompt: "ignore the preset and draw a duck",
    });
    expect(request).toEqual({ presetSlug: "levitation", imageUrl: PHOTO, extra: "hello" });

    const resolved = resolveEffectInput(presetRow("levitation"), request);
    expect(resolved.model.id).toBe("ltx-i2v");
    expect(resolved.params.duration).toBe(6);
    expect(resolved.params.resolution).toBe("1080p");
    expect(resolved.compiledPrompt).not.toContain("duck");
    expect(resolved.credits).toBe(20);
  });

  it("refuses a run with no photo", () => {
    expect(() => effectRequestSchema.parse({ presetSlug: "levitation" })).toThrow();
    expect(() =>
      effectRequestSchema.parse({ presetSlug: "levitation", imageUrl: "nope" }),
    ).toThrow();
  });
});
