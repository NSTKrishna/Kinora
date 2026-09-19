"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Coins, Film, ImagePlus, Info, Sparkles, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Toaster, useToasts } from "@/components/ui/toast";
import { EmptyState } from "@/components/empty-state";
import { JobCard } from "@/components/studio/job-card";
import { Lightbox } from "@/components/studio/lightbox";
import { ImageField } from "@/components/studio/image-field";
import { useJobQueue, type QueuedJob } from "@/hooks/use-job-queue";
import { useTabTitleAlert } from "@/hooks/use-finish-alerts";
import { MODELS, type AnyModel, type FieldSpec, type ModelId } from "@/lib/models";
import { attachReferences, referenceCapacity, type CharacterView } from "@/lib/characters";
import { CreditNotice } from "@/components/credits/credit-notice";
import type { AssetView } from "@/lib/serialize";

type Values = Record<string, string>;

export type StudioPrefill = {
  modelId?: ModelId;
  prompt?: string;
  values?: Values;
  characterId?: string;
};

function defaultsFor(model: AnyModel): Values {
  const parsed = model.schema.safeParse({ prompt: "placeholder prompt" });
  const base = parsed.success ? (parsed.data as Record<string, unknown>) : {};
  const values: Values = {};
  for (const field of model.fields) {
    const value = base[field.name];
    values[field.name] = value === undefined || value === null ? "" : String(value);
  }
  return values;
}

/** Empty strings mean "not set" — drop them so schema defaults apply. */
function toInput(prompt: string, values: Values): Record<string, unknown> {
  const input: Record<string, unknown> = { prompt };
  for (const [key, value] of Object.entries(values)) {
    if (value !== "") input[key] = value;
  }
  return input;
}

/** Carry over any field the new model also has, so switching is not a reset. */
function pickShared(values: Values, model: AnyModel): Values {
  const shared: Values = {};
  for (const field of model.fields) {
    if (values[field.name]) shared[field.name] = values[field.name];
  }
  return shared;
}

export function Studio({
  kind,
  modelIds,
  initialBalance,
  initialJobs,
  prefill,
  characters = [],
}: {
  kind: "image" | "video";
  /** Ids only: registry entries hold zod schemas and functions, which cannot
   *  cross the server/client boundary. The client reads the registry itself. */
  modelIds: ModelId[];
  initialBalance: number | null;
  initialJobs: QueuedJob[];
  prefill?: StudioPrefill;
  characters?: CharacterView[];
}) {
  const router = useRouter();
  const models = React.useMemo(() => modelIds.map((id) => MODELS[id]), [modelIds]);

  const [modelId, setModelId] = React.useState<ModelId>(prefill?.modelId ?? modelIds[0]);
  const model = MODELS[modelId];

  const [prompt, setPrompt] = React.useState(prefill?.prompt ?? "");
  const [values, setValues] = React.useState<Values>(() => ({
    ...defaultsFor(MODELS[prefill?.modelId ?? modelIds[0]]),
    ...(prefill?.values ?? {}),
  }));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [lightboxAsset, setLightboxAsset] = React.useState<AssetView | null>(null);
  const [characterId, setCharacterId] = React.useState<string | null>(prefill?.characterId ?? null);

  const { toasts, push, dismiss } = useToasts();
  const flagTabTitle = useTabTitleAlert();

  const onFinished = React.useCallback(
    ({ job }: { job: { status: string; kind: string } }) => {
      flagTabTitle();
      if (job.status === "completed") {
        push({
          title: job.kind === "video" ? "Your clip is ready" : "Your render is ready",
          description: "It is in the queue below and saved to your library.",
          tone: "ok",
        });
      } else {
        push({
          title: job.status === "nsfw" ? "That prompt was refused" : "A render did not finish",
          description: "Your credits were refunded.",
          tone: "bad",
        });
      }
      // Keep the header's credit pill honest.
      router.refresh();
    },
    [flagTabTitle, push, router],
  );

  const { jobs, balance, submit, cancel } = useJobQueue(initialBalance, initialJobs, onFinished);

  const character = characters.find((entry) => entry.id === characterId) ?? null;

  /**
   * What attaching this character to this model actually does.
   *
   * Recomputed on every model change, because the answer differs per model and
   * the user has to see it *before* spending: a model that takes one photo out
   * of ten, or none at all, must say so rather than quietly render the wrong
   * thing.
   */
  const attachment = character ? attachReferences(model, character.urls) : null;

  const applyCharacter = React.useCallback(
    (next: CharacterView | null, target: AnyModel, base: Values): Values => {
      if (!next) return base;
      const result = attachReferences(target, next.urls);
      const merged = { ...base };
      // Visible composer models take a single `image_url`; `image_urls` only
      // reaches the multi-reference model, which Cinema drives, not this form.
      for (const [key, value] of Object.entries(result.values)) {
        if (typeof value === "string") merged[key] = value;
      }
      return merged;
    },
    [],
  );

  const selectModel = (next: ModelId) => {
    setModelId(next);
    setValues((current) =>
      applyCharacter(character, MODELS[next], {
        ...defaultsFor(MODELS[next]),
        ...pickShared(current, MODELS[next]),
      }),
    );
    setError(null);
  };

  const selectCharacter = (next: CharacterView | null) => {
    setCharacterId(next?.id ?? null);
    setError(null);

    if (!next) {
      setValues((current) => ({ ...current, image_url: "" }));
      return;
    }

    // Jump to a model that can use references rather than leaving the user on
    // one that cannot — but only if they have not already chosen one that can.
    const target =
      referenceCapacity(model) > 0 ? model : models.find((m) => referenceCapacity(m) > 0);
    if (target && target.id !== modelId) {
      const nextId = target.id as ModelId;
      setModelId(nextId);
      setValues((current) =>
        applyCharacter(next, MODELS[nextId], {
          ...defaultsFor(MODELS[nextId]),
          ...pickShared(current, MODELS[nextId]),
        }),
      );
      return;
    }
    setValues((current) => applyCharacter(next, model, current));
  };

  // Display only. The server re-validates and re-prices every request.
  const parsed = model.schema.safeParse(toInput(prompt || "placeholder prompt", values));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cost = parsed.success ? model.credits(parsed.data as any) : null;

  const onGenerate = async () => {
    setError(null);
    setPending(true);
    const result = await submit(modelId, toInput(prompt, values));
    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPrompt("");
    router.refresh();
  };

  /** Send an image to the video studio as its start frame. */
  const animate = (asset: AssetView) => {
    router.push(`/video?from=${asset.id}`);
  };

  const useAsReference = (asset: AssetView) => {
    const referenceModel = models.find((entry) => entry.capabilities.referenceImages);
    if (!referenceModel) return;
    const nextId = referenceModel.id as ModelId;
    setModelId(nextId);
    setValues((current) => ({
      ...defaultsFor(MODELS[nextId]),
      ...pickShared(current, MODELS[nextId]),
      image_url: asset.url,
    }));
    setLightboxAsset(null);
    if (asset.prompt) setPrompt(asset.prompt);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Put a finished job's exact input back in the composer. */
  const recreate = (job: QueuedJob) => {
    const nextId = job.modelId as ModelId;
    if (!MODELS[nextId]) return;
    const input = (job.input ?? {}) as Record<string, unknown>;
    const next: Values = {};
    for (const field of MODELS[nextId].fields) {
      const value = input[field.name];
      if (value !== undefined && value !== null) next[field.name] = String(value);
    }
    setModelId(nextId);
    setValues({ ...defaultsFor(MODELS[nextId]), ...next });
    setPrompt(job.prompt);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const heroField: FieldSpec | undefined = model.fields.find(
    (field) => field.type === "image" && field.name === "image_url",
  );
  const restFields = model.fields.filter((field) => field !== heroField);

  return (
    <>
      <div className="mt-8 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* ----------------------------------------------------- composer */}
        <div className="surface flex flex-col gap-4 p-4 lg:sticky lg:top-24 lg:self-start">
          <div>
            <p className="eyebrow">Model</p>
            <div className="mt-2 grid gap-2">
              {models.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => selectModel(entry.id as ModelId)}
                  aria-pressed={entry.id === modelId}
                  className={cn(
                    "rounded-md border px-3 py-2.5 text-left transition-colors",
                    entry.id === modelId
                      ? "border-primary/50 bg-primary/[0.08]"
                      : "border-border hover:border-primary/30",
                  )}
                >
                  <span className="block text-sm font-medium">{entry.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{entry.blurb}</span>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* The start frame is the subject on /video, so it leads. */}
          {heroField ? (
            <div>
              <p className="eyebrow">{heroField.label}</p>
              <div className="mt-2">
                <ImageField
                  id="field-image_url"
                  label={heroField.label}
                  value={values.image_url ?? ""}
                  onChange={(url) => setValues((current) => ({ ...current, image_url: url }))}
                  onError={setError}
                  large={kind === "video"}
                />
              </div>
              {heroField.help ? (
                <p className="mt-1.5 text-xs text-muted-foreground">{heroField.help}</p>
              ) : null}
            </div>
          ) : null}

          {characters.length ? (
            <div>
              <p className="eyebrow">Character</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => selectCharacter(null)}
                  aria-pressed={characterId === null}
                  className={cn(
                    "rounded-full px-2.5 py-1.5 text-xs transition-colors",
                    characterId === null
                      ? "bg-secondary text-foreground"
                      : "border border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  None
                </button>
                {characters.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => selectCharacter(entry)}
                    aria-pressed={entry.id === characterId}
                    className={cn(
                      "flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs transition-colors",
                      entry.id === characterId
                        ? "bg-secondary text-foreground"
                        : "border border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {entry.urls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.urls[0]}
                        alt=""
                        className="size-5 rounded-full object-cover"
                      />
                    ) : null}
                    {entry.name}
                  </button>
                ))}
              </div>

              {attachment?.notice ? (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  {attachment.notice}
                </p>
              ) : attachment ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {attachment.used} reference{attachment.used === 1 ? "" : "s"} attached.
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <label htmlFor="prompt" className="eyebrow">
              Prompt
            </label>
            <textarea
              id="prompt"
              rows={4}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={
                kind === "video"
                  ? "Slow dolly through a rain-slick alley, neon bleeding into puddles…"
                  : "A portrait lit by a single practical lamp, 85mm, heavy film grain…"
              }
              className="mt-2 w-full resize-none rounded-md border border-input bg-background/60 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-4">
            {restFields.map((field) => (
              <Field
                key={field.name}
                field={field}
                value={values[field.name] ?? ""}
                onChange={(next) => setValues((current) => ({ ...current, [field.name]: next }))}
                onError={setError}
              />
            ))}
          </div>

          <Separator />

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
              {cost === null ? "—" : `${cost} credits`}
              {balance !== null ? <span className="opacity-60">· {balance} left</span> : null}
            </span>
            <Button size="sm" onClick={onGenerate} disabled={pending || prompt.trim().length < 3}>
              <Sparkles />
              {pending ? "Sending…" : "Generate"}
            </Button>
          </div>

          <CreditNotice balance={balance} cost={cost} />
        </div>

        {/* ------------------------------------------------------ results */}
        <div className="flex flex-col gap-4">
          {jobs.length === 0 ? (
            <EmptyState
              icon={kind === "video" ? <Film /> : <ImagePlus />}
              title={kind === "video" ? "No clips yet" : "Nothing rendered yet"}
              description={
                kind === "video"
                  ? "Drop in a start frame, describe the motion, and the clip appears here as it renders. Leaving the page is safe — it keeps going."
                  : "Write a prompt on the left and your stills appear here the moment the render is queued."
              }
              className="min-h-[320px]"
            />
          ) : (
            jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onCancel={cancel}
                onOpen={setLightboxAsset}
                onUseAsReference={kind === "image" ? useAsReference : undefined}
                onAnimate={kind === "image" ? animate : undefined}
                onRecreate={recreate}
              />
            ))
          )}
        </div>

        <Lightbox
          asset={lightboxAsset}
          onOpenChange={(open) => !open && setLightboxAsset(null)}
          onUseAsReference={kind === "image" ? useAsReference : undefined}
          onAnimate={kind === "image" ? animate : undefined}
        />
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

function Field({
  field,
  value,
  onChange,
  onError,
}: {
  field: FieldSpec;
  value: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  const id = `field-${field.name}`;

  return (
    <div>
      <label htmlFor={id} className="eyebrow">
        {field.label}
      </label>

      {field.type === "select" ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {field.options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={option.value === value}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs transition-colors",
                option.value === value
                  ? "bg-secondary text-foreground"
                  : "border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {field.type === "number" ? (
        <input
          id={id}
          type="number"
          min={field.min}
          max={field.max}
          step={field.step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm focus-visible:border-primary/60 focus-visible:outline-none"
        />
      ) : null}

      {field.type === "seed" ? (
        <input
          id={id}
          type="number"
          inputMode="numeric"
          placeholder="random"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm focus-visible:border-primary/60 focus-visible:outline-none"
        />
      ) : null}

      {field.type === "image" ? (
        <div className="mt-2">
          <ImageField
            id={id}
            label={field.label}
            value={value}
            onChange={onChange}
            onError={onError}
          />
        </div>
      ) : null}

      {field.help ? <p className="mt-1.5 text-xs text-muted-foreground">{field.help}</p> : null}
    </div>
  );
}
