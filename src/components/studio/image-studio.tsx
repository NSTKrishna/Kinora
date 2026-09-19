"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Coins, ImagePlus, Sparkles, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/empty-state";
import { JobCard } from "@/components/studio/job-card";
import { Lightbox } from "@/components/studio/lightbox";
import { useJobQueue } from "@/hooks/use-job-queue";
import { MODELS, type AnyModel, type FieldSpec, type ModelId } from "@/lib/models";
import type { AssetView } from "@/lib/serialize";

type Values = Record<string, string>;

function defaultsFor(model: AnyModel): Values {
  const parsed = model.schema.safeParse({ prompt: "placeholder prompt", image_url: undefined });
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

export function ImageStudio({
  modelIds,
  initialBalance,
}: {
  /** Ids only: the registry entry holds zod schemas and functions, which
   *  cannot cross the server/client boundary. The client reads it directly. */
  modelIds: ModelId[];
  initialBalance: number | null;
}) {
  const router = useRouter();
  const models = React.useMemo(() => modelIds.map((id) => MODELS[id]), [modelIds]);
  const [modelId, setModelId] = React.useState<ModelId>(modelIds[0]);
  const model = MODELS[modelId];

  const [prompt, setPrompt] = React.useState("");
  const [values, setValues] = React.useState<Values>(() => defaultsFor(model));
  const [error, setError] = React.useState<{ code: string; message: string } | null>(null);
  const [pending, setPending] = React.useState(false);
  const [lightboxAsset, setLightboxAsset] = React.useState<AssetView | null>(null);

  const { jobs, balance, submit, cancel } = useJobQueue(initialBalance);

  const selectModel = (next: ModelId) => {
    setModelId(next);
    setValues((current) => ({
      ...defaultsFor(MODELS[next]),
      ...pickShared(current, MODELS[next]),
    }));
    setError(null);
  };

  // Display only. The server re-validates and re-prices every request.
  const parsed = model.schema.safeParse(toInput(prompt || "placeholder prompt", values));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cost = parsed.success ? model.credits(parsed.data as any) : null;
  const affordable = balance === null || cost === null || balance >= cost;

  const onGenerate = async () => {
    setError(null);
    setPending(true);
    const result = await submit(modelId, toInput(prompt, values));
    setPending(false);

    if (!result.ok) {
      setError({ code: result.code, message: result.message });
      return;
    }
    setPrompt("");
    // Keep the header's credit pill honest.
    router.refresh();
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

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      {/* ------------------------------------------------------- composer */}
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

        <div>
          <label htmlFor="prompt" className="eyebrow">
            Prompt
          </label>
          <textarea
            id="prompt"
            rows={5}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="A portrait lit by a single practical lamp, 85mm, heavy film grain…"
            className="mt-2 w-full resize-none rounded-md border border-input bg-background/60 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-4">
          {model.fields.map((field) => (
            <Field
              key={field.name}
              field={field}
              value={values[field.name] ?? ""}
              onChange={(next) => setValues((current) => ({ ...current, [field.name]: next }))}
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
            <span>{error.message}</span>
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

        {!affordable ? (
          <p className="text-xs text-muted-foreground">
            That costs more than you have left. Credits refresh daily.
          </p>
        ) : null}
      </div>

      {/* -------------------------------------------------------- results */}
      <div className="flex flex-col gap-4">
        {jobs.length === 0 ? (
          <EmptyState
            icon={<ImagePlus />}
            title="Nothing rendered yet"
            description="Write a prompt on the left and your stills appear here the moment the render is queued — you can watch each one move from queued to done."
            className="min-h-[320px]"
          />
        ) : (
          jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onCancel={cancel}
              onOpen={setLightboxAsset}
              onUseAsReference={useAsReference}
            />
          ))
        )}
      </div>

      <Lightbox
        asset={lightboxAsset}
        onOpenChange={(open) => !open && setLightboxAsset(null)}
        onUseAsReference={useAsReference}
      />
    </div>
  );
}

/** Carry over any field the new model also has, so switching is not a reset. */
function pickShared(values: Values, model: AnyModel): Values {
  const shared: Values = {};
  for (const field of model.fields) {
    if (values[field.name]) shared[field.name] = values[field.name];
  }
  return shared;
}

function Field({
  field,
  value,
  onChange,
}: {
  field: FieldSpec;
  value: string;
  onChange: (value: string) => void;
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
        <div className="mt-2 flex items-start gap-3">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Reference"
              className="size-16 shrink-0 rounded-md border border-border object-cover"
            />
          ) : (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
              <ImagePlus className="size-4" />
            </div>
          )}
          <input
            id={id}
            type="url"
            value={value}
            placeholder="https://… or use a render as reference"
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm focus-visible:border-primary/60 focus-visible:outline-none"
          />
        </div>
      ) : null}

      {field.help ? <p className="mt-1.5 text-xs text-muted-foreground">{field.help}</p> : null}
    </div>
  );
}
