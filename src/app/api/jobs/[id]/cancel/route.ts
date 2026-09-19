import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getBalance } from "@/lib/credits";
import { getJob, isActive, transition } from "@/lib/jobs";
import { getModel } from "@/lib/models";
import { getProvider } from "@/lib/providers";
import { apiError, isUuid, toResponse } from "@/lib/api";
import { serializeJob } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return apiError("not_found", "That render does not exist.", 404);

    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    const job = await getJob(id);
    if (!job || job.userId !== user.id) {
      return apiError("not_found", "That render does not exist.", 404);
    }
    if (!isActive(job.status)) {
      return apiError("already_finished", "That render already finished.", 409);
    }

    // Tell the provider first — a cancelled request we never told them about
    // still costs money. Failing to reach them must not block the refund.
    const model = getModel(job.modelId);
    if (model && job.providerRequestId) {
      try {
        await getProvider(job.provider).cancel(model, job.providerRequestId);
      } catch (error) {
        console.error("[kinora] provider cancel failed", error);
      }
    }

    const canceled = await transition(job, { status: "canceled", error: "Canceled by you" });

    return NextResponse.json({
      job: serializeJob(canceled),
      balance: await getBalance(user.id),
    });
  } catch (error) {
    return toResponse(error);
  }
}
