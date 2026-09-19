import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { currentIpHash, getCurrentUser } from "@/lib/auth";
import { EffectError, effectRequestSchema, resolveEffectInput } from "@/lib/effects";
import {
  PromptRejectedError,
  runGeneration,
  SubmitFailedError,
  webhookUrlFor,
} from "@/lib/generate";
import { getModel, isHidden, parseAndPrice, type AnyModel } from "@/lib/models";
import { getPreset } from "@/lib/presets";
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
  if (!model || isHidden(model)) {
    return { error: apiError("unknown_model", "That model does not exist.", 400) };
  }

  const { params, credits } = parseAndPrice(model, parsed.input);
  return { model, params, credits, prompt: String(params.prompt), presetSlug: null };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    // Validate and price server-side. The client's idea of cost is ignored.
    const plan = await planFrom(await request.json());
    if ("error" in plan) return plan.error;

    const { job, balance } = await runGeneration({
      userId: user.id,
      model: plan.model,
      params: plan.params,
      prompt: plan.prompt,
      credits: plan.credits,
      presetSlug: plan.presetSlug,
      ipHash: await currentIpHash(),
      webhookUrl: webhookUrlFor(request.nextUrl.origin),
    });

    return NextResponse.json({ job: serializeJob(job), balance });
  } catch (error) {
    if (error instanceof PromptRejectedError) {
      return apiError("prompt_rejected", error.message, 400);
    }
    if (error instanceof SubmitFailedError) {
      return apiError("provider_error", "The render could not be queued. You were refunded.", 502);
    }
    if (error instanceof EffectError) {
      console.error("[kinora] broken preset", error);
      return apiError("preset_broken", "That effect is temporarily unavailable.", 503);
    }
    return toResponse(error);
  }
}
