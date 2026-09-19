"use client";

import * as React from "react";
import { Ban, Check, Film, Loader2, ShieldAlert, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AssetActions } from "@/components/studio/lightbox";
import { AssetMedia } from "@/components/studio/asset-media";
import type { AssetView } from "@/lib/serialize";
import type { QueuedJob } from "@/hooks/use-job-queue";

/**
 * Rough render times, used only to decide when the copy says "Finishing".
 * Nothing depends on them being right — they change a word, not a state.
 */
const EXPECTED_MS: Record<QueuedJob["kind"], number> = { image: 8_000, video: 60_000 };

export function useElapsed(since: string, active: boolean) {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  return Math.max(0, now - new Date(since).getTime());
}

export function formatElapsed(ms: number) {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${seconds}s`;
}

/**
 * Stage copy, in the user's terms rather than the provider's. Shared with the
 * effect runner so one job never reads "Generating" in one place and
 * "Rendering" in another.
 */
export function stageLabel(job: { status: string; kind: QueuedJob["kind"] }, elapsed: number) {
  switch (job.status) {
    case "queued":
      return "In queue";
    case "running":
      return elapsed > EXPECTED_MS[job.kind] * 0.7 ? "Finishing" : "Generating";
    case "completed":
      return "Done";
    case "nsfw":
      return "Refused";
    case "canceled":
      return "Canceled";
    default:
      return "Failed";
  }
}

export function JobCard({
  job,
  onCancel,
  onOpen,
  onUseAsReference,
  onAnimate,
  onRecreate,
}: {
  job: QueuedJob;
  onCancel: (id: string) => void;
  onOpen: (asset: AssetView) => void;
  onUseAsReference?: (asset: AssetView) => void;
  onAnimate?: (asset: AssetView) => void;
  onRecreate?: (job: QueuedJob) => void;
}) {
  const active = job.status === "queued" || job.status === "running";
  const elapsed = useElapsed(job.createdAt, active);
  const failed = job.status === "failed" || job.status === "nsfw" || job.status === "canceled";

  const stage = stageLabel(job, elapsed);

  const count = job.kind === "video" ? 1 : Number(job.input?.num_images ?? 1);

  return (
    <article className="surface overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/70 px-4 py-2.5">
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2 py-1 text-micro font-medium uppercase tracking-[0.12em]",
            active && "bg-primary/15 text-primary",
            job.status === "completed" && "bg-emerald-500/15 text-emerald-400",
            failed && "bg-destructive/15 text-destructive",
          )}
        >
          {active ? <Loader2 className="size-3 animate-spin" /> : null}
          {job.status === "completed" ? <Check className="size-3" /> : null}
          {job.status === "failed" ? <TriangleAlert className="size-3" /> : null}
          {job.status === "nsfw" ? <ShieldAlert className="size-3" /> : null}
          {job.status === "canceled" ? <Ban className="size-3" /> : null}
          {stage}
        </span>

        <span className="text-xs tabular-nums text-muted-foreground">{formatElapsed(elapsed)}</span>

        <span className="truncate text-xs text-muted-foreground">
          · {job.costCredits} credits{failed ? " · refunded" : ""}
        </span>

        {active ? (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto shrink-0"
            onClick={() => onCancel(job.id)}
          >
            Cancel
          </Button>
        ) : onRecreate ? (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto shrink-0"
            onClick={() => onRecreate(job)}
          >
            Recreate
          </Button>
        ) : null}
      </header>

      <div className="p-4">
        <p className="line-clamp-2 text-sm text-muted-foreground">{job.prompt}</p>

        {active ? (
          <div
            className={cn(
              "mt-3 grid gap-3",
              job.kind === "video" ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3",
            )}
          >
            {Array.from({ length: count }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  "relative overflow-hidden rounded-md border border-border/70 bg-muted/50",
                  job.kind === "video" ? "aspect-video" : "aspect-square",
                )}
              >
                <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
                {job.kind === "video" ? (
                  <Film className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {failed ? (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/[0.06] p-3">
            <p className="text-sm">
              {job.status === "nsfw"
                ? "The provider refused this prompt."
                : job.status === "canceled"
                  ? "You canceled this render."
                  : "This render failed."}{" "}
              <span className="text-muted-foreground">
                {job.costCredits} credits went back to your balance.
              </span>
            </p>
            {job.error ? <p className="mt-1 text-xs text-muted-foreground">{job.error}</p> : null}
          </div>
        ) : null}

        {job.assets.length ? (
          <>
            <div
              className={cn(
                "mt-3 grid gap-3",
                job.kind === "video" ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3",
              )}
            >
              {job.assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onOpen(asset)}
                  className="block w-full overflow-hidden rounded-md border border-border/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <AssetMedia
                    asset={asset}
                    className={cn(
                      "w-full",
                      asset.kind === "video" ? "aspect-video" : "aspect-square",
                    )}
                  />
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <AssetActions
                asset={job.assets[0]}
                onUseAsReference={onUseAsReference}
                onAnimate={onAnimate}
              />
            </div>
          </>
        ) : null}
      </div>
    </article>
  );
}
