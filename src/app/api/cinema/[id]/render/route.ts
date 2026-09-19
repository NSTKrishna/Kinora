import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { currentIpHash, getCurrentUser } from "@/lib/auth";
import { compileFrames, compileMotion, readDraft, toRunnable } from "@/lib/cinema";
import { getProject, toView, updateProject } from "@/lib/cinema-projects";
import {
  PromptRejectedError,
  runGeneration,
  SubmitFailedError,
  webhookUrlFor,
} from "@/lib/generate";
import { getModel } from "@/lib/models";
import { getOwnAsset } from "@/lib/queries";
import { apiError, isUuid, toResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ stage: z.enum(["frames", "motion"]) });

/**
 * Renders one stage of a sequence.
 *
 * The client sends a stage and nothing else. The scene, the rig, the model and
 * the price are all read back out of the saved project and recompiled here, so
 * what gets charged is always what the panel says — a client cannot hand us a
 * prompt, a model or a cost of its own.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return apiError("not_found", "That sequence does not exist.", 404);
    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    const project = await getProject(user.id, id);
    if (!project) return apiError("not_found", "That sequence does not exist.", 404);

    const { stage } = bodySchema.parse(await request.json());

    const spec = toRunnable(readDraft(project.spec));
    if (!spec) {
      return apiError("incomplete", "Describe the scene before rendering.", 400);
    }

    let call;
    if (stage === "frames") {
      call = compileFrames(spec);
    } else {
      const anchor = project.anchorAssetId
        ? await getOwnAsset(user.id, project.anchorAssetId)
        : null;
      if (!anchor) return apiError("no_anchor", "Pick an anchor frame first.", 400);
      call = compileMotion(spec, absolute(anchor.url, request));
    }

    const model = getModel(call.modelId)!;
    const { job, balance } = await runGeneration({
      userId: user.id,
      model,
      params: call.params,
      prompt: call.prompt,
      credits: call.credits,
      ipHash: await currentIpHash(),
      webhookUrl: webhookUrlFor(request.nextUrl.origin),
    });

    const updated = await updateProject(user.id, id, {
      ...(stage === "frames"
        ? {
            framesJobId: job.id,
            step: "frames" as const,
            // New frames mean the old anchor and clip no longer belong to this
            // sequence, so the sequence genuinely rewinds to this step.
            resetStep: true,
            anchorAssetId: null,
            videoJobId: null,
          }
        : { videoJobId: job.id, step: "motion" as const }),
    });

    return NextResponse.json({ project: await toView(updated ?? project), balance });
  } catch (error) {
    if (error instanceof PromptRejectedError)
      return apiError("prompt_rejected", error.message, 400);
    if (error instanceof SubmitFailedError) {
      return apiError("provider_error", "The render could not be queued. You were refunded.", 502);
    }
    return toResponse(error);
  }
}

/** Providers fetch the start frame over the network, so it needs a full URL. */
function absolute(url: string, request: NextRequest): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  return new URL(url, base).toString();
}
