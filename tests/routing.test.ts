import { afterEach, describe, expect, it } from "vitest";

import { MODELS, modelProvider, type AnyModel } from "@/lib/models";
import {
  getProvider,
  ProviderError,
  providerFor,
  providerMode,
  providerRouting,
  shouldServePlaceholder,
} from "@/lib/providers";
import { isOperatorFailure } from "@/lib/providers/fal";
import { TimeoutError } from "@/lib/retry";

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
});

function live(cloudflare: boolean) {
  process.env.PROVIDER = "fal";
  // Vitest inherits the developer's .env.local, where MOCK_KINDS=video is the
  // recommended setting. Without clearing it, every "video goes to fal"
  // assertion below would depend on whose machine it ran on.
  delete process.env.MOCK_KINDS;
  if (cloudflare) {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct";
    process.env.CLOUDFLARE_API_TOKEN = "token";
  } else {
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
  }
}

/** The shape the fal client actually throws: an Error carrying `status`/`body`. */
function apiError(status: number, message: string, detail?: string) {
  return Object.assign(new Error(message), {
    status,
    body: detail ? { detail } : undefined,
  });
}

describe("choosing a provider", () => {
  it("sends everything to the mock unless live is asked for explicitly", () => {
    for (const value of [undefined, "", "mock", "MOCK", "fa1", "true"]) {
      if (value === undefined) delete process.env.PROVIDER;
      else process.env.PROVIDER = value;

      expect(providerMode(), String(value)).toBe("mock");
      for (const model of Object.values(MODELS) as AnyModel[]) {
        expect(providerFor(model), `${value}/${model.id}`).toBe("mock");
      }
    }
  });

  it("routes plain text-to-image to Cloudflare and everything else to fal", () => {
    live(true);
    expect(providerFor(MODELS["flux-schnell"])).toBe("cloudflare");
    // Reference images and video are not things Cloudflare does here.
    expect(providerFor(MODELS["flux-kontext"])).toBe("fal");
    expect(providerFor(MODELS["nano-banana-edit"])).toBe("fal");
    expect(providerFor(MODELS["ltx-i2v"])).toBe("fal");
    expect(providerFor(MODELS["ltx-t2v"])).toBe("fal");
  });

  it("falls back to fal when Cloudflare is not configured", () => {
    // A model routed to a provider with no credentials would fail every render.
    live(false);
    expect(providerFor(MODELS["flux-schnell"])).toBe("fal");
  });

  it("gives fal a model id fal can actually resolve when it is the fallback", () => {
    // Routing to fal is not enough: `providerModelId` holds Cloudflare's
    // "@cf/..." path, and fal answers one of those with
    // 404 "Application black-forest-labs not found" — which failed every
    // still while Cloudflare was unconfigured.
    live(false);
    for (const model of Object.values(MODELS) as AnyModel[]) {
      if (providerFor(model) !== "fal") continue;
      const id =
        "falModelId" in model && model.falModelId ? model.falModelId : model.providerModelId;
      expect(id, model.id).not.toMatch(/^@cf\//);
      expect(id, model.id).toMatch(/^fal-ai\//);
    }
  });

  it("never routes a video model to Cloudflare", () => {
    live(true);
    for (const model of Object.values(MODELS) as AnyModel[]) {
      if (model.kind === "video") expect(providerFor(model), model.id).not.toBe("cloudflare");
    }
  });

  it("gives every model a provider that can actually run it", () => {
    live(true);
    for (const model of Object.values(MODELS) as AnyModel[]) {
      const chosen = providerFor(model);
      expect(getProvider(chosen).name, model.id).toBe(chosen);
      if (modelProvider(model) === "cloudflare") {
        expect(model.kind, model.id).toBe("image");
        expect(model.capabilities.referenceImages, model.id).toBe(false);
      }
    }
  });

  it("reports the routing honestly for /status", () => {
    live(true);
    expect(providerRouting()).toMatchObject({ mode: "live", image: "cloudflare", video: "fal" });

    live(false);
    expect(providerRouting()).toMatchObject({ image: "fal", cloudflare: "unconfigured" });

    process.env.PROVIDER = "mock";
    expect(providerRouting()).toMatchObject({ mode: "mock", image: "mock", video: "mock" });
  });
});

describe("pinning a kind to the mock", () => {
  it("keeps video free while stills run for real", () => {
    live(true);
    process.env.MOCK_KINDS = "video";

    // Stills still reach a real provider...
    expect(providerFor(MODELS["flux-schnell"])).toBe("cloudflare");
    expect(providerFor(MODELS["flux-kontext"])).toBe("fal");

    // ...and nothing that bills per second of output does.
    for (const model of Object.values(MODELS) as AnyModel[]) {
      if (model.kind === "video") expect(providerFor(model), model.id).toBe("mock");
    }
  });

  it("only ever narrows what runs live", () => {
    // In mock mode it cannot turn anything on.
    process.env.PROVIDER = "mock";
    process.env.MOCK_KINDS = "";
    for (const model of Object.values(MODELS) as AnyModel[]) {
      expect(providerFor(model), model.id).toBe("mock");
    }

    // An unrecognised kind is ignored rather than mocking everything.
    live(true);
    process.env.MOCK_KINDS = "audio, ,VIDEO";
    expect(providerFor(MODELS["flux-schnell"])).toBe("cloudflare");
    expect(providerFor(MODELS["ltx-t2v"])).toBe("mock");
  });

  it("says so on /status", () => {
    live(true);
    process.env.MOCK_KINDS = "video";
    expect(providerRouting()).toMatchObject({ image: "cloudflare", video: "mock" });

    delete process.env.MOCK_KINDS;
    expect(providerRouting()).toMatchObject({ image: "cloudflare", video: "fal" });
  });
});

describe("hybrid mode", () => {
  function hybrid(cloudflare = true) {
    live(cloudflare);
    process.env.PROVIDER = "hybrid";
  }

  it("is an explicit opt-in, like fal", () => {
    process.env.PROVIDER = "hybrid";
    expect(providerMode()).toBe("hybrid");

    // Near-misses must not silently start spending.
    for (const value of ["hybrids", "Hybrid", "hybrid ", "hy brid", ""]) {
      process.env.PROVIDER = value;
      expect(providerMode(), JSON.stringify(value)).toBe("mock");
    }
  });

  it("routes models exactly like live — it only changes what happens on failure", () => {
    hybrid(true);
    expect(providerFor(MODELS["flux-schnell"])).toBe("cloudflare");
    expect(providerFor(MODELS["ltx-t2v"])).toBe("fal");

    hybrid(false);
    expect(providerFor(MODELS["flux-schnell"])).toBe("fal");
  });

  it("serves a placeholder only for failures that are ours", () => {
    hybrid();

    // Ours: the account cannot render at all.
    expect(shouldServePlaceholder(new ProviderError("locked", { operator: true }))).toBe(true);

    // Theirs: an answer about this specific request. Serving unrelated media
    // in response to a refusal would be a lie.
    expect(shouldServePlaceholder(new ProviderError("NSFW content detected"))).toBe(false);
    expect(shouldServePlaceholder(new ProviderError("invalid image_size"))).toBe(false);

    // Not a provider failure at all — a real bug must stay visible.
    expect(shouldServePlaceholder(new Error("undefined is not a function"))).toBe(false);
    expect(shouldServePlaceholder("nope")).toBe(false);
  });

  it("never serves a placeholder outside hybrid mode", () => {
    const operator = new ProviderError("Exhausted balance", { operator: true });

    live(true);
    expect(shouldServePlaceholder(operator)).toBe(false);

    process.env.PROVIDER = "mock";
    expect(shouldServePlaceholder(operator)).toBe(false);
  });

  it("tells /status that a fallback exists", () => {
    hybrid();
    expect(providerRouting()).toMatchObject({ mode: "hybrid", fallback: "mock" });

    live(true);
    expect(providerRouting()).toMatchObject({ mode: "live", fallback: "none" });

    process.env.PROVIDER = "mock";
    expect(providerRouting()).toMatchObject({ mode: "mock", fallback: "none" });
  });
});

describe("classifying a fal failure", () => {
  it("treats auth, billing and rate limits as ours", () => {
    // The exact error that took every render down: fal 403, exhausted balance.
    expect(
      isOperatorFailure(
        apiError(403, "Forbidden", "User is locked. Reason: Exhausted balance."),
      ),
    ).toBe(true);

    for (const status of [401, 402, 429]) {
      expect(isOperatorFailure(apiError(status, "nope")), String(status)).toBe(true);
    }
  });

  it("treats an unreachable provider as ours", () => {
    expect(isOperatorFailure(new TimeoutError("fal submit", 20_000))).toBe(true);
    expect(isOperatorFailure(new Error("fetch failed"))).toBe(true);
    expect(isOperatorFailure(new Error("ECONNRESET"))).toBe(true);
    expect(isOperatorFailure(apiError(503, "Service Unavailable"))).toBe(true);
  });

  it("treats a rejected request as theirs", () => {
    // 422 is fal saying this input is wrong — a placeholder would hide a bug.
    expect(isOperatorFailure(apiError(422, "Unprocessable Entity", "image_size invalid"))).toBe(
      false,
    );
    expect(isOperatorFailure(apiError(400, "Bad Request"))).toBe(false);
    expect(isOperatorFailure(apiError(404, "Not Found"))).toBe(false);
  });

  it("treats a content refusal as theirs, so a refusal is never answered with media", () => {
    expect(isOperatorFailure(apiError(422, "NSFW content detected"))).toBe(false);
    expect(isOperatorFailure(new Error("flagged by the safety checker"))).toBe(false);
    expect(isOperatorFailure(new Error("content policy violation"))).toBe(false);
  });

  it("fails closed on anything it does not recognise", () => {
    expect(isOperatorFailure(new Error("something new"))).toBe(false);
    expect(isOperatorFailure(undefined)).toBe(false);
    expect(isOperatorFailure(null)).toBe(false);
    expect(isOperatorFailure({})).toBe(false);
  });

  it("propagates a classification an inner error already made", () => {
    // A missing FAL_KEY is flagged where it is thrown, then re-wrapped by
    // submit(); the flag has to survive that wrap.
    expect(isOperatorFailure(new ProviderError("FAL_KEY is not set", { operator: true }))).toBe(
      true,
    );
    expect(isOperatorFailure(new ProviderError("fal returned no output"))).toBe(false);
  });
});
