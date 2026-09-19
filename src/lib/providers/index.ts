import { falProvider } from "./fal";
import { mockProvider } from "./mock";
import type { GenerationProvider } from "./types";

export type ProviderName = "mock" | "fal";

/** `mock` unless PROVIDER says otherwise, so a missing env var never spends money. */
export function providerName(): ProviderName {
  return process.env.PROVIDER === "fal" ? "fal" : "mock";
}

export function getProvider(name: ProviderName = providerName()): GenerationProvider {
  return name === "fal" ? falProvider : mockProvider;
}

export * from "./types";
