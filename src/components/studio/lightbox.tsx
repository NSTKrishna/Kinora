"use client";

import * as React from "react";
import { Copy, Download, Film, ImagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AssetMedia } from "@/components/studio/asset-media";
import type { AssetView } from "@/lib/serialize";

export function Lightbox({
  asset,
  onOpenChange,
  onUseAsReference,
  onAnimate,
}: {
  asset: AssetView | null;
  onOpenChange: (open: boolean) => void;
  onUseAsReference?: (asset: AssetView) => void;
  onAnimate?: (asset: AssetView) => void;
}) {
  return (
    <Dialog open={Boolean(asset)} onOpenChange={onOpenChange}>
      <DialogContent>
        {asset ? (
          <div className="flex flex-col gap-3">
            <DialogTitle className="sr-only">{asset.prompt ?? "Render"}</DialogTitle>

            <AssetMedia
              asset={asset}
              autoPlayOnHover={false}
              className="max-h-[70vh] w-full rounded-lg !object-contain"
            />

            <div className="surface flex flex-col gap-3 p-4">
              {asset.prompt ? (
                <p className="text-sm text-muted-foreground">{asset.prompt}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <AssetActions
                  asset={asset}
                  onUseAsReference={onUseAsReference}
                  onAnimate={onAnimate}
                />
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
  onAnimate,
  size = "sm",
}: {
  asset: AssetView;
  onUseAsReference?: (asset: AssetView) => void;
  onAnimate?: (asset: AssetView) => void;
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
      {onAnimate && asset.kind !== "video" ? (
        <Button size={size} onClick={() => onAnimate(asset)}>
          <Film />
          Animate
        </Button>
      ) : null}
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
      {onUseAsReference && asset.kind !== "video" ? (
        <Button size={size} variant="outline" onClick={() => onUseAsReference(asset)}>
          <ImagePlus />
          Use as reference
        </Button>
      ) : null}
    </>
  );
}
