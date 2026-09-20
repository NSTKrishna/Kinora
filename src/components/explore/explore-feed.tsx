"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Repeat2, Sparkles, Wand2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { AssetMedia } from "@/components/studio/asset-media";
import { recreateAssetHref } from "@/lib/recreate";
import { SEED_ASSETS, SEED_IS_REAL, type SeedAsset } from "@/lib/seed";
import type { ExploreItem } from "@/lib/serialize";

type Filter = "all" | "image" | "video" | "effect";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "video", label: "Videos" },
  { id: "effect", label: "Effects" },
];

/**
 * Below this many real public renders the feed looks broken rather than new, so
 * the seed set fills the rest of the grid. Seed tiles are labelled and never
 * counted as anyone's work — a demo that fakes a community is worse than one
 * that admits it is young. Recreate still works on them, because the prompt is
 * ours and the composer can take it.
 */
const MIN_TILES = 8;

/** A seed asset, in the shape the feed already knows how to render. */
function seedToItem(seed: SeedAsset): ExploreItem {
  return {
    id: `seed-${seed.slug}`,
    jobId: null,
    kind: seed.kind,
    url: seed.url,
    thumbUrl: null,
    width: seed.width ?? null,
    height: seed.height ?? null,
    durationMs: seed.durationMs,
    prompt: seed.prompt,
    modelId: seed.modelId,
    isPublic: true,
    createdAt: "",
    presetSlug: null,
    modelLabel: null,
  };
}

type Page = { items: ExploreItem[]; nextCursor: string | null };

export function ExploreFeed({ initial }: { initial: Page }) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [items, setItems] = React.useState<ExploreItem[]>(initial.items);
  const [cursor, setCursor] = React.useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<ExploreItem | null>(null);

  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const requestRef = React.useRef(0);

  const load = React.useCallback(async (next: Filter, from: string | null, replace: boolean) => {
    const token = ++requestRef.current;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ filter: next });
      if (from) params.set("cursor", from);

      const response = await fetch(`/api/explore?${params}`, { cache: "no-store" });
      const data = await response.json();
      // A slow page must not overwrite a newer filter's results.
      if (token !== requestRef.current) return;

      if (!response.ok) {
        setError(data?.error?.message ?? "Could not load the feed.");
        return;
      }

      const page = data as Page;
      setItems((current) => (replace ? page.items : [...current, ...page.items]));
      setCursor(page.nextCursor);
    } catch {
      if (token === requestRef.current) setError("Could not reach the server.");
    } finally {
      if (token === requestRef.current) setLoading(false);
    }
  }, []);

  const changeFilter = (next: Filter) => {
    if (next === filter) return;
    setFilter(next);
    setItems([]);
    setCursor(null);
    void load(next, null, true);
  };

  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !cursor || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void load(filter, cursor, false);
      },
      { rootMargin: "500px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, filter, load, loading]);

  // Seeds only ever pad the grid; real work always comes first.
  const samples = React.useMemo(() => {
    if (cursor || items.length >= MIN_TILES) return [];
    return seedsFor(filter)
      .slice(0, MIN_TILES - items.length)
      .map(seedToItem);
  }, [cursor, filter, items.length]);

  const empty = !loading && !error && items.length === 0 && samples.length === 0;

  return (
    <>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {FILTERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => changeFilter(entry.id)}
            aria-pressed={entry.id === filter}
            className={cn(
              "shrink-0 rounded-sm px-3 py-1.5 text-xs transition-colors",
              entry.id === filter
                ? "bg-secondary text-foreground"
                : "border border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState
          title="The feed did not load"
          description={error}
          action={
            <Button variant="outline" onClick={() => void load(filter, null, true)}>
              Try again
            </Button>
          }
          className="mt-6"
        />
      ) : null}

      {empty ? (
        <EmptyState
          icon={<Sparkles />}
          title="Nothing shared yet"
          description="Renders are private by default. Make one public from your library and it appears here."
          action={
            <Button asChild>
              <Link href="/image">Generate something</Link>
            </Button>
          }
          className="mt-6"
        />
      ) : null}

      <div className="mt-6 columns-1 gap-4 [column-fill:_balance] sm:columns-2 lg:columns-3 xl:columns-4">
        {items.map((item) => (
          <div key={item.id} className="mb-4 animate-fade-up break-inside-avoid">
            <PublicCard item={item} onOpen={() => setOpen(item)} />
          </div>
        ))}

        {samples.map((item) => (
          <div key={item.id} className="mb-4 break-inside-avoid">
            <PublicCard item={item} onOpen={() => setOpen(item)} sample />
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      ) : null}

      <div ref={sentinelRef} aria-hidden className="h-px" />

      <DetailModal item={open} onOpenChange={(next) => !next && setOpen(null)} />
    </>
  );
}

/** Seeds are matched to the filter so "Videos" never shows a still. */
function seedsFor(filter: Filter): SeedAsset[] {
  if (filter === "image") return SEED_ASSETS.filter((item) => item.kind === "image");
  if (filter === "video" || filter === "effect") {
    return SEED_ASSETS.filter((item) => item.kind === "video");
  }
  return SEED_ASSETS;
}

function PublicCard({
  item,
  onOpen,
  sample = false,
}: {
  item: ExploreItem;
  onOpen: () => void;
  sample?: boolean;
}) {
  return (
    <article className="hover:glow-ember focus-within:glow-ember group relative isolate w-full overflow-hidden rounded-lg border border-border bg-card transition-[transform,box-shadow] duration-300 ease-out focus-within:-translate-y-0.5 hover:-translate-y-0.5">
      <button type="button" onClick={onOpen} className="block w-full focus-visible:outline-none">
        <AssetMedia
          asset={item}
          className={cn("w-full", item.kind === "video" ? "aspect-video" : "aspect-[4/5]")}
        />
        <span className="sr-only">Open this render</span>
      </button>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />

      {sample ? (
        <span className="pointer-events-none absolute right-3 top-3 rounded-sm bg-black/60 px-2 py-1 text-micro font-450 uppercase tracking-[0.12em] text-white/80 backdrop-blur">
          Sample
        </span>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
        {item.prompt ? <p className="line-clamp-2 text-sm text-white/90">{item.prompt}</p> : null}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="truncate text-micro uppercase tracking-[0.14em] text-white/55">
            {sample
              ? SEED_IS_REAL
                ? "Kinora sample"
                : "Kinora sample · placeholder render"
              : item.presetSlug
                ? `Effect · ${item.presetSlug}`
                : (item.modelLabel ?? "Kinora")}
          </span>
          <Link
            href={recreateAssetHref(item)}
            className="pointer-events-auto flex shrink-0 items-center gap-1 rounded-sm bg-white/10 px-2 py-1 text-micro font-450 uppercase tracking-[0.12em] text-white backdrop-blur transition-[opacity,background-color] hover:bg-white/20 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 group-focus-within:opacity-100 group-hover:opacity-100 sm:opacity-0"
          >
            <Repeat2 className="size-3" />
            Recreate
          </Link>
        </div>
      </div>
    </article>
  );
}

function DetailModal({
  item,
  onOpenChange,
}: {
  item: ExploreItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent>
        {item ? (
          <div className="flex flex-col gap-3">
            <DialogTitle className="sr-only">{item.prompt ?? "Public render"}</DialogTitle>

            <AssetMedia
              asset={item}
              autoPlayOnHover={false}
              className="max-h-[70vh] w-full rounded-lg !object-contain"
            />

            <div className="surface flex flex-col gap-3 p-4">
              {item.prompt ? <p className="text-sm text-muted-foreground">{item.prompt}</p> : null}

              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Model</dt>
                <dd>{item.modelLabel ?? "—"}</dd>
                {item.presetSlug ? (
                  <>
                    <dt className="text-muted-foreground">Effect</dt>
                    <dd>{item.presetSlug}</dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">Kind</dt>
                <dd className="capitalize">{item.kind}</dd>
              </dl>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" asChild>
                  <Link href={recreateAssetHref(item)}>
                    {item.presetSlug ? <Wand2 /> : <Repeat2 />}
                    Recreate this
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={item.url} download target="_blank" rel="noreferrer">
                    Download
                  </a>
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
