import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getBalance } from "@/lib/credits";
import { getJob, getJobAssets, isActive } from "@/lib/jobs";
import { getModel } from "@/lib/models";
import { getProvider } from "@/lib/providers";
import { apiError, toResponse } from "@/lib/api";
import { serializeAsset, serializeJob } from "@/lib/serialize";
import { reconcile } from "@/lib/reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    let job = await getJob(id);
    if (!job || job.userId !== user.id) {
      return apiError("not_found", "That render does not exist.", 404);
    }

    // Poll path: ask the provider what really happened, then move the job
    // through the same transition the webhook would have used.
    if (isActive(job.status) && job.providerRequestId) {
      const model = getModel(job.modelId);
      if (model) job = await reconcile(job, model, getProvider(job.provider));
    }

    return NextResponse.json({
      job: serializeJob(job),
      assets: (await getJobAssets(job.id)).map(serializeAsset),
      balance: await getBalance(user.id),
    });
  } catch (error) {
    return toResponse(error);
  }
}
