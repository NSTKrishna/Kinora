import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { jobs } from "@/db/schema";
import { currentIpHash, getCurrentUser } from "@/lib/auth";
import { charge, getBalance } from "@/lib/credits";
import { assertCanGenerate } from "@/lib/guards";
import { transition } from "@/lib/jobs";
import { getModel, parseAndPrice } from "@/lib/models";
import { getProvider, providerName } from "@/lib/providers";
import { checkPrompt } from "@/lib/safety";
import { apiError, toResponse } from "@/lib/api";
import { serializeJob } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  modelId: z.string(),
  input: z.record(z.string(), z.unknown()),
});

function webhookUrl(request: NextRequest): string | undefined {
  // fal cannot reach localhost, so we simply poll in development.
  const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  if (!base.startsWith("https://")) return undefined;
  return `${base}/api/webhooks/fal`;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    const body = bodySchema.parse(await request.json());

    const model = getModel(body.modelId);
    if (!model) return apiError("unknown_model", "That model does not exist.", 400);

    // 1. Validate and price server-side. The client's idea of cost is ignored.
    const { params, credits } = parseAndPrice(model, body.input);
    const prompt = String(params.prompt);

    // 2. Cheap safety pre-check, before anything is spent.
    const verdict = checkPrompt(prompt);
    if (!verdict.ok) return apiError("prompt_rejected", verdict.reason, 400);

    // 3. Capacity guards.
    const ipHash = await currentIpHash();
    await assertCanGenerate({ userId: user.id, cost: credits, ipHash });

    const provider = getProvider();

    // 4. Create the job, then charge it. The job id is the idempotency key.
    const [job] = await getDb()
      .insert(jobs)
      .values({
        userId: user.id,
        kind: model.kind,
        modelId: model.id,
        status: "queued",
        input: params,
        compiledPrompt: prompt,
        provider: providerName(),
        costCredits: credits,
      })
      .returning();

    await charge({ userId: user.id, jobId: job.id, cost: credits, note: model.label });

    // 5. Submit. If the provider refuses, the job fails and the refund is
    //    handled by the same transition every other failure goes through.
    try {
      const { providerRequestId } = await provider.submit({
        model,
        params,
        jobId: job.id,
        webhookUrl: webhookUrl(request),
      });

      const [claimed] = await getDb()
        .update(jobs)
        .set({ providerRequestId })
        .where(eq(jobs.id, job.id))
        .returning();

      return NextResponse.json({
        job: serializeJob(claimed ?? job),
        balance: await getBalance(user.id),
      });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Submit failed";
      await transition(job, { status: "failed", error: message });
      return apiError("provider_error", "The render could not be queued. You were refunded.", 502);
    }
  } catch (error) {
    return toResponse(error);
  }
}
