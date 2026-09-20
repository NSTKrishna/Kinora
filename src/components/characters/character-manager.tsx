"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clapperboard, ImagePlus, Loader2, Plus, Trash2, Users, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { uploadImage } from "@/lib/upload";
import { CHARACTER_MAX_PHOTOS, CHARACTER_MIN_PHOTOS, type CharacterView } from "@/lib/characters";

/**
 * Characters: stored reference photos under a name.
 *
 * Nothing is trained. The page says so where someone would otherwise assume
 * otherwise, because "create a character" reads like fine-tuning and this is
 * not that — it is the same photos attached to every render without going
 * looking for them.
 */
export function CharacterManager({ initial }: { initial: CharacterView[] }) {
  const router = useRouter();
  const [characters, setCharacters] = React.useState(initial);
  const [creating, setCreating] = React.useState(initial.length === 0);
  const [error, setError] = React.useState<string | null>(null);

  const remove = async (character: CharacterView) => {
    const previous = characters;
    setCharacters((current) => current.filter((entry) => entry.id !== character.id));

    const response = await fetch(`/api/characters/${character.id}`, { method: "DELETE" });
    if (!response.ok) {
      setCharacters(previous);
      setError("Could not delete that character.");
      return;
    }
    router.refresh();
  };

  return (
    <div className="mt-8 flex flex-col gap-6">
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/[0.06] p-3 text-sm"
        >
          {error}
        </p>
      ) : null}

      {creating ? (
        <CreateCharacter
          onError={setError}
          onCreated={(character) => {
            setCharacters((current) => [character, ...current]);
            setCreating(false);
            router.refresh();
          }}
          onCancel={characters.length ? () => setCreating(false) : undefined}
        />
      ) : (
        <div>
          <Button onClick={() => setCreating(true)}>
            <Plus />
            New character
          </Button>
        </div>
      )}

      {characters.length === 0 && !creating ? (
        <EmptyState
          icon={<Users />}
          title="No characters yet"
          description={`Save ${CHARACTER_MIN_PHOTOS}–${CHARACTER_MAX_PHOTOS} photos of the same person, prop or place, then attach them to any render that takes references.`}
          action={<Button onClick={() => setCreating(true)}>New character</Button>}
        />
      ) : null}

      {characters.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((character) => (
            <article key={character.id} className="surface flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-medium">{character.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {character.urls.length} reference{character.urls.length === 1 ? "" : "s"}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 hover:text-destructive"
                  onClick={() => void remove(character)}
                  title="Delete character"
                >
                  <Trash2 />
                  <span className="sr-only">Delete {character.name}</span>
                </Button>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {character.urls.slice(0, 8).map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full rounded-sm border border-border object-cover"
                  />
                ))}
              </div>

              <div className="mt-auto flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/image?character=${character.id}`}>
                    <ImagePlus />
                    Use in Image
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/cinema?character=${character.id}`}>
                    <Clapperboard />
                    Use in Cinema
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CreateCharacter({
  onCreated,
  onCancel,
  onError,
}: {
  onCreated: (character: CharacterView) => void;
  onCancel?: () => void;
  onError: (message: string | null) => void;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [name, setName] = React.useState("");
  const [urls, setUrls] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);

  const enough = urls.length >= CHARACTER_MIN_PHOTOS;
  const full = urls.length >= CHARACTER_MAX_PHOTOS;

  const addFiles = async (files: FileList | File[]) => {
    const room = CHARACTER_MAX_PHOTOS - urls.length;
    if (room <= 0) return;

    setBusy(true);
    onError(null);
    const added: string[] = [];

    for (const file of Array.from(files).slice(0, room)) {
      const result = await uploadImage(file);
      if (result.ok) added.push(result.asset.url);
      else onError(result.message);
    }

    setBusy(false);
    if (added.length) setUrls((current) => [...current, ...added]);
  };

  const save = async () => {
    setSaving(true);
    onError(null);

    try {
      const response = await fetch("/api/characters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, urls }),
      });
      const data = await response.json();

      if (!response.ok) {
        onError(data?.error?.message ?? "Could not save that character.");
        return;
      }
      onCreated(data.character as CharacterView);
      setName("");
      setUrls([]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="surface flex flex-col gap-4 p-4">
      <div>
        <label htmlFor="character-name" className="eyebrow">
          Name
        </label>
        <input
          id="character-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          placeholder="Who or what is this?"
          className="mt-2 w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm focus-visible:border-primary/60 focus-visible:outline-none"
        />
      </div>

      <div>
        <p className="eyebrow">
          Photos — {urls.length}/{CHARACTER_MAX_PHOTOS}
        </p>
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (event.dataTransfer.files?.length) void addFiles(event.dataTransfer.files);
          }}
          className={cn(
            "mt-2 grid grid-cols-4 gap-2 rounded-md border border-dashed p-2 transition-colors sm:grid-cols-5",
            dragging ? "border-primary bg-primary/[0.06]" : "border-border",
          )}
        >
          {urls.map((url) => (
            <div
              key={url}
              className="relative aspect-square overflow-hidden rounded-md border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setUrls((current) => current.filter((entry) => entry !== url))}
                className="absolute right-1 top-1 rounded-sm bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
                aria-label="Remove photo"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}

          {!full ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              <span className="text-micro uppercase tracking-[0.12em]">Add</span>
            </button>
          ) : null}
        </div>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/avif"
          className="hidden"
          onChange={(event) => {
            if (event.target.files?.length) void addFiles(event.target.files);
            event.target.value = "";
          }}
        />

        <p className="mt-1.5 text-xs text-muted-foreground">
          {CHARACTER_MIN_PHOTOS}–{CHARACTER_MAX_PHOTOS} photos of the same subject, from different
          angles. Nothing is trained — they are stored and attached as references.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void save()} disabled={saving || busy || !enough || !name.trim()}>
          {saving ? <Loader2 className="animate-spin" /> : <Users />}
          Save character
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        {!enough ? (
          <span className="text-xs text-muted-foreground">
            {CHARACTER_MIN_PHOTOS - urls.length} more photo
            {CHARACTER_MIN_PHOTOS - urls.length === 1 ? "" : "s"} needed.
          </span>
        ) : null}
      </div>
    </div>
  );
}
