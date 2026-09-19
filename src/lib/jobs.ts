import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { assets as assetsTable, jobs, type Job } from "@/db/schema";
import { refund } from "@/lib/credits";
import type { ProviderAsset } from "@/lib/providers";

export const ACTIVE_STATUSES = ["queued", "running"] as const;
export const TERMINAL_STATUSES = ["completed", "failed", "nsfw", "canceled"] as const;

export type JobStatus = Job["status"];

export function isActive(status: JobStatus) {
  return (ACTIVE_STATUSES as readonly string[]).includes(status);
}

export function isTerminal(status: JobStatus) {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

type TransitionInput = {
  status: JobStatus;
  error?: string | null;
  providerRequestId?: string | null;
  assets?: ProviderAsset[];
};

/**
 * The only way a job changes status.
 *
 * Every rule about money and side effects lives here: assets are saved on
 * completion, credits come back exactly once on failure, refusal or cancel, and
 * a job that has already finished cannot be moved again. Callers — the poller,
 * the webhook, the cancel route — all funnel through this, so a job cannot be
 * refunded twice by two of them racing.
 */
export async function transition(job: Job, next: TransitionInput): Promise<Job> {
  const db = getDb();
  const now = new Date();

  if (job.status === next.status && next.status !== "completed") {
    return job;
  }

  // Claim the change: only a job still in a non-terminal state can move.
  const [updated] = await db
    .update(jobs)
    .set({
      status: next.status,
      error: next.error ?? null,
      providerRequestId: next.providerRequestId ?? job.providerRequestId,
      startedAt: next.status === "running" ? (job.startedAt ?? now) : job.startedAt,
      completedAt: isTerminal(next.status) ? now : null,
    })
    .where(and(eq(jobs.id, job.id), inArray(jobs.status, [...ACTIVE_STATUSES])))
    .returning();

  if (!updated) {
    // Someone else already finished this job. Their side effects stand.
    const [current] = await db.select().from(jobs).where(eq(jobs.id, job.id)).limit(1);
    return current ?? job;
  }

  if (next.status === "completed" && next.assets?.length) {
    await db.insert(assetsTable).values(
      next.assets.map((asset) => ({
        userId: updated.userId,
        jobId: updated.id,
        kind: asset.kind,
        url: asset.url,
        width: asset.width ?? null,
        height: asset.height ?? null,
        durationMs: asset.durationMs ?? null,
        prompt: updated.compiledPrompt,
        modelId: updated.modelId,
        isPublic: false,
      })),
    );
  }

  // Nothing was delivered, so nothing is owed — but only once the job has
  // actually finished. A job moving to `running` is still going to deliver.
  // Keyed on the job, so the webhook and the poller racing is harmless.
  if (isTerminal(next.status) && next.status !== "completed" && updated.costCredits > 0) {
    await refund({
      userId: updated.userId,
      jobId: updated.id,
      amount: updated.costCredits,
      note: `Refund for ${next.status} job`,
    });
  }

  return updated;
}

export async function getJob(jobId: string): Promise<Job | undefined> {
  const [job] = await getDb().select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return job;
}

export async function getJobAssets(jobId: string) {
  return getDb().select().from(assetsTable).where(eq(assetsTable.jobId, jobId));
}
