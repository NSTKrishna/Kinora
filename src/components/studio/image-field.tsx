"use client";

import * as React from "react";
import { ImagePlus, Loader2, Upload, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { uploadImage } from "@/lib/upload";

/**
 * A reference/start frame slot: drop a file on it, pick one, or paste a URL.
 * Uploads go straight to storage and land in the library as `upload` assets.
 */
export function ImageField({
  id,
  value,
  onChange,
  onError,
  label,
  large = false,
}: {
  id: string;
  value: string;
  onChange: (url: string) => void;
  onError: (message: string) => void;
  label: string;
  large?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);

  const handleFile = async (file: File) => {
    setBusy(true);
    const result = await uploadImage(file);
    setBusy(false);
    if (result.ok) onChange(result.asset.url);
    else onError(result.message);
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "relative flex items-center gap-3 rounded-md border border-dashed p-3 transition-colors",
          dragging ? "border-primary bg-primary/[0.06]" : "border-border",
          large && "flex-col justify-center py-6 text-center",
        )}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={label}
              className={cn(
                "shrink-0 rounded-md border border-border object-cover",
                large ? "h-32 w-full" : "size-16",
              )}
            />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute right-2 top-2 rounded-sm bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
              aria-label={`Remove ${label}`}
            >
              <X className="size-3" />
            </button>
          </>
        ) : (
          <div
            className={cn(
              "flex items-center justify-center rounded-md border border-dashed border-border text-muted-foreground",
              large ? "size-12" : "size-16 shrink-0",
            )}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          </div>
        )}

        <div className={cn("min-w-0 flex-1", large && "w-full")}>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs text-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            <Upload className="size-3.5" />
            {busy ? "Uploading…" : "Drop an image or browse"}
          </button>
          <input
            id={id}
            type="url"
            value={value}
            placeholder="…or paste an image URL"
            onChange={(event) => onChange(event.target.value)}
            className="mt-2 w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm focus-visible:border-primary/60 focus-visible:outline-none"
          />
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
