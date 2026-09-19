import { describe, expect, it } from "vitest";

import { MODELS, type AnyModel } from "@/lib/models";
import { mockProvider } from "@/lib/providers/mock";

/**
 * AGENTS.md: "Mock returns sample outputs after a fake delay, so development
 * costs nothing." That only holds if the mock can drive *every* model in the
 * registry — a model the mock cannot render is a model nobody can develop
 * against without a provider bill.
 */

/** The smallest valid input for a model, built from its own schema defaults. */
function minimalParams(model: AnyModel): Record<string, unknown> {
  const raw: Record<string, unknown> = { prompt: "a quiet room at dusk" };
  if (model.capabilities.referenceImages) {
    raw.image_url = "https://kinora.test/reference.png";
    raw.image_urls = ["https://kinora.test/reference.png"];
  }
  return model.schema.parse(raw) as Record<string, unknown>;
}

describe("the mock provider", () => {
  for (const model of Object.values(MODELS) as AnyModel[]) {
    it(`renders ${model.id}`, async () => {
      const params = minimalParams(model);

      const { providerRequestId } = await mockProvider.submit({
        model,
        params,
        jobId: "00000000-0000-0000-0000-000000000000",
      });
      expect(providerRequestId.startsWith("mock:")).toBe(true);

      const status = await mockProvider.status(model, providerRequestId);
      expect(status.state).toBe("queued");

      const result = await mockProvider.result(model, providerRequestId);
      expect(result.assets.length).toBeGreaterThan(0);

      for (const asset of result.assets) {
        expect(asset.kind).toBe(model.kind);
        expect(asset.url).toBeTruthy();
        expect(asset.width, `${model.id} width`).toBeGreaterThan(0);
        expect(asset.height, `${model.id} height`).toBeGreaterThan(0);
      }
    });
  }

  it("sizes a still by aspect ratio when the model has no size preset", async () => {
    // nano-banana takes `aspect_ratio`, flux takes `image_size`. A mock that
    // only understood one would hand Cinema square frames for a 16:9 request.
    const model = MODELS["nano-banana-edit"];
    const { providerRequestId } = await mockProvider.submit({
      model,
      params: model.schema.parse({
        prompt: "a quiet room",
        image_urls: ["https://kinora.test/a.png"],
        aspect_ratio: "16:9",
        num_images: 4,
      }),
      jobId: "00000000-0000-0000-0000-000000000000",
    });

    const result = await mockProvider.result(model, providerRequestId);
    expect(result.assets).toHaveLength(4);
    for (const asset of result.assets) {
      expect(asset.width! / asset.height!).toBeCloseTo(16 / 9, 2);
    }
  });

  it("honours the failure and refusal directives", async () => {
    const model = MODELS["flux-schnell"];
    for (const [directive, state] of [
      ["[[fail]]", "failed"],
      ["[[nsfw]]", "nsfw"],
    ] as const) {
      const { providerRequestId } = await mockProvider.submit({
        model,
        params: model.schema.parse({ prompt: `a room ${directive}` }),
        jobId: "00000000-0000-0000-0000-000000000000",
      });
      // Re-read the ticket as if the render had already run its course.
      const aged = ageTicket(providerRequestId);
      expect((await mockProvider.status(model, aged)).state).toBe(state);
    }
  });
});

/** Winds a mock ticket's clock back so the render reads as finished. */
function ageTicket(requestId: string): string {
  const json = JSON.parse(
    atob(requestId.slice("mock:".length).replace(/-/g, "+").replace(/_/g, "/")),
  );
  json.startedAt = Date.now() - 60_000;
  return `mock:${btoa(JSON.stringify(json)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}
