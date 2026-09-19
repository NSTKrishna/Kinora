import type { GenerationProvider, ProviderResult, ProviderStatus, SubmitArgs } from "./types";
import type { AnyModel } from "@/lib/models";
import { IMAGE_SIZES, type ImageSizeId } from "@/lib/models";
import { EFFECTS } from "@/lib/effects";

/**
 * The mock provider. Development and demos cost nothing.
 *
 * It is deliberately stateless: everything status() and result() need is
 * encoded in the request id, so it behaves identically across serverless
 * invocations where a module-level map would not survive.
 *
 *   mock:<base64url json>
 *
 * Prompts steer it, which is how the failure and safety paths get exercised
 * without burning provider credits:
 *   [[fail]] → the job fails    [[nsfw]] → flagged    [[slow]] → 20s render
 *
 * An effect run gets that effect's own example clip back, so the mock demo is
 * coherent: pick Levitation and a levitation clip is what lands.
 */

const QUEUED_MS = 1_200;
const RUNNING_MS = 3_800;
const SLOW_RUNNING_MS = 20_000;

type MockMode = "ok" | "fail" | "nsfw" | "slow";

type MockTicket = {
  mode: MockMode;
  startedAt: number;
  count: number;
  kind: "image" | "video";
  aspect: string;
  size?: ImageSizeId;
  durationMs?: number;
  preset?: string;
  nonce: string;
};

export const MOCK_DIRECTIVES: Record<Exclude<MockMode, "ok">, string> = {
  fail: "[[fail]]",
  nsfw: "[[nsfw]]",
  slow: "[[slow]]",
};

/** Mock clips, rendered by us with ffmpeg. No third-party media ships here. */
const MOCK_CLIPS: Record<string, { url: string; width: number; height: number }> = {
  "16:9": { url: "/mock/ember-16x9.mp4", width: 640, height: 360 },
  "9:16": { url: "/mock/dusk-9x16.mp4", width: 360, height: 640 },
  "1:1": { url: "/mock/fog-1x1.mp4", width: 480, height: 480 },
  auto: { url: "/mock/amber-16x9.mp4", width: 640, height: 360 },
};

function modeFromPrompt(prompt: string): MockMode {
  const lowered = prompt.toLowerCase();
  if (lowered.includes(MOCK_DIRECTIVES.fail)) return "fail";
  if (lowered.includes(MOCK_DIRECTIVES.nsfw)) return "nsfw";
  if (lowered.includes(MOCK_DIRECTIVES.slow)) return "slow";
  return "ok";
}

function encode(ticket: MockTicket): string {
  const json = JSON.stringify(ticket);
  const base64 = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `mock:${base64}`;
}

function decode(requestId: string): MockTicket {
  const fallback: MockTicket = {
    mode: "ok",
    startedAt: 0,
    count: 1,
    kind: "image",
    aspect: "1:1",
    nonce: "0",
  };

  const payload = requestId.slice("mock:".length);
  try {
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    return { ...fallback, ...(JSON.parse(atob(padded)) as Partial<MockTicket>) };
  } catch {
    return fallback;
  }
}

/**
 * Image models size their output either by a named preset or by an aspect
 * ratio. The mock has to speak both, because it has to support every model in
 * the registry — a still that came back square from a 16:9 request would make
 * the Cinema frame picker lie about what fal would have returned.
 */
const ASPECT_SIZES: Record<string, { width: number; height: number }> = {
  "21:9": { width: 1260, height: 540 },
  "16:9": { width: 1024, height: 576 },
  "4:3": { width: 1024, height: 768 },
  "1:1": { width: 1024, height: 1024 },
  "3:4": { width: 768, height: 1024 },
  "9:16": { width: 576, height: 1024 },
};

function stillSize(ticket: MockTicket): { width: number; height: number } {
  if (ticket.size && IMAGE_SIZES[ticket.size]) return IMAGE_SIZES[ticket.size];
  return ASPECT_SIZES[ticket.aspect] ?? IMAGE_SIZES.square_hd;
}

/** An effect's own example, when the run came from one. */
function clipFor(ticket: MockTicket) {
  const effect = ticket.preset ? EFFECTS.find((entry) => entry.slug === ticket.preset) : undefined;
  if (effect) return { url: effect.exampleUrl, width: 480, height: 270 };
  return MOCK_CLIPS[ticket.aspect] ?? MOCK_CLIPS.auto;
}

function runningFor(mode: MockMode) {
  return mode === "slow" ? SLOW_RUNNING_MS : RUNNING_MS;
}

export const mockProvider: GenerationProvider = {
  name: "mock",

  async submit({ model, params, presetSlug }: SubmitArgs) {
    const duration = Number(params.duration ?? 0);
    return {
      providerRequestId: encode({
        mode: modeFromPrompt(String(params.prompt ?? "")),
        startedAt: Date.now(),
        count: Number(params.num_images ?? 1),
        kind: model.kind,
        aspect: String(params.aspect_ratio ?? "1:1"),
        size: params.image_size as ImageSizeId | undefined,
        durationMs: duration ? duration * 1000 : undefined,
        preset: presetSlug ?? undefined,
        nonce: Math.random().toString(36).slice(2, 10),
      }),
    };
  },

  async status(_model: AnyModel, providerRequestId: string): Promise<ProviderStatus> {
    const { mode, startedAt } = decode(providerRequestId);
    const age = Date.now() - startedAt;

    if (age < QUEUED_MS) return { state: "queued", queuePosition: 1 };
    if (age < runningFor(mode)) return { state: "running" };

    if (mode === "fail") {
      return { state: "failed", error: "Mock provider: forced failure ([[fail]])" };
    }
    if (mode === "nsfw") {
      return { state: "nsfw", error: "Mock provider: output flagged ([[nsfw]])" };
    }
    return { state: "completed" };
  },

  async result(_model: AnyModel, providerRequestId: string): Promise<ProviderResult> {
    const ticket = decode(providerRequestId);
    if (ticket.mode === "nsfw") return { assets: [], flagged: true };

    if (ticket.kind === "video") {
      const clip = clipFor(ticket);
      return {
        assets: [
          {
            kind: "video",
            url: clip.url,
            width: clip.width,
            height: clip.height,
            durationMs: ticket.durationMs ?? 5_000,
          },
        ],
      };
    }

    const { width, height } = stillSize(ticket);
    return {
      assets: Array.from({ length: ticket.count }, (_, index) => ({
        kind: "image" as const,
        // Sample stills are generated by us, on our own domain.
        url: `/api/mock/media/${ticket.nonce}-${index}.svg?w=${width}&h=${height}`,
        width,
        height,
      })),
    };
  },

  async cancel() {
    // Nothing to tell: cancellation is recorded on our side.
  },
};
