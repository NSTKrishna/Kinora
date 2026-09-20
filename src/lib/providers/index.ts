import { cloudflareProvider, isCloudflareConfigured } from "./cloudflare";
import { falProvider } from "./fal";
import { mockProvider } from "./mock";
import { ProviderError, type GenerationProvider } from "./types";
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
export type ProviderMode = "mock" | "live" | "hybrid";

export function providerMode(): ProviderMode {
  // Anything other than an explicit opt-in means mock, so a missing or
  // mistyped env var can never quietly start spending money. `hybrid` is an
  // opt-in of the same class as `fal`: it spends, it just refuses to die when
  // spending stops working.
  const value = process.env.PROVIDER;
  if (value === "hybrid") return "hybrid";
  return value === "fal" || value === "live" ? "live" : "mock";
}

/**
 * Should this failure be answered with a labelled placeholder?
 *
 * Only in hybrid mode, and only when the adapter flagged the failure as the
 * operator's — an exhausted balance, a rejected key, a rate limit, an outage.
 * A content refusal or an unrecognised error still fails, because serving
 * unrelated media in answer to a refusal would be a lie, and hiding a real bug
 * costs more than showing it.
 */
export function shouldServePlaceholder(error: unknown): boolean {
  return providerMode() === "hybrid" && error instanceof ProviderError && error.operator;
}

/**
 * Kinds pinned to the mock even while the rest of the app runs live.
 *
 * The two halves of this product do not cost the same. A still on Cloudflare
 * Workers AI is free within a daily allowance; a clip is billed per second of
 * output, and a handful of them is a real invoice. `MOCK_KINDS=video` is how a
 * demo shows genuine image generation end to end without paying for video.
 *
 * It narrows what runs live, never widens it, so it can only ever reduce spend.
 */
export function mockedKinds(): ReadonlySet<"image" | "video"> {
  const kinds = new Set<"image" | "video">();
  for (const part of (process.env.MOCK_KINDS ?? "").split(",")) {
    const kind = part.trim().toLowerCase();
    if (kind === "image" || kind === "video") kinds.add(kind);
  }
  return kinds;
}

/** The provider that will actually run this model, given the current mode. */
export function providerFor(model: AnyModel): ProviderName {
  if (providerMode() === "mock") return "mock";
  if (mockedKinds().has(model.kind)) return "mock";

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
    return {
      mode,
      image: "mock" as const,
      video: "mock" as const,
      cloudflare: "unused" as const,
      // Nothing to fall back from: the mock is already what runs.
      fallback: "none" as const,
    };
  }
  const mocked = mockedKinds();

  return {
    mode,
    image: mocked.has("image")
      ? ("mock" as const)
      : isCloudflareConfigured()
        ? ("cloudflare" as const)
        : ("fal" as const),
    video: mocked.has("video") ? ("mock" as const) : ("fal" as const),
    cloudflare: isCloudflareConfigured() ? ("configured" as const) : ("unconfigured" as const),
    // The difference between the two spending modes, and the thing an operator
    // most needs to know when a render comes back looking wrong.
    fallback: mode === "hybrid" ? ("mock" as const) : ("none" as const),
  };
}
