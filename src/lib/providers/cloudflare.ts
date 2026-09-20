import sharp from "sharp";

import { getDb } from "@/db";
import { generatedMedia } from "@/db/schema";
import { IMAGE_SIZES, type ImageSizeId, type AnyModel } from "@/lib/models";
import { retry, withTimeout } from "@/lib/retry";
import {
  ProviderError,
  type GenerationProvider,
  type ProviderAsset,
  type ProviderResult,
  type ProviderStatus,
  type SubmitArgs,
} from "./types";

/**
 * Cloudflare Workers AI — the free image path.
 *
 * Docs checked 2026-09-20: `@cf/black-forest-labs/flux-1-schnell` takes
 * `prompt`, `steps` (max 8) and `seed`, and returns ONE image inline as base64.
 * There is no width/height, no batch count and no image-to-image. Every account
 * gets 10,000 neurons a day for free, and a default 1024x1024 four-step render
 * costs ~57.6 of them — roughly 170 images a day, resetting daily, forever.
 *
 * Three things follow from that shape, and each one is handled here rather than
 * leaked into the rest of the app:
 *
 * 1. It is synchronous, not a queue. The work happens in `submit()`, which
 *    makes the Generate request take a couple of seconds instead of returning
 *    instantly. The alternative — generating on the first status poll — needs a
 *    claim to stop two polls both spending neurons, and the durable version of
 *    that is more machinery than a two-second wait is worth.
 *
 * 2. It only makes squares. The registry offers six frames and Cinema asks for
 *    16:9, so the square is centre-cropped to whatever was requested. The
 *    dimensions the user asked for are the dimensions they get; what they lose
 *    is that the model composed for a square. Said plainly in the model blurb.
 *
 * 3. The bytes are ours to keep. They are re-encoded as WebP — a ~1.4MB PNG
 *    becomes ~120KB — and stored in Postgres, because no object store is
 *    configured. See the `generated_media` table.
 */

const ENDPOINT = "https://api.cloudflare.com/client/v4/accounts";
const MODEL_PATH = "@cf/black-forest-labs/flux-1-schnell";
const TIMEOUT_MS = 45_000;
const WEBP_QUALITY = 82;

export function isCloudflareConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
}

function credentials() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    throw new ProviderError(
      "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are not set. Add both to .env.local, or set PROVIDER=mock.",
    );
  }
  return { accountId, token };
}

type CloudflareResponse = {
  result?: { image?: string };
  success?: boolean;
  errors?: { code?: number; message?: string }[];
  messages?: { message?: string }[];
};

/** Everything Cloudflare told us, not just the status line. */
function describeFailure(status: number, body: CloudflareResponse | string): string {
  if (typeof body === "string") return `HTTP ${status} — ${body.slice(0, 300)}`;
  const detail = (body.errors ?? [])
    .map((e) => [e.code, e.message].filter(Boolean).join(" "))
    .filter(Boolean)
    .join("; ");
  return `HTTP ${status}${detail ? ` — ${detail}` : ""}`;
}

/** One image from Cloudflare, as raw PNG bytes. */
async function renderOne(prompt: string, seed: number | undefined): Promise<Buffer> {
  const { accountId, token } = credentials();

  const call = async () => {
    const response = await withTimeout(
      fetch(`${ENDPOINT}/${accountId}/ai/run/${MODEL_PATH}`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        // `steps` is left at the model default of 4: schnell is distilled for
        // few-step sampling, and more steps cost proportionally more neurons
        // out of a fixed daily budget for very little visible gain.
        body: JSON.stringify(seed === undefined ? { prompt } : { prompt, seed }),
      }),
      TIMEOUT_MS,
      "cloudflare render",
    );

    const text = await response.text();
    let body: CloudflareResponse | string;
    try {
      body = JSON.parse(text) as CloudflareResponse;
    } catch {
      body = text;
    }

    if (!response.ok || typeof body === "string" || !body.result?.image) {
      throw new ProviderError(
        `cloudflare render failed: ${describeFailure(response.status, body)}`,
      );
    }

    return Buffer.from(body.result.image, "base64");
  };

  // Reads are safe to repeat; a render is not free, so only retry when the
  // request plainly never produced anything.
  return retry(call, { attempts: 2, baseMs: 600, label: "cloudflare render" });
}

/**
 * Centre-crop the square to the frame that was asked for, then re-encode.
 *
 * `cover` fits the requested box and trims the overflow from the centre, which
 * for a 1024 square means a 16:9 frame keeps the middle band. Upscaling is
 * allowed so that the stated dimensions are always the real ones.
 */
async function toRequestedFrame(png: Buffer, size: ImageSizeId) {
  const { width, height } = IMAGE_SIZES[size] ?? IMAGE_SIZES.square_hd;
  const bytes = await sharp(png)
    .resize(width, height, { fit: "cover", position: "centre", withoutEnlargement: false })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  return { bytes, width, height };
}

export const cloudflareProvider: GenerationProvider = {
  name: "cloudflare",

  async submit({ model, params, userId }: SubmitArgs) {
    if (model.kind !== "image") {
      throw new ProviderError(`Cloudflare Workers AI has no ${model.kind} model in this build.`);
    }

    const prompt = String(params.prompt ?? "");
    const size = (params.image_size as ImageSizeId) ?? "square_hd";
    const count = Math.max(1, Math.min(4, Number(params.num_images ?? 1)));
    const seed = params.seed === undefined ? undefined : Number(params.seed);

    // One call per image — the endpoint has no batch parameter. In parallel,
    // because four sequential four-step renders is a long time to hold a
    // request open. Each gets its own seed so a batch is not four copies.
    const rendered = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        renderOne(prompt, seed === undefined ? undefined : seed + i).then((png) =>
          toRequestedFrame(png, size),
        ),
      ),
    );

    const rows = await getDb()
      .insert(generatedMedia)
      .values(
        rendered.map((image) => ({
          userId: userId ?? null,
          contentType: "image/webp",
          width: image.width,
          height: image.height,
          bytes: image.bytes,
        })),
      )
      .returning({
        id: generatedMedia.id,
        width: generatedMedia.width,
        height: generatedMedia.height,
      });

    // The request id carries the whole result, so status() and result() need no
    // further state and behave identically across serverless invocations.
    return {
      providerRequestId: `cf:${rows.map((r) => `${r.id}:${r.width}x${r.height}`).join(",")}`,
    };
  },

  async status(): Promise<ProviderStatus> {
    // Synchronous provider: if submit() returned, the work is already done.
    return { state: "completed" };
  },

  async result(_model: AnyModel, providerRequestId: string): Promise<ProviderResult> {
    const assets: ProviderAsset[] = providerRequestId
      .slice("cf:".length)
      .split(",")
      .filter(Boolean)
      .map((entry) => {
        const [id, dims] = entry.split(":");
        const [width, height] = (dims ?? "").split("x").map(Number);
        return {
          kind: "image" as const,
          url: `/api/media/${id}`,
          width: Number.isFinite(width) ? width : undefined,
          height: Number.isFinite(height) ? height : undefined,
        };
      });

    if (!assets.length) throw new ProviderError("cloudflare returned no output");
    return { assets };
  },

  async cancel() {
    // Nothing to cancel: the render finished before the job row existed.
  },
};
