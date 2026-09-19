import { fal } from "@fal-ai/client";

import type { AnyModel } from "@/lib/models";
import {
  ProviderError,
  type GenerationProvider,
  type ProviderAsset,
  type ProviderResult,
  type ProviderStatus,
  type SubmitArgs,
} from "./types";

/**
 * fal.ai adapter, on the queue API so nothing blocks a request handler:
 * submit returns a request id, a webhook (or polling) carries the outcome.
 *
 * Docs checked 2026-09-20: fal.queue.submit / status / result / cancel,
 * statuses IN_QUEUE | IN_PROGRESS | COMPLETED.
 */

let configured = false;

function client() {
  if (!configured) {
    const credentials = process.env.FAL_KEY;
    if (!credentials) throw new ProviderError("FAL_KEY is not set");
    fal.config({ credentials });
    configured = true;
  }
  return fal;
}

/** fal reports safety refusals in several shapes; treat them all as flagged. */
function looksFlagged(text: string): boolean {
  const lowered = text.toLowerCase();
  return (
    lowered.includes("nsfw") ||
    lowered.includes("safety") ||
    lowered.includes("content policy") ||
    lowered.includes("flagged")
  );
}

type FalImage = { url: string; width?: number; height?: number; content_type?: string };
type FalVideo = { url: string; width?: number; height?: number; duration?: number };

function toAssets(data: unknown): { assets: ProviderAsset[]; flagged: boolean } {
  const payload = (data ?? {}) as {
    images?: FalImage[];
    image?: FalImage;
    video?: FalVideo;
    has_nsfw_concepts?: boolean[];
  };

  const flagged = Boolean(payload.has_nsfw_concepts?.some(Boolean));
  const assets: ProviderAsset[] = [];

  for (const image of payload.images ?? (payload.image ? [payload.image] : [])) {
    assets.push({ kind: "image", url: image.url, width: image.width, height: image.height });
  }

  if (payload.video) {
    assets.push({
      kind: "video",
      url: payload.video.url,
      width: payload.video.width,
      height: payload.video.height,
      durationMs: payload.video.duration ? Math.round(payload.video.duration * 1000) : undefined,
    });
  }

  return { assets, flagged };
}

export const falProvider: GenerationProvider = {
  name: "fal",

  async submit({ model, params, jobId, webhookUrl }: SubmitArgs) {
    try {
      const { request_id } = await client().queue.submit(model.providerModelId, {
        input: params,
        // The job id rides along so the webhook can find its row without a lookup table.
        webhookUrl: webhookUrl ? `${webhookUrl}?job=${jobId}` : undefined,
      });
      return { providerRequestId: request_id };
    } catch (error) {
      throw new ProviderError(`fal submit failed: ${describe(error)}`);
    }
  },

  async status(model: AnyModel, providerRequestId: string): Promise<ProviderStatus> {
    try {
      const status = await client().queue.status(model.providerModelId, {
        requestId: providerRequestId,
      });

      switch (status.status) {
        case "IN_QUEUE":
          return { state: "queued", queuePosition: status.queue_position };
        case "IN_PROGRESS":
          return { state: "running" };
        case "COMPLETED": {
          // A completed request can still carry an error payload.
          const error = (status as { error?: unknown }).error;
          if (error) {
            const message = describe(error);
            return looksFlagged(message)
              ? { state: "nsfw", error: message }
              : { state: "failed", error: message };
          }
          return { state: "completed" };
        }
        default:
          return { state: "running" };
      }
    } catch (error) {
      const message = describe(error);
      return looksFlagged(message)
        ? { state: "nsfw", error: message }
        : { state: "failed", error: message };
    }
  },

  async result(model: AnyModel, providerRequestId: string): Promise<ProviderResult> {
    try {
      const response = await client().queue.result(model.providerModelId, {
        requestId: providerRequestId,
      });
      const { assets, flagged } = toAssets(response.data);
      if (!assets.length && !flagged) {
        throw new ProviderError("fal returned no output");
      }
      return { assets, flagged };
    } catch (error) {
      throw new ProviderError(`fal result failed: ${describe(error)}`);
    }
  },

  async cancel(model: AnyModel, providerRequestId: string) {
    try {
      await client().queue.cancel(model.providerModelId, { requestId: providerRequestId });
    } catch (error) {
      // 400 means it already finished — not worth failing the user's request over.
      const message = describe(error);
      if (!message.includes("400")) {
        throw new ProviderError(`fal cancel failed: ${message}`);
      }
    }
  },
};

export function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
