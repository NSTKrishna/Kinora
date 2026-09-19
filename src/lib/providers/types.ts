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
  webhookUrl?: string;
};

export interface GenerationProvider {
  readonly name: "mock" | "fal";
  submit(args: SubmitArgs): Promise<{ providerRequestId: string }>;
  status(model: AnyModel, providerRequestId: string): Promise<ProviderStatus>;
  result(model: AnyModel, providerRequestId: string): Promise<ProviderResult>;
  cancel(model: AnyModel, providerRequestId: string): Promise<void>;
}

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}
