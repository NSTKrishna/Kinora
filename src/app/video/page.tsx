import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { Studio, type StudioPrefill } from "@/components/studio/studio";
import { getCurrentUser } from "@/lib/auth";
import { getBalance } from "@/lib/credits";
import { modelsByKind, MODELS, type ModelId } from "@/lib/models";
import { getOwnAsset, getOwnJob, getRecentJobs } from "@/lib/queries";

export const metadata: Metadata = { title: "Video" };

export default async function VideoPage({
  searchParams,
}: {
  searchParams: Promise<{ recreate?: string; from?: string; prompt?: string }>;
}) {
  const { recreate, from, prompt } = await searchParams;

  const user = await getCurrentUser();
  const balance = user ? await getBalance(user.id) : null;
  const jobs = user ? await getRecentJobs(user.id, "video") : [];
  const modelIds = modelsByKind("video").map((model) => model.id as ModelId);

  const prefill = user
    ? await buildPrefill(user.id, { recreate, from, prompt })
    : prompt
      ? { prompt }
      : undefined;

  return (
    <div className="container py-8">
      <PageHeader
        eyebrow="Generate"
        title="Video"
        description="Describe the shot and the camera move. Renders run async — leave the page, come back, the queue is still here."
      />

      <Studio
        kind="video"
        modelIds={modelIds}
        initialBalance={balance}
        initialJobs={jobs}
        prefill={prefill}
      />
    </div>
  );
}

/** `?from=<assetId>` is what the Animate button on an image card sends. */
async function buildPrefill(
  userId: string,
  params: { recreate?: string; from?: string; prompt?: string },
): Promise<StudioPrefill | undefined> {
  if (params.recreate) {
    const job = await getOwnJob(userId, params.recreate);
    if (!job || !MODELS[job.modelId as ModelId]) return undefined;

    const input = (job.input ?? {}) as Record<string, unknown>;
    const values: Record<string, string> = {};
    for (const field of MODELS[job.modelId as ModelId].fields) {
      const value = input[field.name];
      if (value !== undefined && value !== null) values[field.name] = String(value);
    }
    return { modelId: job.modelId as ModelId, prompt: job.prompt, values };
  }

  if (params.from) {
    const asset = await getOwnAsset(userId, params.from);
    if (!asset || asset.kind === "video") return undefined;

    const startFrameModel = modelsByKind("video").find(
      (model) => model.capabilities.startEndFrames,
    );
    if (!startFrameModel) return undefined;

    return {
      modelId: startFrameModel.id as ModelId,
      // The still's own prompt is a decent starting point for the motion.
      prompt: asset.prompt ?? "",
      values: { image_url: asset.url },
    };
  }

  // `?prompt=` is what Recreate on an Explore card sends.
  if (params.prompt) return { prompt: params.prompt.slice(0, 2000) };

  return undefined;
}
