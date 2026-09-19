"use client";

import * as React from "react";
import { Copy, Download, ImagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { AssetView } from "@/lib/serialize";

export function Lightbox({
  asset,
  onOpenChange,
  onUseAsReference,
}: {
  asset: AssetView | null;
  onOpenChange: (open: boolean) => void;
  onUseAsReference?: (asset: AssetView) => void;
}) {
  return (
    <Dialog open={Boolean(asset)} onOpenChange={onOpenChange}>
      <DialogContent>
        {asset ? (
          <div className="flex flex-col gap-3">
            <DialogTitle className="sr-only">{asset.prompt ?? "Render"}</DialogTitle>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.url}
              alt={asset.prompt ?? "Generated image"}
              className="max-h-[70vh] w-full rounded-lg object-contain"
            />

            <div className="surface flex flex-col gap-3 p-4">
              <p className="text-sm text-muted-foreground">{asset.prompt}</p>
              <div className="flex flex-wrap gap-2">
                <AssetActions asset={asset} onUseAsReference={onUseAsReference} />
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function AssetActions({
  asset,
  onUseAsReference,
  size = "sm",
}: {
  asset: AssetView;
  onUseAsReference?: (asset: AssetView) => void;
  size?: "sm" | "default";
}) {
  const [copied, setCopied] = React.useState(false);

  const copyPrompt = async () => {
    if (!asset.prompt) return;
    try {
      await navigator.clipboard.writeText(asset.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the prompt is visible on the card anyway.
    }
  };

  return (
    <>
      <Button size={size} variant="secondary" asChild>
        <a href={asset.url} download target="_blank" rel="noreferrer">
          <Download />
          Download
        </a>
      </Button>
      <Button size={size} variant="outline" onClick={copyPrompt} disabled={!asset.prompt}>
        <Copy />
        {copied ? "Copied" : "Copy prompt"}
      </Button>
      {onUseAsReference ? (
        <Button size={size} variant="outline" onClick={() => onUseAsReference(asset)}>
          <ImagePlus />
          Use as reference
        </Button>
      ) : null}
    </>
  );
}
