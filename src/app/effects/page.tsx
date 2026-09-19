import type { Metadata } from "next";
import Link from "next/link";
import { Wand2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EFFECT_PRESETS, posterStyle } from "@/lib/placeholder";

export const metadata: Metadata = { title: "Effects" };

export default function EffectsPage() {
  return (
    <div className="container py-8">
      <PageHeader
        eyebrow="Presets"
        title="Effects"
        description="One-tap camera moves and grades. Pick one, drop in a prompt or an image, and render."
        actions={
          <Button asChild variant="outline">
            <Link href="/video">Open video composer</Link>
          </Button>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EFFECT_PRESETS.map((preset, i) => (
          <Link
            key={preset.id}
            href="/video"
            className="hover:glow-ember group relative isolate overflow-hidden rounded-lg border border-border/70 transition-transform duration-300 hover:-translate-y-0.5"
          >
            <div className="aspect-video w-full" style={posterStyle(preset.palette, i * 5)} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
              <div>
                <h2 className="text-base font-medium text-white">{preset.name}</h2>
                <p className="text-xs text-white/60">{preset.note}</p>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-micro uppercase tracking-[0.12em] text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Wand2 className="size-3" />
                Use
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
