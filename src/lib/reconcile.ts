import "server-only";

import type { Job } from "@/db/schema";
import { transition } from "@/lib/jobs";
import type { AnyModel } from "@/lib/models";
import type { GenerationProvider } from "@/lib/providers";

/**
 * Bring a job's row in line with what the provider says.
 *
 * Polling and webhooks both land here, and both end in transition(), so a job
 * cannot be completed twice or refunded twice no matter which arrives first.
 */
export async function reconcile(
  job: Job,
  model: AnyModel,
  provider: GenerationProvider,
): Promise<Job> {
  if (!job.providerRequestId) return job;

  const status = await provider.status(model, job.providerRequestId);

  switch (status.state) {
    case "queued":
      return job;

    // The provider did not answer. The render is probably still going, so
    // change nothing; if it really is gone, the stuck-job sweep will refund it.
    case "unknown":
      console.warn(`[kinora] provider unreachable for job ${job.id}: ${status.error}`);
      return job;

    case "running":
      return job.status === "running" ? job : transition(job, { status: "running" });

    case "failed":
      return transition(job, { status: "failed", error: status.error });

    case "nsfw":
      return transition(job, { status: "nsfw", error: status.error });

    case "completed": {
      const result = await provider.result(model, job.providerRequestId);

      if (result.flagged || result.assets.length === 0) {
        return transition(job, {
          status: "nsfw",
          error: "The provider flagged this output. You were refunded.",
        });
      }

      return transition(job, { status: "completed", assets: result.assets });
    }
  }
}
