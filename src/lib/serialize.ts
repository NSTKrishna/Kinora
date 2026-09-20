import type { Asset, Job } from "@/db/schema";

export type JobView = ReturnType<typeof serializeJob>;
export type AssetView = ReturnType<typeof serializeAsset>;

export function serializeJob(job: Job) {
  return {
    id: job.id,
    kind: job.kind,
    modelId: job.modelId,
    presetSlug: job.presetSlug,
    status: job.status,
    prompt: job.compiledPrompt,
    input: job.input as Record<string, unknown>,
    costCredits: job.costCredits,
    /**
     * Which provider actually ran it — not which one was asked. In hybrid mode
     * this reads `mock` when a real provider could not serve us, and that is
     * what every placeholder badge keys off. Without it no surface can tell a
     * real render from a substituted one.
     */
    provider: job.provider,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}

export function serializeAsset(asset: Asset) {
  return {
    id: asset.id,
    jobId: asset.jobId,
    kind: asset.kind,
    url: asset.url,
    thumbUrl: asset.thumbUrl,
    width: asset.width,
    height: asset.height,
    durationMs: asset.durationMs,
    prompt: asset.prompt,
    modelId: asset.modelId,
    isPublic: asset.isPublic,
    createdAt: asset.createdAt.toISOString(),
  };
}

/**
 * A public asset as Explore shows it. Lives here rather than in the query
 * module so client components can hold the type without importing anything
 * that is marked server-only.
 */
export type ExploreItem = AssetView & {
  /** The effect it came from, when it came from one. */
  presetSlug: string | null;
  /** Kinora's own name for the model, never the provider's endpoint id. */
  modelLabel: string | null;
  /**
   * Set only on licensed reference footage in the seed set, never on a real
   * render. Its presence is what tells the card not to call the tile a sample.
   */
  credit?: { author: string; url: string } | null;
  /**
   * The provider that produced it, from the originating job. `mock` means the
   * media is a placeholder — either the whole deployment is in mock mode or a
   * hybrid fallback stood in for a provider that could not serve us. Null for
   * seed rows, which have no job and carry their own labelling.
   */
  provider?: "mock" | "fal" | "cloudflare" | null;
};
