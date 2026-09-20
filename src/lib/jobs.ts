import "server-only";

import { and, eq, gte, inArray, lt } from "drizzle-orm";

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

/* ------------------------------------------------------------------ sweep */

/**
 * Anything still active after this is not coming back.
 *
 * The slowest thing we run is a ten-second clip, which takes a couple of
 * minutes at worst. Fifteen leaves generous headroom while still being far
 * shorter than "until someone notices".
 */
export const STUCK_AFTER_MS = 15 * 60 * 1000;

/** At most one sweep per instance per minute; it runs on other people's requests. */
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = 0;

/**
 * Fail jobs that have been running too long, and refund them.
 *
 * There is no cron here on purpose: a demo that depends on a scheduler has one
 * more thing that can be quietly not running. Instead this is called from the
 * paths that are already busy — job reads and new generations — throttled so
 * the cost is one indexed query a minute per instance. It goes through
 * `transition()` like everything else, so the refund happens exactly once even
 * if the provider's webhook turns up later.
 */
export async function sweepStuckJobs(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STUCK_AFTER_MS);

  const stale = await getDb()
    .select()
    .from(jobs)
    .where(and(inArray(jobs.status, [...ACTIVE_STATUSES]), lt(jobs.createdAt, cutoff)))
    .limit(25);

  for (const job of stale) {
    await transition(job, {
      status: "failed",
      error: "This render stopped responding and was abandoned. Your credits were returned.",
    });
  }

  return stale.length;
}

/** Fire-and-forget version for request paths. Never throws, never blocks long. */
export async function sweepOpportunistically(): Promise<void> {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;

  try {
    const swept = await sweepStuckJobs();
    if (swept > 0) console.warn(`[kinora] swept ${swept} stuck job(s)`);
  } catch (error) {
    // A sweep that fails must never fail the request it is riding on.
    console.error("[kinora] sweep failed", error);
  }
}

/** Tests only: forget the throttle so a sweep can be forced. */
export function resetSweepThrottle() {
  lastSweep = 0;
}

/** How many jobs are currently past the deadline. Used by /api/health. */
export async function countStuckJobs(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STUCK_AFTER_MS);
  const rows = await getDb()
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(inArray(jobs.status, [...ACTIVE_STATUSES]), lt(jobs.createdAt, cutoff)))
    .limit(100);
  return rows.length;
}

/** How many renders returned placeholder media in the last 24 hours. */
export const FALLBACK_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * A degradation nobody notices is the whole risk of hybrid mode: every render
 * keeps "working" while the real provider has been dead for a day. This is the
 * number that makes that visible on /status without reading the logs.
 *
 * It counts jobs the mock produced, which in a deployment that stays in hybrid
 * mode are exactly the fallbacks. A database that has also served `PROVIDER=mock`
 * traffic — any dev machine — counts those too, so /status says so rather than
 * claiming every one was a provider refusing us.
 *
 * Capped, because the answer "a lot" is as actionable as an exact count.
 */
export async function countPlaceholderFallbacks(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - FALLBACK_WINDOW_MS);
  const rows = await getDb()
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.provider, "mock"), gte(jobs.createdAt, cutoff)))
    .limit(500);
  return rows.length;
}
