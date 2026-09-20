import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { jobs, type Job } from "@/db/schema";
import { charge, getBalance } from "@/lib/credits";
import { assertCanGenerate } from "@/lib/guards";
import { sweepOpportunistically, transition } from "@/lib/jobs";
import type { AnyModel } from "@/lib/models";
import { getProvider, providerFor, shouldServePlaceholder } from "@/lib/providers";
import { checkPrompt } from "@/lib/safety";

/**
 * The one path from a compiled model call to a running job.
 *
 * The composer, effects and Cinema all reach a provider through here, so the
 * order that matters — safety, capacity, charge, submit, refund-on-failure —
 * exists once. Three copies of it would be three chances to charge without
 * submitting, or submit without charging.
 */

export class PromptRejectedError extends Error {}

/** The provider refused the request. The job is already failed and refunded. */
export class SubmitFailedError extends Error {}

export async function runGeneration(args: {
  userId: string;
  model: AnyModel;
  params: Record<string, unknown>;
  prompt: string;
  presetSlug?: string | null;
  credits: number;
  ipHash?: string | null;
  webhookUrl?: string;
}): Promise<{ job: Job; balance: number }> {
  const { userId, model, params, prompt, credits } = args;

  // 1. Cheap safety pre-check, before anything is spent.
  const verdict = checkPrompt(prompt);
  if (!verdict.ok) throw new PromptRejectedError(verdict.reason);

  // 2. Clear out anything abandoned before counting what is active, so a job
  //    that died an hour ago cannot keep someone under their concurrency limit.
  await sweepOpportunistically();

  // 3. Capacity guards.
  await assertCanGenerate({ userId, cost: credits, ipHash: args.ipHash });

  const providerName = providerFor(model);
  const provider = getProvider(providerName);

  // 4. Create the job, then charge it. The job id is the idempotency key.
  const [job] = await getDb()
    .insert(jobs)
    .values({
      userId,
      kind: model.kind,
      modelId: model.id,
      presetSlug: args.presetSlug ?? null,
      status: "queued",
      input: params,
      compiledPrompt: prompt,
      provider: providerName,
      costCredits: credits,
    })
    .returning();

  await charge({ userId, jobId: job.id, cost: credits, note: model.label });

  // 5. Submit. If the provider refuses, the job fails through the same
  //    transition every other failure uses, which is what refunds it.
  try {
    const { providerRequestId } = await provider.submit({
      model,
      params,
      jobId: job.id,
      userId,
      presetSlug: args.presetSlug,
      webhookUrl: args.webhookUrl,
    });

    const [claimed] = await getDb()
      .update(jobs)
      .set({ providerRequestId })
      .where(eq(jobs.id, job.id))
      .returning();

    return { job: claimed ?? job, balance: await getBalance(userId) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Submit failed";

    // Say it out loud. The reason is stored on the job row, but a submit that
    // fails for an operator reason — an expired key, a locked account, an
    // exhausted balance — is invisible to whoever is watching the deployment,
    // and it fails every render until someone notices. The visitor still gets
    // the generic message; this is for the logs.
    console.error(
      `[kinora] ${providerName} submit failed for job ${job.id} (${model.id}): ${message}`,
    );

    // Hybrid mode: when the failure is ours — an exhausted balance, a rejected
    // key, a rate limit, an outage — serve a placeholder instead of taking the
    // product down. The job row records `mock` as the provider, which is both
    // what makes the result honest in the UI and what makes it work: every
    // poll, result and cancel routes off `job.provider`, and the mock's ticket
    // id carries its own state.
    //
    // A content refusal or an unrecognised error does not come through here.
    if (shouldServePlaceholder(error)) {
      try {
        const { providerRequestId } = await getProvider("mock").submit({
          model,
          params,
          jobId: job.id,
          userId,
          presetSlug: args.presetSlug,
        });

        const [claimed] = await getDb()
          .update(jobs)
          .set({ providerRequestId, provider: "mock" })
          .where(eq(jobs.id, job.id))
          .returning();

        console.warn(
          `[kinora] job ${job.id} fell back to a placeholder after ${providerName} failed`,
        );

        return { job: claimed ?? job, balance: await getBalance(userId) };
      } catch (fallbackError) {
        // The safety net tore. Fail the job normally so the credits come back
        // rather than throwing an unrefunded error at the caller.
        const reason = fallbackError instanceof Error ? fallbackError.message : "unknown";
        console.error(`[kinora] placeholder fallback failed for job ${job.id}: ${reason}`);
      }
    }

    await transition(job, { status: "failed", error: message });
    throw new SubmitFailedError(message);
  }
}

/** fal cannot reach localhost, so we simply poll in development. */
export function webhookUrlFor(origin: string): string | undefined {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? origin;
  if (!base.startsWith("https://")) return undefined;
  return `${base}/api/webhooks/fal`;
}
