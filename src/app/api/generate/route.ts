import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { jobs } from "@/db/schema";
import { currentIpHash, getCurrentUser } from "@/lib/auth";
import { charge, getBalance } from "@/lib/credits";
import { EffectError, effectRequestSchema, resolveEffectInput } from "@/lib/effects";
import { assertCanGenerate } from "@/lib/guards";
import { transition } from "@/lib/jobs";
import { getModel, parseAndPrice, type AnyModel } from "@/lib/models";
import { getPreset } from "@/lib/presets";
import { getProvider, providerName } from "@/lib/providers";
import { checkPrompt } from "@/lib/safety";
import { apiError, toResponse } from "@/lib/api";
import { serializeJob } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Two ways in, one pipeline.
 *
 * The composer sends a model and its params. An effect sends a preset slug, a
 * photo and one optional line — the model, the params and the prompt all come
 * off the preset row, so there is nothing in an effect request a client could
 * bend to get a cheaper or different render.
 */
const composerSchema = z.object({
  modelId: z.string(),
  input: z.record(z.string(), z.unknown()),
});

type Plan = {
  model: AnyModel;
  params: Record<string, unknown>;
  credits: number;
  prompt: string;
  presetSlug: string | null;
};

async function planFrom(body: unknown): Promise<Plan | { error: ReturnType<typeof apiError> }> {
  if (body && typeof body === "object" && "presetSlug" in body) {
    const request = effectRequestSchema.parse(body);

    const preset = await getPreset(request.presetSlug);
    if (!preset) return { error: apiError("unknown_preset", "That effect does not exist.", 404) };

    const resolved = resolveEffectInput(preset, request);
    return {
      model: resolved.model,
      params: resolved.params,
      credits: resolved.credits,
      prompt: resolved.compiledPrompt,
      presetSlug: preset.slug,
    };
  }

  const parsed = composerSchema.parse(body);
  const model = getModel(parsed.modelId);
  if (!model) return { error: apiError("unknown_model", "That model does not exist.", 400) };

  const { params, credits } = parseAndPrice(model, parsed.input);
  return { model, params, credits, prompt: String(params.prompt), presetSlug: null };
}

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

    // 1. Validate and price server-side. The client's idea of cost is ignored.
    const plan = await planFrom(await request.json());
    if ("error" in plan) return plan.error;

    // 2. Cheap safety pre-check, before anything is spent.
    const verdict = checkPrompt(plan.prompt);
    if (!verdict.ok) return apiError("prompt_rejected", verdict.reason, 400);

    // 3. Capacity guards.
    const ipHash = await currentIpHash();
    await assertCanGenerate({ userId: user.id, cost: plan.credits, ipHash });

    const provider = getProvider();

    // 4. Create the job, then charge it. The job id is the idempotency key.
    const [job] = await getDb()
      .insert(jobs)
      .values({
        userId: user.id,
        kind: plan.model.kind,
        modelId: plan.model.id,
        presetSlug: plan.presetSlug,
        status: "queued",
        input: plan.params,
        compiledPrompt: plan.prompt,
        provider: providerName(),
        costCredits: plan.credits,
      })
      .returning();

    await charge({ userId: user.id, jobId: job.id, cost: plan.credits, note: plan.model.label });

    // 5. Submit. If the provider refuses, the job fails and the refund is
    //    handled by the same transition every other failure goes through.
    try {
      const { providerRequestId } = await provider.submit({
        model: plan.model,
        params: plan.params,
        jobId: job.id,
        presetSlug: plan.presetSlug,
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
    if (error instanceof EffectError) {
      console.error("[kinora] broken preset", error);
      return apiError("preset_broken", "That effect is temporarily unavailable.", 503);
    }
    return toResponse(error);
  }
}
