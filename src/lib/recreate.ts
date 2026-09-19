import type { ExploreItem } from "@/lib/serialize";

/**
 * Where "Recreate this" goes for a public asset.
 *
 * Someone else's job id is not ours to read, so recreating another visitor's
 * work means the generator is prefilled from what the feed already shows — the
 * prompt and the model. An effect render opens the effect instead, which is
 * both shorter and a better result: one photo and it is done.
 */
export function recreateAssetHref(item: ExploreItem): string {
  if (item.presetSlug) return `/effects/${item.presetSlug}`;

  const page = item.kind === "video" ? "/video" : "/image";
  const params = new URLSearchParams();
  if (item.prompt) params.set("prompt", item.prompt);
  if (item.modelId) params.set("model", item.modelId);

  const query = params.toString();
  return query ? `${page}?${query}` : page;
}
