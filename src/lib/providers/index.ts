import { cloudflareProvider, isCloudflareConfigured } from "./cloudflare";
import { falProvider } from "./fal";
import { mockProvider } from "./mock";
import type { GenerationProvider } from "./types";
import { modelProvider, type AnyModel } from "@/lib/models";

export type ProviderName = "mock" | "fal" | "cloudflare";

/**
 * Which provider runs which model.
 *
 * There is no single "the provider" any more. Text-to-image goes to Cloudflare
 * Workers AI, which is free within a daily allowance; everything Cloudflare
 * cannot do — reference images, video — goes to fal, which bills per call. The
 * registry entry names its own provider, so adding a model decides this in the
 * same edit as everything else about it.
 *
 * `PROVIDER=mock` overrides all of it, which is what keeps development free and
 * is why every model must work against the mock.
 */
export function providerMode(): "mock" | "live" {
  // Anything other than an explicit opt-in means mock, so a missing or
  // mistyped env var can never quietly start spending money.
  return process.env.PROVIDER === "fal" || process.env.PROVIDER === "live" ? "live" : "mock";
}

/** The provider that will actually run this model, given the current mode. */
export function providerFor(model: AnyModel): ProviderName {
  if (providerMode() === "mock") return "mock";

  const preferred = modelProvider(model);
  // A model routed to Cloudflare without credentials would fail every render.
  // Falling back to fal keeps it working, and fal reports its own problems.
  if (preferred === "cloudflare" && !isCloudflareConfigured()) return "fal";
  return preferred;
}

export function getProvider(name: ProviderName): GenerationProvider {
  switch (name) {
    case "fal":
      return falProvider;
    case "cloudflare":
      return cloudflareProvider;
    default:
      return mockProvider;
  }
}

export { isCloudflareConfigured };
export * from "./types";

/**
 * How generation is wired right now, for /api/health and /status.
 *
 * "Which provider?" stopped having one answer once images and video split, and
 * a status page that says "fal" while every still goes to Cloudflare is worse
 * than no status page.
 */
export function providerRouting() {
  const mode = providerMode();
  if (mode === "mock") {
    return { mode, image: "mock" as const, video: "mock" as const, cloudflare: "unused" as const };
  }
  return {
    mode,
    image: isCloudflareConfigured() ? ("cloudflare" as const) : ("fal" as const),
    video: "fal" as const,
    cloudflare: isCloudflareConfigured() ? ("configured" as const) : ("unconfigured" as const),
  };
}
