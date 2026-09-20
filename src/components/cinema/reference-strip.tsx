"use client";

import * as React from "react";
import { Loader2, Plus, Save, Users, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { uploadImage } from "@/lib/upload";
import { MAX_REFERENCES } from "@/lib/cinema";
import { CHARACTER_MIN_PHOTOS, type CharacterView } from "@/lib/characters";

/**
 * Up to four references, or a saved character standing in for all of them.
 *
 * References are optional: with none, the frames come off the cheap model and
 * cost almost nothing, which is the right default for finding a composition.
 * They earn their cost when the same face or prop has to survive every frame.
 */
export function ReferenceStrip({
  urls,
  onChange,
  onError,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
  onError: (message: string | null) => void;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [characters, setCharacters] = React.useState<CharacterView[] | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [name, setName] = React.useState("");
  const [naming, setNaming] = React.useState(false);

  const full = urls.length >= MAX_REFERENCES;
  const [notice, setNotice] = React.useState<string | null>(null);

  /** A character can hold ten photos; the frames model takes four. Say which. */
  const applyCharacter = (character: CharacterView) => {
    const kept = character.urls.slice(0, MAX_REFERENCES);
    onChange(kept);
    setNotice(
      character.urls.length > MAX_REFERENCES
        ? `${character.name} has ${character.urls.length} photos — the frames model takes ${MAX_REFERENCES}, so the first ${MAX_REFERENCES} are attached.`
        : null,
    );
  };

  const loadCharacters = React.useCallback(async () => {
    try {
      const response = await fetch("/api/characters", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { characters: CharacterView[] };
      setCharacters(data.characters);
    } catch {
      // A character list that will not load is not worth an error banner; the
      // reference slots still work on their own.
      setCharacters([]);
    }
  }, []);

  React.useEffect(() => {
    void loadCharacters();
  }, [loadCharacters]);

  const addFiles = async (files: FileList | File[]) => {
    const room = MAX_REFERENCES - urls.length;
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
    if (added.length) onChange([...urls, ...added]);
  };

  const saveCharacter = async () => {
    setSaving(true);
    onError(null);

    const response = await fetch("/api/characters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, urls }),
    });
    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      onError(data?.error?.message ?? "Could not save that character.");
      return;
    }
    if (data.skipped > 0) {
      onError(
        `Saved ${data.character.urls.length} of ${urls.length} references — the rest are not stills you own.`,
      );
    }
    setNaming(false);
    setName("");
    void loadCharacters();
  };

  return (
    <div>
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
          "grid grid-cols-4 gap-2 rounded-md border border-dashed p-2 transition-colors",
          dragging ? "border-primary bg-primary/[0.06]" : "border-border",
        )}
      >
        {urls.map((url) => (
          <div
            key={url}
            className="relative aspect-square overflow-hidden rounded-md border border-border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Reference" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(urls.filter((entry) => entry !== url))}
              className="absolute right-1 top-1 rounded-sm bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
              aria-label="Remove reference"
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
        Optional. {urls.length}/{MAX_REFERENCES} used — references keep a face, a prop or a place
        the same across all four frames, on a stronger and dearer model.
      </p>

      {/* ------------------------------------------------------ characters */}
      {characters?.length ? (
        <div className="mt-3">
          <p className="eyebrow flex items-center gap-1.5">
            <Users className="size-3" />
            Your characters
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {characters.map((character) => (
              <button
                key={character.id}
                type="button"
                onClick={() => applyCharacter(character)}
                className="flex items-center gap-2 rounded-sm border border-border py-1 pl-1 pr-3 text-xs transition-colors hover:border-primary/40"
              >
                {character.urls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={character.urls[0]} alt="" className="size-6 rounded-sm object-cover" />
                ) : null}
                {character.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {notice ? <p className="mt-2 text-xs text-muted-foreground">{notice}</p> : null}

      {urls.length >= CHARACTER_MIN_PHOTOS ? (
        <div className="mt-3">
          {naming ? (
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Character name"
                maxLength={60}
                className="min-w-0 flex-1 rounded-md border border-input bg-background/60 px-3 py-1.5 text-sm focus-visible:border-primary/60 focus-visible:outline-none"
              />
              <Button
                size="sm"
                onClick={() => void saveCharacter()}
                disabled={saving || !name.trim()}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setNaming(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="-ml-2" onClick={() => setNaming(true)}>
              <Save />
              Save as a character
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
