import { describe, expect, it } from "vitest";

import { MODELS, type AnyModel } from "@/lib/models";
import { describe as describeFalError } from "@/lib/providers/fal";
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

  it("returns a clip as long as the one that was paid for", async () => {
    // A ten-second render costs 33 credits. Handing back a three-second file —
    // which is what shipped before — is the demo lying about what it delivered.
    const model = MODELS["ltx-t2v"];

    for (const duration of [6, 8, 10]) {
      const params = model.schema.parse({
        prompt: "a clip of a given length",
        duration,
        resolution: "1080p",
        aspect_ratio: "16:9",
      });

      const { providerRequestId } = await mockProvider.submit({
        model,
        params: params as Record<string, unknown>,
        jobId: "00000000-0000-0000-0000-000000000000",
      });
      const [asset] = (await mockProvider.result(model, providerRequestId)).assets;

      expect(asset.durationMs, `${duration}s`).toBe(duration * 1000);
      expect(asset.url, `${duration}s`).toContain(`-${duration}s.mp4`);
      // And it is worth watching: the first pass shipped 480x270.
      expect(asset.width!, `${duration}s`).toBeGreaterThanOrEqual(1280);
    }
  });

  it("matches the clip to the requested aspect", async () => {
    const model = MODELS["ltx-t2v"];
    for (const [aspect, portrait] of [
      ["16:9", false],
      ["9:16", true],
    ] as const) {
      const { providerRequestId } = await mockProvider.submit({
        model,
        params: model.schema.parse({
          prompt: "an aspect probe",
          aspect_ratio: aspect,
          duration: 6,
          resolution: "1080p",
        }) as Record<string, unknown>,
        jobId: "00000000-0000-0000-0000-000000000000",
      });
      const [asset] = (await mockProvider.result(model, providerRequestId)).assets;
      expect(asset.height! > asset.width!, aspect).toBe(portrait);
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

/* ---------------------------------------------------- fal error reporting */

/** The shape @fal-ai/client actually throws: message is only the status line. */
class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

describe("reporting a fal failure", () => {
  it("keeps the part that says what to do about it", () => {
    // A real 403 from fal. Reading only `message` gives "Forbidden", which
    // tells an operator nothing; the sentence that matters is in body.detail.
    const text = describeFalError(
      new ApiError("Forbidden", 403, {
        detail:
          "User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing.",
      }),
    );

    expect(text).toContain("403");
    expect(text).toContain("Forbidden");
    expect(text).toContain("Exhausted balance");
    expect(text).toContain("fal.ai/dashboard/billing");
  });

  it("flattens a validation array into something readable", () => {
    const text = describeFalError(
      new ApiError("Unprocessable Entity", 422, {
        detail: [{ msg: "duration must be one of 6, 8, 10" }, { msg: "image_url is required" }],
      }),
    );
    expect(text).toContain("duration must be one of");
    expect(text).toContain("image_url is required");
  });

  it("does not repeat itself when the detail is already the message", () => {
    const text = describeFalError(new ApiError("Rate limited", 429, { detail: "Rate limited" }));
    expect(text.match(/Rate limited/g)).toHaveLength(1);
  });

  it("still handles a plain error, a string and an object", () => {
    expect(describeFalError(new Error("socket hang up"))).toContain("socket hang up");
    expect(describeFalError("plain text")).toBe("plain text");
    expect(describeFalError({ odd: true })).toContain("odd");
  });

  it("surfaces safety wording so a refusal maps to nsfw, not a failure", () => {
    // looksFlagged() reads this string. If the detail were dropped, a content
    // refusal would be recorded as a generic failure.
    const text = describeFalError(
      new ApiError("Unprocessable Entity", 422, { detail: "NSFW content detected in output" }),
    );
    expect(text.toLowerCase()).toContain("nsfw");
  });
});
