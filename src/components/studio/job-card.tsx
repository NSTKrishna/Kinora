"use client";

import * as React from "react";
import { Ban, Check, Loader2, ShieldAlert, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AssetActions } from "@/components/studio/lightbox";
import type { AssetView } from "@/lib/serialize";
import type { QueuedJob } from "@/hooks/use-job-queue";

const STATUS_COPY: Record<
  QueuedJob["status"],
  { label: string; tone: "pending" | "done" | "bad"; icon: React.ReactNode }
> = {
  queued: { label: "Queued", tone: "pending", icon: <Loader2 className="size-3 animate-spin" /> },
  running: {
    label: "Rendering",
    tone: "pending",
    icon: <Loader2 className="size-3 animate-spin" />,
  },
  completed: { label: "Done", tone: "done", icon: <Check className="size-3" /> },
  failed: { label: "Failed", tone: "bad", icon: <TriangleAlert className="size-3" /> },
  nsfw: { label: "Refused", tone: "bad", icon: <ShieldAlert className="size-3" /> },
  canceled: { label: "Canceled", tone: "bad", icon: <Ban className="size-3" /> },
};

export function JobCard({
  job,
  onCancel,
  onOpen,
  onUseAsReference,
}: {
  job: QueuedJob;
  onCancel: (id: string) => void;
  onOpen: (asset: AssetView) => void;
  onUseAsReference: (asset: AssetView) => void;
}) {
  const status = STATUS_COPY[job.status];
  const isPending = status.tone === "pending";
  const failed = status.tone === "bad";
  const count = Number(job.input?.num_images ?? 1);

  return (
    <article className="surface overflow-hidden">
      <header className="flex items-center gap-3 border-b border-border/70 px-4 py-2.5">
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2 py-1 text-micro font-medium uppercase tracking-[0.12em]",
            status.tone === "pending" && "bg-primary/15 text-primary",
            status.tone === "done" && "bg-emerald-500/15 text-emerald-400",
            status.tone === "bad" && "bg-destructive/15 text-destructive",
          )}
        >
          {status.icon}
          {status.label}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {job.costCredits} credits
          {failed ? " · refunded" : ""}
        </span>
        {isPending ? (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto shrink-0"
            onClick={() => onCancel(job.id)}
          >
            Cancel
          </Button>
        ) : null}
      </header>

      <div className="p-4">
        <p className="line-clamp-2 text-sm text-muted-foreground">{job.prompt}</p>

        {isPending ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: count }).map((_, index) => (
              <div
                key={index}
                className="relative aspect-square overflow-hidden rounded-md border border-border/70 bg-muted/50"
              >
                <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
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
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {job.assets.map((asset) => (
              <figure key={asset.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onOpen(asset)}
                  className="block w-full overflow-hidden rounded-md border border-border/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.url}
                    alt={asset.prompt ?? "Generated image"}
                    className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                </button>
              </figure>
            ))}
          </div>
        ) : null}

        {job.assets.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <AssetActions asset={job.assets[0]} onUseAsReference={onUseAsReference} />
          </div>
        ) : null}
      </div>
    </article>
  );
}
