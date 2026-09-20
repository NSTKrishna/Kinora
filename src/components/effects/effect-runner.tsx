"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  Check,
  Coins,
  Download,
  Eye,
  EyeOff,
  Film,
  Loader2,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  Wand2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toaster, useToasts } from "@/components/ui/toast";
import { ImageField } from "@/components/studio/image-field";
import { CreditNotice } from "@/components/credits/credit-notice";
import { AssetMedia } from "@/components/studio/asset-media";
import { formatElapsed, stageLabel, useElapsed } from "@/components/studio/job-card";
import { useJobQueue, isActiveStatus, type QueuedJob } from "@/hooks/use-job-queue";
import { useTabTitleAlert } from "@/hooks/use-finish-alerts";
import type { EffectView } from "@/lib/presets";
import type { AssetView } from "@/lib/serialize";

/**
 * The whole of an effect page below the title.
 *
 * The example is always on screen so there is a reference to judge the result
 * against, and the result tile is present from the first paint — empty, then
 * rendering, then the clip — so nothing on the page moves while you wait.
 */
export function EffectRunner({
  effect,
  initialBalance,
  initialJobs,
}: {
  effect: EffectView;
  initialBalance: number | null;
  initialJobs: QueuedJob[];
}) {
  const router = useRouter();
  const photoSlot = effect.inputSlots.find((slot) => slot.required) ?? effect.inputSlots[0];

  const [photo, setPhoto] = React.useState("");
  const [extra, setExtra] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const { toasts, push, dismiss } = useToasts();
  const flagTabTitle = useTabTitleAlert();

  const onFinished = React.useCallback(
    ({ job }: { job: { status: string } }) => {
      flagTabTitle();
      if (job.status === "completed") {
        push({
          title: `${effect.title} is ready`,
          description: "Saved to your library.",
          tone: "ok",
        });
      } else {
        push({
          title: job.status === "nsfw" ? "That photo was refused" : "The render did not finish",
          description: "Your credits were refunded.",
          tone: "bad",
        });
      }
      router.refresh();
    },
    [effect.title, flagTabTitle, push, router],
  );

  const { jobs, balance, submitEffect, cancel } = useJobQueue(
    initialBalance,
    initialJobs,
    onFinished,
  );

  // The newest run owns the result tile; older ones sit in the history strip.
  const current = jobs[0];
  const history = jobs.slice(1).filter((job) => job.assets.length > 0);

  const onGenerate = async () => {
    setError(null);
    setPending(true);
    const result = await submitEffect(effect.slug, photo, extra);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  };

  return (
    <>
      {/* On a phone this reads example -> composer -> result, so the Generate
          button is not stranded below two video tiles. On a wide screen the
          result sits beside the example, which is what you compare it to. */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_380px] lg:gap-6">
        <figure className="surface order-1 overflow-hidden lg:order-none lg:col-start-1 lg:row-start-1">
          <video
            src={effect.exampleUrl ?? undefined}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            aria-label={`${effect.title} example`}
            className="aspect-video w-full bg-black object-cover"
          />
          <figcaption className="border-t border-border px-4 py-2.5">
            <p className="eyebrow">Example</p>
            <p className="mt-1 text-xs text-muted-foreground">
              A reference loop rendered by us — not your photo.
            </p>
          </figcaption>
        </figure>

        {/* --------------------------------------------------- composer */}
        <aside className="surface order-2 flex flex-col gap-4 p-4 lg:sticky lg:top-24 lg:order-none lg:col-start-3 lg:row-start-1 lg:self-start">
          <div>
            <p className="eyebrow">{photoSlot?.label ?? "Your photo"}</p>
            <div className="mt-2">
              <ImageField
                id="effect-photo"
                label={photoSlot?.label ?? "Your photo"}
                value={photo}
                onChange={(url) => {
                  setPhoto(url);
                  setError(null);
                }}
                onError={setError}
                large
              />
            </div>
            {photoSlot?.help ? (
              <p className="mt-1.5 text-xs text-muted-foreground">{photoSlot.help}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="effect-extra" className="eyebrow">
              Extra direction <span className="normal-case opacity-60">— optional</span>
            </label>
            <textarea
              id="effect-extra"
              rows={3}
              value={extra}
              maxLength={400}
              onChange={(event) => setExtra(event.target.value)}
              placeholder="Anything to add: time of day, mood, what they are wearing…"
              className="mt-2 w-full resize-none rounded-md border border-input bg-background/60 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              The effect writes the shot. This is added on the end.
            </p>
          </div>

          {error ? (
            <div
              role="alert"
              className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/[0.06] p-3 text-sm"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Coins className="size-3.5 text-primary" />
              {effect.credits} credits
              {balance !== null ? <span className="opacity-60">· {balance} left</span> : null}
            </span>
            <Button size="sm" onClick={onGenerate} disabled={pending || !photo}>
              <Sparkles />
              {pending ? "Sending…" : "Generate"}
            </Button>
          </div>

          {!photo ? (
            <p className="text-xs text-muted-foreground">Add a photo to run this effect.</p>
          ) : null}

          <CreditNotice balance={balance} cost={effect.credits} />

          {current ? <HowItWasMade job={current} effect={effect} /> : null}
        </aside>

        <ResultPanel
          job={current}
          effect={effect}
          onCancel={cancel}
          onError={setError}
          onToast={push}
          className="order-3 lg:order-none lg:col-start-2 lg:row-start-1"
        />
      </div>

      {history.length ? (
        <section className="mt-8">
          <p className="eyebrow">Your earlier runs</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {history.map((job) =>
              job.assets.map((asset) => (
                <div
                  key={asset.id}
                  className="overflow-hidden rounded-lg border border-border bg-card"
                >
                  <AssetMedia asset={asset} className="aspect-video w-full" />
                </div>
              )),
            )}
          </div>
        </section>
      ) : null}

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

/* -------------------------------------------------------------- result */

function ResultPanel({
  job,
  effect,
  onCancel,
  onError,
  onToast,
  className,
}: {
  job?: QueuedJob;
  effect: EffectView;
  onCancel: (id: string) => void;
  onError: (message: string) => void;
  onToast: (toast: { title: string; description?: string; tone: "ok" | "bad" }) => void;
  className?: string;
}) {
  const active = job ? isActiveStatus(job.status) : false;
  const elapsed = useElapsed(job?.createdAt ?? new Date().toISOString(), active);
  const asset = job?.assets[0];
  const failed =
    job && (job.status === "failed" || job.status === "nsfw" || job.status === "canceled");

  return (
    <div className={cn("surface flex flex-col overflow-hidden", className)}>
      <div className="relative aspect-video w-full bg-muted/40">
        {asset ? (
          <AssetMedia asset={asset} className="h-full w-full" />
        ) : active ? (
          <>
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
            <Film className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
            {failed ? (
              <>
                {job?.status === "nsfw" ? (
                  <ShieldAlert className="size-5" />
                ) : job?.status === "canceled" ? (
                  <Ban className="size-5" />
                ) : (
                  <TriangleAlert className="size-5" />
                )}
                <p className="text-sm">
                  {job?.status === "nsfw"
                    ? "That photo was refused."
                    : job?.status === "canceled"
                      ? "You canceled this run."
                      : "This run failed."}
                </p>
                <p className="text-xs">{job?.costCredits} credits went back to your balance.</p>
              </>
            ) : (
              <>
                <Wand2 className="size-5" />
                <p className="text-sm">Your clip lands here</p>
                <p className="text-xs">Usually under a minute once it starts.</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="eyebrow">Your result</p>
          {job ? (
            <>
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-micro font-450 uppercase tracking-[0.12em]",
                  active && "bg-primary/15 text-primary",
                  job.status === "completed" && "bg-emerald-500/15 text-emerald-400",
                  failed && "bg-destructive/15 text-destructive",
                )}
              >
                {active ? <Loader2 className="size-3 animate-spin" /> : null}
                {job.status === "completed" ? <Check className="size-3" /> : null}
                {stageLabel(job, elapsed)}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatElapsed(elapsed)}
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
              ) : null}
            </>
          ) : null}
        </div>

        {asset ? (
          <ResultActions asset={asset} onError={onError} onToast={onToast} />
        ) : (
          <p className="text-xs text-muted-foreground">
            {active
              ? "Leaving the page is safe — the render keeps going."
              : `${effect.title} costs ${effect.credits} credits per run.`}
          </p>
        )}
      </div>
    </div>
  );
}

function ResultActions({
  asset,
  onError,
  onToast,
}: {
  asset: AssetView;
  onError: (message: string) => void;
  onToast: (toast: { title: string; description?: string; tone: "ok" | "bad" }) => void;
}) {
  const [isPublic, setIsPublic] = React.useState(asset.isPublic);

  // Optimistic, with a rollback: sharing state must never claim more than the
  // server agreed to.
  const togglePublic = async () => {
    const next = !isPublic;
    setIsPublic(next);

    const response = await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isPublic: next }),
    });

    if (!response.ok) {
      setIsPublic(!next);
      onError("Could not change sharing for that clip.");
      return;
    }
    onToast({
      title: next ? "Shared to Explore" : "Made private",
      tone: "ok",
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" asChild>
        <a href={asset.url} download target="_blank" rel="noreferrer">
          <Download />
          Download
        </a>
      </Button>
      <Button size="sm" variant="outline" onClick={() => void togglePublic()}>
        {isPublic ? <Eye /> : <EyeOff />}
        {isPublic ? "Public" : "Make public"}
      </Button>
      <Button size="sm" variant="outline" asChild>
        <Link href="/effects">
          <Wand2 />
          Try another effect
        </Link>
      </Button>
    </div>
  );
}

/* ----------------------------------------------------- how it was made */

const HIDDEN_PARAMS = new Set(["prompt", "image_url", "generate_audio"]);

/**
 * The compiled prompt, plainly. An effect is a black box by design, and this is
 * the door out of it: read what was actually sent, then go build it by hand in
 * the composer.
 */
function HowItWasMade({ job, effect }: { job: QueuedJob; effect: EffectView }) {
  const params = Object.entries((job.input ?? {}) as Record<string, unknown>).filter(
    ([key, value]) => !HIDDEN_PARAMS.has(key) && value !== undefined && value !== null,
  );

  return (
    <details className="group rounded-md border border-border">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
        How this was made
        <span className="float-right opacity-60 group-open:hidden">show</span>
        <span className="float-right hidden opacity-60 group-open:inline">hide</span>
      </summary>

      <div className="flex flex-col gap-3 border-t border-border px-3 py-3">
        <div>
          <p className="eyebrow">Compiled prompt</p>
          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
            {job.prompt}
          </p>
        </div>

        <div>
          <p className="eyebrow">Settings</p>
          <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <dt>Model</dt>
            <dd className="text-right text-foreground">{effect.modelId}</dd>
            {params.map(([key, value]) => (
              <React.Fragment key={key}>
                <dt>{key.replace(/_/g, " ")}</dt>
                <dd className="text-right text-foreground">{String(value)}</dd>
              </React.Fragment>
            ))}
            <dt>Cost</dt>
            <dd className="text-right text-foreground">{job.costCredits} credits</dd>
          </dl>
        </div>

        <Button size="sm" variant="outline" asChild>
          <Link href={`/video?recreate=${job.id}`}>Open in the composer</Link>
        </Button>
      </div>
    </details>
  );
}
