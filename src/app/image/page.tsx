import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { Studio, type StudioPrefill } from "@/components/studio/studio";
import { getCurrentUser } from "@/lib/auth";
import { getBalance } from "@/lib/credits";
import { modelsByKind, MODELS, type ModelId } from "@/lib/models";
import { getOwnAsset, getOwnJob, getRecentJobs } from "@/lib/queries";

export const metadata: Metadata = { title: "Image" };

export default async function ImagePage({
  searchParams,
}: {
  searchParams: Promise<{ recreate?: string; from?: string; prompt?: string }>;
}) {
  const { recreate, from, prompt } = await searchParams;

  const user = await getCurrentUser();
  const balance = user ? await getBalance(user.id) : null;
  const jobs = user ? await getRecentJobs(user.id, "image") : [];
  const modelIds = modelsByKind("image").map((model) => model.id as ModelId);

  const prefill = user
    ? await buildPrefill(user.id, { recreate, from, prompt })
    : prompt
      ? { prompt }
      : undefined;

  return (
    <div className="container py-8">
      <PageHeader
        eyebrow="Generate"
        title="Image"
        description="One prompt, one still. Pick a model, set the frame, and send it to the queue — renders run async, so you can keep writing."
      />

      <Studio
        kind="image"
        modelIds={modelIds}
        initialBalance={balance}
        initialJobs={jobs}
        prefill={prefill}
      />
    </div>
  );
}

/** Recreate a past job, or start from an existing image as a reference. */
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
    if (!asset) return undefined;
    const referenceModel = modelsByKind("image").find(
      (model) => model.capabilities.referenceImages,
    );
    if (!referenceModel) return undefined;
    return {
      modelId: referenceModel.id as ModelId,
      prompt: asset.prompt ?? "",
      values: { image_url: asset.url },
    };
  }

  // `?prompt=` is what Recreate on an Explore card sends: the prompt, nothing
  // else, so the visitor lands in the composer with something to edit.
  if (params.prompt) return { prompt: params.prompt.slice(0, 2000) };

  return undefined;
}
