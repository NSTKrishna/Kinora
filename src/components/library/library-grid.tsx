"use client";

import * as React from "react";
import Link from "next/link";
import { Download, Eye, EyeOff, FolderOpen, Loader2, RefreshCw, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { AssetMedia } from "@/components/studio/asset-media";
import { Lightbox } from "@/components/studio/lightbox";
import type { AssetView } from "@/lib/serialize";

type Filter = "all" | "image" | "video";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "video", label: "Videos" },
];

type Page = { assets: AssetView[]; nextCursor: string | null };

export function LibraryGrid({ initial }: { initial: Page }) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [assets, setAssets] = React.useState<AssetView[]>(initial.assets);
  const [cursor, setCursor] = React.useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lightboxAsset, setLightboxAsset] = React.useState<AssetView | null>(null);
  const [publicIds, setPublicIds] = React.useState<Set<string>>(
    () => new Set(initial.assets.filter((asset) => asset.isPublic).map((asset) => asset.id)),
  );

  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const requestRef = React.useRef(0);

  const load = React.useCallback(
    async (nextFilter: Filter, nextCursor: string | null, replace: boolean) => {
      const token = ++requestRef.current;
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ filter: nextFilter });
        if (nextCursor) params.set("cursor", nextCursor);

        const response = await fetch(`/api/assets?${params}`, { cache: "no-store" });
        const data = await response.json();
        // A slow page must not overwrite a newer filter's results.
        if (token !== requestRef.current) return;

        if (!response.ok) {
          setError(data?.error?.message ?? "Could not load your library.");
          return;
        }

        const page = data as Page;
        setAssets((current) => (replace ? page.assets : [...current, ...page.assets]));
        setPublicIds((current) => {
          const next = replace ? new Set<string>() : new Set(current);
          for (const asset of page.assets) if (asset.isPublic) next.add(asset.id);
          return next;
        });
        setCursor(page.nextCursor);
      } catch {
        if (token === requestRef.current) setError("Could not reach the server.");
      } finally {
        if (token === requestRef.current) setLoading(false);
      }
    },
    [],
  );

  const changeFilter = (next: Filter) => {
    if (next === filter) return;
    setFilter(next);
    setAssets([]);
    setCursor(null);
    void load(next, null, true);
  };

  // Infinite scroll: fetch the next page as the sentinel comes into view.
  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !cursor || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void load(filter, cursor, false);
      },
      { rootMargin: "400px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, filter, load, loading]);

  const remove = async (asset: AssetView) => {
    const previous = assets;
    setAssets((current) => current.filter((item) => item.id !== asset.id));
    setLightboxAsset(null);

    const response = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
    if (!response.ok) {
      setAssets(previous);
      setError("Could not delete that item.");
    }
  };

  const togglePublic = async (asset: AssetView) => {
    const next = !publicIds.has(asset.id);
    setPublicIds((current) => {
      const updated = new Set(current);
      if (next) updated.add(asset.id);
      else updated.delete(asset.id);
      return updated;
    });

    const response = await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isPublic: next }),
    });

    if (!response.ok) {
      setPublicIds((current) => {
        const reverted = new Set(current);
        if (next) reverted.delete(asset.id);
        else reverted.add(asset.id);
        return reverted;
      });
      setError("Could not change sharing for that item.");
    }
  };

  const showEmpty = !loading && !error && assets.length === 0;

  return (
    <>
      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto">
        {FILTERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => changeFilter(entry.id)}
            aria-pressed={entry.id === filter}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors",
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
          title="Your library did not load"
          description={error}
          action={
            <Button variant="outline" onClick={() => void load(filter, null, true)}>
              Try again
            </Button>
          }
          className="mt-6"
        />
      ) : null}

      {showEmpty ? (
        <EmptyState
          icon={<FolderOpen />}
          title={filter === "all" ? "Your library is empty" : `No ${filter}s yet`}
          description="Renders are kept for guests too — start one and it will be waiting here when you come back."
          action={
            <div className="flex gap-2">
              <Button asChild>
                <Link href="/image">Generate an image</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/video">Generate a video</Link>
              </Button>
            </div>
          }
          className="mt-6"
        />
      ) : null}

      {assets.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assets.map((asset) => {
            const isPublic = publicIds.has(asset.id);
            return (
              <article
                key={asset.id}
                className="group relative overflow-hidden rounded-lg border border-border/70 bg-card"
              >
                <button
                  type="button"
                  onClick={() => setLightboxAsset(asset)}
                  className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <AssetMedia
                    asset={asset}
                    className={cn(
                      "w-full",
                      asset.kind === "video" ? "aspect-video" : "aspect-square",
                    )}
                  />
                </button>

                <div className="flex items-center gap-1 border-t border-border/70 px-2 py-1.5">
                  <span className="truncate text-micro uppercase tracking-[0.12em] text-muted-foreground">
                    {asset.kind}
                    {isPublic ? " · public" : ""}
                  </span>

                  <div className="ml-auto flex shrink-0 items-center">
                    {asset.jobId ? (
                      <Button size="icon" variant="ghost" asChild title="Recreate">
                        <Link
                          href={`/${asset.kind === "video" ? "video" : "image"}?recreate=${asset.jobId}`}
                        >
                          <RefreshCw />
                          <span className="sr-only">Recreate</span>
                        </Link>
                      </Button>
                    ) : null}

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => void togglePublic(asset)}
                      title={isPublic ? "Make private" : "Make public"}
                    >
                      {isPublic ? <Eye /> : <EyeOff />}
                      <span className="sr-only">{isPublic ? "Make private" : "Make public"}</span>
                    </Button>

                    <Button size="icon" variant="ghost" asChild title="Download">
                      <a href={asset.url} download target="_blank" rel="noreferrer">
                        <Download />
                        <span className="sr-only">Download</span>
                      </a>
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => void remove(asset)}
                      title="Delete"
                      className="hover:text-destructive"
                    >
                      <Trash2 />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      ) : null}

      {/* Infinite-scroll sentinel */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      <Lightbox asset={lightboxAsset} onOpenChange={(open) => !open && setLightboxAsset(null)} />
    </>
  );
}
