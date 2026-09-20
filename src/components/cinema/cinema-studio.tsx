"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clapperboard,
  Coins,
  Download,
  Film,
  Loader2,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Toaster, useToasts } from "@/components/ui/toast";
import { AssetMedia } from "@/components/studio/asset-media";
import { formatElapsed, stageLabel, useElapsed } from "@/components/studio/job-card";
import {
  isPlaceholder,
  PlaceholderBadge,
  PlaceholderNote,
} from "@/components/studio/placeholder-badge";
import { OptionPicker } from "@/components/cinema/option-picker";
import { ReferenceStrip } from "@/components/cinema/reference-strip";
import { useJobQueue, isActiveStatus, type QueuedJob } from "@/hooks/use-job-queue";
import { useTabTitleAlert } from "@/hooks/use-finish-alerts";
import { CreditNotice } from "@/components/credits/credit-notice";
import {
  CINEMA_STEPS,
  FRAME_COUNT,
  RIG_SLOTS,
  SCENE_MAX,
  compileFramePrompt,
  compileFrames,
  compileMotion,
  compileMotionPrompt,
  describeRig,
  optionsIn,
  toRunnable,
  type CinemaDraft,
  type CinemaStep,
} from "@/lib/cinema";
import { VIDEO_DURATIONS } from "@/lib/models";
import type { CinemaProjectView } from "@/lib/cinema-projects";
import type { AssetView } from "@/lib/serialize";

const AUTOSAVE_MS = 700;
/** Any URL is fine for a price probe; the anchor is resolved on the server. */
const PRICE_PROBE_ANCHOR = "https://kinora.invalid/anchor.png";

type SaveState = "idle" | "saving" | "saved" | "error";

export function CinemaStudio({
  initialProject,
  initialBalance,
  projects,
  initialReferenceUrls = [],
}: {
  initialProject: CinemaProjectView | null;
  initialBalance: number | null;
  projects: { id: string; title: string; step: CinemaStep; updatedAt: string }[];
  /** Set when arriving from a character; seeds the Scene step's references. */
  initialReferenceUrls?: string[];
}) {
  const router = useRouter();

  const [project, setProject] = React.useState(initialProject);
  const [draft, setDraft] = React.useState<CinemaDraft>(() => {
    const base = initialProject?.spec ?? EMPTY_DRAFT();
    return initialReferenceUrls.length
      ? { ...base, scene: { ...base.scene, referenceUrls: initialReferenceUrls } }
      : base;
  });
  const [step, setStep] = React.useState<CinemaStep>(initialProject?.step ?? "scene");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [saveState, setSaveState] = React.useState<SaveState>("idle");

  const { toasts, push, dismiss } = useToasts();
  const flagTabTitle = useTabTitleAlert();

  const onFinished = React.useCallback(
    ({ job }: { job: { id: string; status: string; kind: string } }) => {
      flagTabTitle();
      if (job.status !== "completed") {
        push({
          title: job.status === "nsfw" ? "That scene was refused" : "A render did not finish",
          description: "Your credits were refunded.",
          tone: "bad",
        });
      } else if (job.kind === "video") {
        push({
          title: "Your sequence is ready",
          description: "Saved to your library.",
          tone: "ok",
        });
      } else {
        push({ title: "Four frames are in", description: "Pick the one to animate.", tone: "ok" });
      }
      router.refresh();
    },
    [flagTabTitle, push, router],
  );

  const { jobs, balance, setBalance, replace, cancel } = useJobQueue(
    initialBalance,
    [initialProject?.frames, initialProject?.video].filter(Boolean) as QueuedJob[],
    onFinished,
  );

  const framesJob = jobs.find((job) => job.id === project?.frames?.id) ?? project?.frames ?? null;
  const videoJob = jobs.find((job) => job.id === project?.video?.id) ?? project?.video ?? null;

  /* ------------------------------------------------------------ persistence */

  const projectRef = React.useRef(project?.id ?? null);
  React.useEffect(() => {
    projectRef.current = project?.id ?? null;
  }, [project]);

  /**
   * One writer for the whole panel.
   *
   * The project row is created on the first real edit rather than on a page
   * view, so browsing /cinema never leaves a trail of empty sequences. After
   * that every change goes to the same row, which is what a refresh reads back.
   */
  const save = React.useCallback(
    async (patch: { spec?: CinemaDraft; step?: CinemaStep; anchorAssetId?: string | null }) => {
      setSaveState("saving");
      try {
        let id = projectRef.current;

        if (!id) {
          const response = await fetch("/api/cinema", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ spec: patch.spec ?? draft }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data?.error?.message ?? "Could not start a sequence.");

          setProject(data.project as CinemaProjectView);
          id = (data.project as CinemaProjectView).id;
          projectRef.current = id;
          // Keep the URL durable without adding a history entry per keystroke.
          window.history.replaceState(null, "", `/cinema?p=${id}`);
        }

        const response = await fetch(`/api/cinema/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message ?? "Could not save.");

        setProject(data.project as CinemaProjectView);
        setSaveState("saved");
      } catch (saveError) {
        setSaveState("error");
        setError(saveError instanceof Error ? saveError.message : "Could not save.");
      }
    },
    [draft],
  );

  // Autosave the panel. Debounced, because the scene box is a textarea.
  const firstRender = React.useRef(true);
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => void save({ spec: draft }), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [draft, save]);

  // Advance to the Result the moment the clip lands. The server promotes the
  // saved step too, so a tab that was closed mid-render comes back to the same
  // place rather than to an empty Motion step.
  React.useEffect(() => {
    if (videoJob?.status === "completed" && step === "motion") {
      setStep("result");
      void save({ step: "result" });
    }
  }, [videoJob?.status, step, save]);

  /* ----------------------------------------------------------------- pricing */

  const runnable = React.useMemo(() => toRunnable(draft), [draft]);
  const framesCost = runnable ? compileFrames(runnable).credits : null;
  const motionCost = runnable ? compileMotion(runnable, PRICE_PROBE_ANCHOR).credits : null;

  /* ------------------------------------------------------------- navigation */

  const reachable = (target: CinemaStep): boolean => {
    switch (target) {
      case "scene":
      case "rig":
        return true;
      case "frames":
        return Boolean(runnable);
      case "motion":
        return Boolean(project?.anchor);
      case "result":
        return Boolean(videoJob);
    }
  };

  const goTo = (target: CinemaStep) => {
    if (!reachable(target)) return;
    setStep(target);
    setError(null);
    void save({ step: target });
  };

  const index = CINEMA_STEPS.findIndex((entry) => entry.id === step);

  /* ---------------------------------------------------------------- renders */

  const render = async (stage: "frames" | "motion") => {
    setError(null);
    setPending(true);

    // A sequence that has never been saved has nothing for the server to
    // compile from, so make sure the row exists first.
    if (!projectRef.current) await save({ spec: draft });

    try {
      const response = await fetch(`/api/cinema/${projectRef.current}/render`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data?.error?.message ?? "Could not start that render.");
        return;
      }

      const next = data.project as CinemaProjectView;
      setProject(next);
      setStep(next.step);
      replace([next.frames, next.video].filter(Boolean) as QueuedJob[]);
      if (typeof data.balance === "number") setBalance(data.balance);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setPending(false);
    }
  };

  const chooseAnchor = async (asset: AssetView) => {
    setError(null);
    await save({ anchorAssetId: asset.id, step: "motion" });
    setStep("motion");
  };

  const startFresh = () => {
    projectRef.current = null;
    setProject(null);
    setDraft(EMPTY_DRAFT());
    setStep("scene");
    setError(null);
    replace([]);
    window.history.replaceState(null, "", "/cinema?new=1");
  };

  /* -------------------------------------------------------------------- UI */

  return (
    <>
      <StepBar step={step} reachable={reachable} onGo={goTo} saveState={saveState} />

      {error ? (
        <div
          role="alert"
          className="mt-4 flex gap-2 rounded-md border border-destructive/30 bg-destructive/[0.06] p-3 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {step === "scene" ? (
            <SceneStep draft={draft} onChange={setDraft} onError={setError} />
          ) : null}

          {step === "rig" ? <RigStep draft={draft} onChange={setDraft} /> : null}

          {step === "frames" ? (
            <FramesStep
              job={framesJob}
              cost={framesCost}
              balance={balance}
              pending={pending}
              anchorId={project?.anchor?.id ?? null}
              onRender={() => void render("frames")}
              onCancel={cancel}
              onChoose={(asset) => void chooseAnchor(asset)}
            />
          ) : null}

          {step === "motion" ? (
            <MotionStep
              draft={draft}
              onChange={setDraft}
              anchor={project?.anchor ?? null}
              job={videoJob}
              cost={motionCost}
              balance={balance}
              pending={pending}
              onRender={() => void render("motion")}
              onCancel={cancel}
            />
          ) : null}

          {step === "result" ? (
            <ResultStep draft={draft} job={videoJob} onStartFresh={startFresh} />
          ) : null}

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              disabled={index <= 0}
              onClick={() => goTo(CINEMA_STEPS[index - 1].id)}
            >
              <ArrowLeft />
              Back
            </Button>
            <Button
              variant="outline"
              disabled={index >= CINEMA_STEPS.length - 1 || !reachable(CINEMA_STEPS[index + 1].id)}
              onClick={() => goTo(CINEMA_STEPS[index + 1].id)}
            >
              Next
              <ArrowRight />
            </Button>
          </div>
        </div>

        <Slate
          draft={draft}
          runnable={Boolean(runnable)}
          balance={balance}
          projects={projects}
          currentId={project?.id ?? null}
          onStartFresh={startFresh}
        />
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

function EMPTY_DRAFT(): CinemaDraft {
  // Built through the same helper the server uses, so the two agree on what a
  // fresh panel looks like.
  return {
    scene: { text: "", referenceUrls: [] },
    rig: Object.fromEntries(
      RIG_SLOTS.map((slot) => [slot.key, optionsIn(slot.group)[0].id]),
    ) as CinemaDraft["rig"],
    motion: optionsIn("motions")[0].id,
    duration: 6,
  };
}

/* ------------------------------------------------------------------ pieces */

function StepBar({
  step,
  reachable,
  onGo,
  saveState,
}: {
  step: CinemaStep;
  reachable: (step: CinemaStep) => boolean;
  onGo: (step: CinemaStep) => void;
  saveState: SaveState;
}) {
  const index = CINEMA_STEPS.findIndex((entry) => entry.id === step);

  return (
    <div className="mt-6">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {CINEMA_STEPS.map((entry, i) => {
          const done = i < index;
          const open = reachable(entry.id);
          return (
            <button
              key={entry.id}
              type="button"
              disabled={!open}
              onClick={() => onGo(entry.id)}
              aria-current={entry.id === step ? "step" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-sm border px-3 py-1.5 text-xs transition-colors",
                entry.id === step
                  ? "border-primary/50 bg-primary/[0.08] text-foreground"
                  : open
                    ? "border-border text-muted-foreground hover:text-foreground"
                    : "border-border text-muted-foreground/50",
              )}
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-sm text-micro",
                  done ? "bg-primary/20 text-primary" : "bg-secondary",
                )}
              >
                {done ? <Check className="size-2.5" /> : i + 1}
              </span>
              {entry.label}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
        {CINEMA_STEPS[index]?.hint}
        {saveState === "saving" ? " · saving…" : null}
        {saveState === "saved" ? " · saved" : null}
        {saveState === "error" ? " · not saved" : null}
      </p>
    </div>
  );
}

function SceneStep({
  draft,
  onChange,
  onError,
}: {
  draft: CinemaDraft;
  onChange: (draft: CinemaDraft) => void;
  onError: (message: string | null) => void;
}) {
  return (
    <div className="surface flex flex-col gap-4 p-4">
      <div>
        <label htmlFor="scene" className="eyebrow">
          The shot
        </label>
        <textarea
          id="scene"
          rows={6}
          maxLength={SCENE_MAX}
          value={draft.scene.text}
          onChange={(event) =>
            onChange({ ...draft, scene: { ...draft.scene, text: event.target.value } })
          }
          placeholder="A lone figure waits at the end of an empty subway platform, the last train long gone…"
          className="mt-2 w-full resize-none rounded-md border border-input bg-background/60 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Say what is in frame and what is happening. The rig handles how it is shot —{" "}
          {draft.scene.text.length}/{SCENE_MAX}.
        </p>
      </div>

      <Separator />

      <div>
        <p className="eyebrow">References</p>
        <div className="mt-2">
          <ReferenceStrip
            urls={draft.scene.referenceUrls}
            onChange={(referenceUrls) =>
              onChange({ ...draft, scene: { ...draft.scene, referenceUrls } })
            }
            onError={onError}
          />
        </div>
      </div>
    </div>
  );
}

function RigStep({
  draft,
  onChange,
}: {
  draft: CinemaDraft;
  onChange: (draft: CinemaDraft) => void;
}) {
  return (
    <div className="surface flex flex-col gap-5 p-4">
      {RIG_SLOTS.map((slot) => (
        <OptionPicker
          key={slot.key}
          group={slot.group}
          label={slot.label}
          value={draft.rig[slot.key]}
          onChange={(id) => onChange({ ...draft, rig: { ...draft.rig, [slot.key]: id } })}
        />
      ))}
    </div>
  );
}

function FramesStep({
  job,
  cost,
  balance,
  pending,
  anchorId,
  onRender,
  onCancel,
  onChoose,
}: {
  job: QueuedJob | null;
  cost: number | null;
  balance: number | null;
  pending: boolean;
  anchorId: string | null;
  onRender: () => void;
  onCancel: (id: string) => void;
  onChoose: (asset: AssetView) => void;
}) {
  const active = job ? isActiveStatus(job.status) : false;
  const elapsed = useElapsed(job?.createdAt ?? new Date().toISOString(), active);

  return (
    <div className="surface flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Four candidates</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Widescreen stills from the same prompt. Pick the one to animate.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Coins className="size-3.5 text-primary" />
            {cost === null ? "—" : `${cost} credits`}
            {balance !== null ? <span className="opacity-60">· {balance} left</span> : null}
          </span>
          <Button size="sm" onClick={onRender} disabled={pending || active || cost === null}>
            {job ? <RefreshCw /> : <Sparkles />}
            {pending ? "Sending…" : job ? "Render again" : `Render ${FRAME_COUNT} frames`}
          </Button>
        </div>
      </div>

      {job ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-sm px-2 py-1 text-micro font-450 uppercase tracking-[0.12em]",
              active && "bg-primary/15 text-primary",
              job.status === "completed" && "bg-emerald-500/15 text-emerald-400",
              !active && job.status !== "completed" && "bg-destructive/15 text-destructive",
            )}
          >
            {active ? <Loader2 className="size-3 animate-spin" /> : null}
            {stageLabel(job, elapsed)}
          </span>
          {job.status === "completed" && isPlaceholder(job.provider) ? <PlaceholderBadge /> : null}
          <span className="text-xs tabular-nums text-muted-foreground">
            {formatElapsed(elapsed)}
          </span>
          {active ? (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onCancel(job.id)}>
              Cancel
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: FRAME_COUNT }).map((_, i) => {
          const asset = job?.assets[i];
          if (asset) {
            const chosen = asset.id === anchorId;
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => onChoose(asset)}
                aria-pressed={chosen}
                className={cn(
                  "group relative overflow-hidden rounded-md border-2 transition-colors",
                  chosen ? "border-primary" : "border-transparent hover:border-primary/40",
                )}
              >
                <AssetMedia asset={asset} className="aspect-video w-full" />
                <span
                  className={cn(
                    "absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/70 py-1.5 text-micro uppercase tracking-[0.12em] text-white transition-opacity",
                    chosen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  )}
                >
                  {chosen ? <Check className="size-3" /> : null}
                  {chosen ? "Anchor" : "Use as anchor"}
                </span>
              </button>
            );
          }

          return (
            <div
              key={i}
              className="relative aspect-video overflow-hidden rounded-md border border-border bg-muted/40"
            >
              {active ? (
                <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
              ) : (
                <Film className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>

      {job && !active && job.status !== "completed" ? (
        <p className="text-xs text-muted-foreground">
          That render did not finish. {job.costCredits} credits went back to your balance.
        </p>
      ) : null}

      <CreditNotice balance={balance} cost={cost} />
    </div>
  );
}

function MotionStep({
  draft,
  onChange,
  anchor,
  job,
  cost,
  balance,
  pending,
  onRender,
  onCancel,
}: {
  draft: CinemaDraft;
  onChange: (draft: CinemaDraft) => void;
  anchor: AssetView | null;
  job: QueuedJob | null;
  cost: number | null;
  balance: number | null;
  pending: boolean;
  onRender: () => void;
  onCancel: (id: string) => void;
}) {
  const active = job ? isActiveStatus(job.status) : false;
  const elapsed = useElapsed(job?.createdAt ?? new Date().toISOString(), active);

  return (
    <div className="surface flex flex-col gap-5 p-4">
      <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
        <div>
          <p className="eyebrow">Anchor frame</p>
          <div className="mt-2 overflow-hidden rounded-md border border-border">
            {anchor ? (
              <AssetMedia asset={anchor} className="aspect-video w-full" />
            ) : (
              <div className="flex aspect-video items-center justify-center text-xs text-muted-foreground">
                None picked
              </div>
            )}
          </div>
        </div>

        <OptionPicker
          group="motions"
          label="Camera move"
          value={draft.motion}
          onChange={(motion) => onChange({ ...draft, motion })}
        />
      </div>

      <div>
        <p className="eyebrow">Length</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {VIDEO_DURATIONS.map((duration) => (
            <button
              key={duration}
              type="button"
              onClick={() => onChange({ ...draft, duration })}
              aria-pressed={duration === draft.duration}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs transition-colors",
                duration === draft.duration
                  ? "bg-secondary text-foreground"
                  : "border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {duration}s
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {job ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-sm px-2 py-1 text-micro font-450 uppercase tracking-[0.12em]",
              active && "bg-primary/15 text-primary",
              job.status === "completed" && "bg-emerald-500/15 text-emerald-400",
              !active && job.status !== "completed" && "bg-destructive/15 text-destructive",
            )}
          >
            {active ? <Loader2 className="size-3 animate-spin" /> : null}
            {stageLabel(job, elapsed)}
          </span>
          {job.status === "completed" && isPlaceholder(job.provider) ? <PlaceholderBadge /> : null}
          <span className="text-xs tabular-nums text-muted-foreground">
            {formatElapsed(elapsed)}
          </span>
          {active ? (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onCancel(job.id)}>
              Cancel
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Coins className="size-3.5 text-primary" />
          {cost === null ? "—" : `${cost} credits`}
          {balance !== null ? <span className="opacity-60">· {balance} left</span> : null}
        </span>
        <Button size="sm" onClick={onRender} disabled={pending || active || !anchor}>
          <Clapperboard />
          {pending ? "Sending…" : job ? "Render again" : "Render the clip"}
        </Button>
      </div>

      {!anchor ? (
        <p className="text-xs text-muted-foreground">
          Go back to Frames and pick the still this clip starts from.
        </p>
      ) : null}

      <CreditNotice balance={balance} cost={cost} />
    </div>
  );
}

function ResultStep({
  draft,
  job,
  onStartFresh,
}: {
  draft: CinemaDraft;
  job: QueuedJob | null;
  onStartFresh: () => void;
}) {
  const asset = job?.assets[0];
  const runnable = toRunnable(draft);

  return (
    <div className="flex flex-col gap-4">
      <div className="surface overflow-hidden">
        {asset ? (
          <AssetMedia asset={asset} autoPlayOnHover={false} className="aspect-video w-full" />
        ) : (
          <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
            Nothing rendered yet.
          </div>
        )}

        {asset ? (
          <div className="flex flex-wrap gap-2 border-t border-border p-3">
            <Button size="sm" variant="secondary" asChild>
              <a href={asset.url} download target="_blank" rel="noreferrer">
                <Download />
                Download
              </a>
            </Button>
            {job ? (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/video?recreate=${job.id}`}>
                  <RefreshCw />
                  Recreate
                </Link>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={onStartFresh}>
              <Sparkles />
              New sequence
            </Button>
          </div>
        ) : null}
      </div>

      {runnable ? (
        <div className="surface flex flex-col gap-4 p-4">
          <div>
            <p className="eyebrow">Compiled frame prompt</p>
            <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
              {compileFramePrompt(runnable)}
            </p>
          </div>
          <Separator />
          <div>
            <p className="eyebrow">Compiled motion prompt</p>
            <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
              {compileMotionPrompt(runnable)}
            </p>
          </div>
          {job ? (
            <p className="text-xs text-muted-foreground">
              Rendered as sent:{" "}
              {job.prompt === compileMotionPrompt(runnable)
                ? "unchanged"
                : "the panel has been edited since"}
              .
            </p>
          ) : null}
          {job && isPlaceholder(job.provider) ? <PlaceholderNote /> : null}
        </div>
      ) : null}
    </div>
  );
}

/** The sidebar: what the panel currently reads as, and the other sequences. */
function Slate({
  draft,
  runnable,
  balance,
  projects,
  currentId,
  onStartFresh,
}: {
  draft: CinemaDraft;
  runnable: boolean;
  balance: number | null;
  projects: { id: string; title: string; step: CinemaStep; updatedAt: string }[];
  currentId: string | null;
  onStartFresh: () => void;
}) {
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
      <div className="surface flex flex-col gap-3 p-4">
        <p className="eyebrow">Slate</p>
        <p className="text-sm">{describeRig(draft.rig)}</p>
        <p className="text-xs text-muted-foreground">
          {optionsIn("genres").find((option) => option.id === draft.rig.genre)?.label} ·{" "}
          {optionsIn("lighting").find((option) => option.id === draft.rig.lighting)?.label} ·{" "}
          {optionsIn("motions").find((option) => option.id === draft.motion)?.label} ·{" "}
          {draft.duration}s
        </p>
        {balance !== null ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Coins className="size-3.5 text-primary" />
            {balance} credits left
          </p>
        ) : null}
        {!runnable ? (
          <p className="text-xs text-muted-foreground">
            Add a scene description to start rendering.
          </p>
        ) : null}
      </div>

      {projects.length ? (
        <div className="surface flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Sequences</p>
            <Button size="sm" variant="ghost" className="-mr-2 h-auto py-1" onClick={onStartFresh}>
              New
            </Button>
          </div>
          {projects.map((entry) => (
            <Link
              key={entry.id}
              href={`/cinema?p=${entry.id}`}
              className={cn(
                "truncate rounded-md px-2 py-1.5 text-xs transition-colors",
                entry.id === currentId
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.title}
              <span className="ml-1.5 opacity-60">· {entry.step}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
