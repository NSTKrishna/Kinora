"use client";

import { cn } from "@/lib/utils";
import { optionsIn, type CinemaGroup } from "@/lib/cinema";

/**
 * One row of the director's panel.
 *
 * Every option carries its own one-line note, because "f/1.4" only means
 * something to someone who already shoots — "paper-thin focus" means something
 * to everyone. That note is the difference between a panel and a form.
 */
export function OptionPicker({
  group,
  label,
  value,
  onChange,
}: {
  group: CinemaGroup;
  label: string;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="eyebrow">{label}</legend>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {optionsIn(group).map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={option.id === value}
            title={option.fragment}
            className={cn(
              "rounded-md border px-3 py-2 text-left transition-colors",
              option.id === value
                ? "border-primary/50 bg-primary/[0.08]"
                : "border-border hover:border-primary/30",
            )}
          >
            <span className="block truncate text-sm font-medium">{option.label}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {option.note}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
