import { fal } from "@fal-ai/client";

import type { AnyModel } from "@/lib/models";
import { retry, TimeoutError, withTimeout } from "@/lib/retry";
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
 *
 * Every call has a deadline. Reads are retried with backoff because repeating
 * them is free and safe; submit is not, because a request that reached fal
 * before the connection dropped would be queued twice — a render nobody asked
 * for and a bill nobody agreed to.
 */

const SUBMIT_TIMEOUT_MS = 20_000;
const READ_TIMEOUT_MS = 15_000;

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
      const { request_id } = await withTimeout(
        client().queue.submit(model.providerModelId, {
          input: params,
          // The job id rides along so the webhook can find its row without a lookup table.
          webhookUrl: webhookUrl ? `${webhookUrl}?job=${jobId}` : undefined,
        }),
        SUBMIT_TIMEOUT_MS,
        "fal submit",
      );
      return { providerRequestId: request_id };
    } catch (error) {
      throw new ProviderError(`fal submit failed: ${describe(error)}`);
    }
  },

  async status(model: AnyModel, providerRequestId: string): Promise<ProviderStatus> {
    try {
      const status = await retry(
        () =>
          withTimeout(
            client().queue.status(model.providerModelId, { requestId: providerRequestId }),
            READ_TIMEOUT_MS,
            "fal status",
          ),
        { attempts: 3, label: "fal status" },
      );

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
      if (looksFlagged(message)) return { state: "nsfw", error: message };

      // A refusal is a verdict; a timeout or a 5xx is us failing to ask. Only
      // the first should cost the user their render.
      return isUnreachable(error)
        ? { state: "unknown", error: message }
        : { state: "failed", error: message };
    }
  },

  async result(model: AnyModel, providerRequestId: string): Promise<ProviderResult> {
    try {
      const response = await retry(
        () =>
          withTimeout(
            client().queue.result(model.providerModelId, { requestId: providerRequestId }),
            READ_TIMEOUT_MS,
            "fal result",
          ),
        { attempts: 3, label: "fal result" },
      );
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
      await withTimeout(
        client().queue.cancel(model.providerModelId, { requestId: providerRequestId }),
        READ_TIMEOUT_MS,
        "fal cancel",
      );
    } catch (error) {
      // 400 means it already finished — not worth failing the user's request over.
      const message = describe(error);
      if (!message.includes("400")) {
        throw new ProviderError(`fal cancel failed: ${message}`);
      }
    }
  },
};

/** Did we fail to ask, rather than get an answer we did not like? */
function isUnreachable(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;
  const message = describe(error).toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("econnreset") ||
    message.includes("enotfound") ||
    message.includes("etimedout") ||
    message.includes("socket hang up") ||
    message.includes("network") ||
    /\b(500|502|503|504)\b/.test(message)
  );
}

/**
 * Everything fal told us, not just the status line.
 *
 * The client throws an ApiError whose `message` is only the HTTP reason —
 * "Forbidden", "Unprocessable Entity" — while `body.detail` carries the part
 * that says what to do about it ("User is locked. Reason: Exhausted balance.").
 * Reading only the message turned an actionable operator error into a shrug,
 * and it also hid the safety wording that `looksFlagged` needs to map a refusal
 * to `nsfw` instead of a plain failure.
 */
export function describe(error: unknown): string {
  if (typeof error === "string") return error;
  if (!(error instanceof Error)) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  const parts: string[] = [];
  const api = error as Error & { status?: number; body?: unknown };

  if (typeof api.status === "number") parts.push(`HTTP ${api.status}`);
  parts.push(error.message);

  const detail = readDetail(api.body);
  if (detail && !error.message.includes(detail)) parts.push(detail);

  return parts.filter(Boolean).join(" — ");
}

/** fal puts the useful sentence in `detail`, sometimes as a validation array. */
function readDetail(body: unknown): string | null {
  if (!body) return null;
  if (typeof body === "string") return body.slice(0, 300);

  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail.slice(0, 300);

  if (Array.isArray(detail)) {
    const messages = detail
      .map((d) => (typeof d === "string" ? d : (d as { msg?: string })?.msg))
      .filter(Boolean);
    if (messages.length) return messages.join("; ").slice(0, 300);
  }

  try {
    return JSON.stringify(body).slice(0, 300);
  } catch {
    return null;
  }
}
