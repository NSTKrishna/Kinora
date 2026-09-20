import sharp from "sharp";

import { getDb } from "@/db";
import { generatedMedia } from "@/db/schema";
import { isCloudinaryConfigured, renderPublicId, uploadBytes } from "@/lib/cloudinary";
import { IMAGE_SIZES, type ImageSizeId, type AnyModel } from "@/lib/models";
import { retry, TimeoutError, withTimeout } from "@/lib/retry";
import {
  isOperatorStatus,
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

/**
 * A hosted result, encoded into the request id.
 *
 * The Postgres form packs ids as `cf:<uuid>:<w>x<h>,...`, which a URL cannot
 * use — it is full of colons and slashes. So hosted results get their own
 * prefix and a base64url payload, the same trick the mock provider uses to
 * stay stateless across serverless invocations.
 */
const HOSTED_PREFIX = "cfc:";

type HostedImage = { url: string; width?: number; height?: number };

function encodeHosted(images: HostedImage[]): string {
  const json = JSON.stringify(images);
  const base64 = Buffer.from(json, "utf8").toString("base64url");
  return `${HOSTED_PREFIX}${base64}`;
}

function decodeHosted(providerRequestId: string): HostedImage[] {
  try {
    const json = Buffer.from(providerRequestId.slice(HOSTED_PREFIX.length), "base64url").toString(
      "utf8",
    );
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as HostedImage[]) : [];
  } catch {
    return [];
  }
}

export function isCloudflareConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
}

function credentials() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    throw new ProviderError(
      "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are not set. Add both to .env.local, or set PROVIDER=mock.",
      { operator: true },
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
        // A daily-allowance exhaustion arrives here as 429, and a bad token as
        // 403. Both are ours to fix, so hybrid mode can fall back.
        { operator: isOperatorStatus(response.status) || response.status >= 500 },
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

    try {
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

      // Cloudinary is where images live when it is configured: a CDN URL costs
      // the database nothing, and Neon's free tier is a bad place to keep
      // megabytes of WebP. Without it, the bytes go in Postgres and are served
      // by /api/media/[id] — the same path, one hop slower.
      if (isCloudinaryConfigured()) {
        const uploaded = await Promise.all(
          rendered.map((image) =>
            uploadBytes(image.bytes, {
              publicId: renderPublicId(userId ?? "anonymous"),
              contentType: "image/webp",
            }).then((result) => ({
              url: result.url,
              width: result.width ?? image.width,
              height: result.height ?? image.height,
            })),
          ),
        );
        return { providerRequestId: encodeHosted(uploaded) };
      }

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

      // The request id carries the whole result, so status() and result() need
      // no further state and behave identically across serverless invocations.
      return {
        providerRequestId: `cf:${rows.map((r) => `${r.id}:${r.width}x${r.height}`).join(",")}`,
      };
    } catch (error) {
      // Same contract as the fal adapter: every failure leaves here as a
      // ProviderError that says whose problem it is. A timeout never reaches a
      // throw site that knows an HTTP status, so it is classified here.
      if (error instanceof ProviderError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new ProviderError(`cloudflare submit failed: ${message}`, {
        operator: error instanceof TimeoutError,
      });
    }
  },

  async status(): Promise<ProviderStatus> {
    // Synchronous provider: if submit() returned, the work is already done.
    return { state: "completed" };
  },

  async result(_model: AnyModel, providerRequestId: string): Promise<ProviderResult> {
    const assets: ProviderAsset[] = providerRequestId.startsWith(HOSTED_PREFIX)
      ? decodeHosted(providerRequestId).map((image) => ({ kind: "image" as const, ...image }))
      : providerRequestId
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
