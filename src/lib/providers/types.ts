import type { AnyModel } from "@/lib/models";

/** What a provider tells us about a request in flight. */
export type ProviderStatus =
  | { state: "queued"; queuePosition?: number }
  | { state: "running" }
  | { state: "completed" }
  | { state: "failed"; error: string }
  | { state: "nsfw"; error: string }
  /**
   * We could not get an answer — a timeout, a dropped connection, a 5xx.
   * Distinct from `failed` on purpose: the render may well still be running,
   * so the job is left alone and the stuck-job sweep decides if it never
   * comes back. Treating an unreachable provider as a failure would throw
   * away work every time the network hiccuped.
   */
  | { state: "unknown"; error: string };

export type ProviderAsset = {
  kind: "image" | "video";
  url: string;
  width?: number;
  height?: number;
  durationMs?: number;
};

export type ProviderResult = {
  assets: ProviderAsset[];
  /** Provider flagged the output. Maps to the job's `nsfw` status. */
  flagged?: boolean;
};

export type SubmitArgs = {
  model: AnyModel;
  params: Record<string, unknown>;
  /** Our job id — providers echo it back on the webhook query string. */
  jobId: string;
  /** Set when the run came from an effect preset. Only the mock reads it. */
  presetSlug?: string | null;
  /** Whose render this is. Providers that hold the bytes need an owner. */
  userId?: string;
  webhookUrl?: string;
};

export interface GenerationProvider {
  readonly name: "mock" | "fal" | "cloudflare";
  submit(args: SubmitArgs): Promise<{ providerRequestId: string }>;
  status(model: AnyModel, providerRequestId: string): Promise<ProviderStatus>;
  result(model: AnyModel, providerRequestId: string): Promise<ProviderResult>;
  cancel(model: AnyModel, providerRequestId: string): Promise<void>;
}

/**
 * HTTP statuses that mean "we will not serve you", not "not this request".
 * A rejected key, an unpaid bill, a rate limit: the identical request would
 * have worked yesterday and will work again once someone acts.
 */
export function isOperatorStatus(status: number): boolean {
  return status === 401 || status === 402 || status === 403 || status === 429;
}

export class ProviderError extends Error {
  /**
   * The provider could not serve us at all — a rejected key, an exhausted
   * balance, a rate limit, an outage — rather than refusing this particular
   * request.
   *
   * Hybrid mode degrades these to a placeholder so a billing lapse cannot take
   * the whole product down. Everything else — invalid params, a content
   * refusal, anything unrecognised — keeps failing, because answering a
   * refusal with unrelated media would be a lie and masking a real bug is
   * more expensive than showing it.
   *
   * Each adapter sets this at the throw site, where the structured error still
   * exists; by the time it reaches `runGeneration` only the message survives.
   */
  readonly operator: boolean;

  constructor(message: string, options?: { operator?: boolean }) {
    super(message);
    this.name = "ProviderError";
    this.operator = options?.operator ?? false;
  }
}
