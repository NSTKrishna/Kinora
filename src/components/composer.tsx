import * as React from "react";
import { Sparkles, Coins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export type ComposerOption = { label: string; values: string[] };

/**
 * Prompt panel used by /image and /video.
 * Inert in the scaffold — wired to the jobs pipeline in a later commit.
 */
export function Composer({
  placeholder,
  options,
  cost,
  cta,
}: {
  placeholder: string;
  options: ComposerOption[];
  cost: number;
  cta: string;
}) {
  return (
    <div className="surface flex flex-col gap-4 p-4 lg:sticky lg:top-24">
      <div>
        <label htmlFor="prompt" className="eyebrow">
          Prompt
        </label>
        <textarea
          id="prompt"
          rows={5}
          placeholder={placeholder}
          className="mt-2 w-full resize-none rounded-md border border-input bg-background/60 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <Separator />

      <div className="flex flex-col gap-4">
        {options.map((option) => (
          <div key={option.label}>
            <p className="eyebrow">{option.label}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {option.values.map((value, i) => (
                <button
                  key={value}
                  type="button"
                  className={
                    i === 0
                      ? "rounded-md bg-secondary px-2.5 py-1.5 text-xs text-foreground"
                      : "rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  }
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Coins className="size-3.5 text-primary" />
          {cost} credits per render
        </span>
        <Button size="sm">
          <Sparkles />
          {cta}
        </Button>
      </div>
    </div>
  );
}
