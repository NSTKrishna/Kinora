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
};
