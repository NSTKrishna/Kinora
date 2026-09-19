import type { Metadata } from "next";
import { Clapperboard, Plus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { posterStyle } from "@/lib/placeholder";

export const metadata: Metadata = { title: "Cinema" };

const SHOTS = [
  {
    id: "s1",
    label: "Shot 1",
    note: "Establishing — wide, dusk",
    palette: ["#0b1020", "#2d3f73", "#8fb8ff"],
  },
  {
    id: "s2",
    label: "Shot 2",
    note: "Push in on the doorway",
    palette: ["#1a1109", "#9a4b18", "#f3b27a"],
  },
  {
    id: "s3",
    label: "Shot 3",
    note: "Close — hands, reveal",
    palette: ["#060d0b", "#1f4c40", "#7fd8b4"],
  },
];

export default function CinemaPage() {
  return (
    <div className="container py-8">
      <PageHeader
        eyebrow="Studio"
        title="Cinema"
        description="Build a short sequence shot by shot. Keep a consistent look across the whole strip, then render it in one pass."
        actions={
          <Button>
            <Plus />
            New sequence
          </Button>
        }
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <div className="flex items-center justify-between">
            <p className="eyebrow">Shot list</p>
            <Badge variant="outline">Draft</Badge>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {SHOTS.map((shot, i) => (
              <div key={shot.id} className="surface flex items-center gap-4 p-3">
                <div
                  className="h-16 w-28 shrink-0 rounded-md"
                  style={posterStyle(shot.palette, i * 9)}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{shot.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{shot.note}</p>
                </div>
                <Button size="sm" variant="ghost" className="ml-auto shrink-0">
                  Edit
                </Button>
              </div>
            ))}
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Plus className="size-4" />
              Add shot
            </button>
          </div>
        </section>

        <EmptyState
          icon={<Clapperboard />}
          title="No cut yet"
          description="Render the shot list to see the assembled sequence here."
          action={<Button variant="outline">Render sequence</Button>}
          className="lg:sticky lg:top-24"
        />
      </div>
    </div>
  );
}
