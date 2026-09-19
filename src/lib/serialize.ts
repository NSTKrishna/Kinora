import type { Asset, Job } from "@/db/schema";

export type JobView = ReturnType<typeof serializeJob>;
export type AssetView = ReturnType<typeof serializeAsset>;

export function serializeJob(job: Job) {
  return {
    id: job.id,
    kind: job.kind,
    modelId: job.modelId,
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
