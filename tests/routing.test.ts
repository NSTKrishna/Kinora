import { afterEach, describe, expect, it } from "vitest";

import { MODELS, modelProvider, type AnyModel } from "@/lib/models";
import { providerFor, providerMode, providerRouting, getProvider } from "@/lib/providers";

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
});

function live(cloudflare: boolean) {
  process.env.PROVIDER = "fal";
  if (cloudflare) {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct";
    process.env.CLOUDFLARE_API_TOKEN = "token";
  } else {
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
  }
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
