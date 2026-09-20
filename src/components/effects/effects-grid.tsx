"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { EFFECT_CATEGORIES } from "@/lib/effects";
import { EffectCard } from "@/components/effects/effect-card";
import type { EffectView } from "@/lib/presets";

/**
 * The effects grid.
 *
 * Filtering is client-side on purpose: eight presets is a small, fixed list, so
 * a chip should feel instant rather than cost a round trip. Only categories
 * that actually have an effect get a chip.
 */
export function EffectsGrid({ effects }: { effects: EffectView[] }) {
  const [category, setCategory] = React.useState<string>("all");

  const chips = React.useMemo(() => {
    const present = new Set(effects.map((effect) => effect.category));
    return EFFECT_CATEGORIES.filter((entry) => entry.id === "all" || present.has(entry.id));
  }, [effects]);

  const shown = category === "all" ? effects : effects.filter((e) => e.category === category);

  return (
    <>
      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setCategory(chip.id)}
            aria-pressed={chip.id === category}
            className={cn(
              "shrink-0 rounded-sm px-3 py-1.5 text-xs transition-colors",
              chip.id === category
                ? "bg-secondary text-foreground"
                : "border border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((effect) => (
          <EffectCard key={effect.slug} effect={effect} />
        ))}
      </div>
    </>
  );
}
