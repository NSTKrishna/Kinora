import type { Metadata } from "next";
import { Film } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Composer } from "@/components/composer";
import { EmptyState } from "@/components/empty-state";
import { MediaCard } from "@/components/media-card";
import { Button } from "@/components/ui/button";
import { FEED_ITEMS } from "@/lib/placeholder";

export const metadata: Metadata = { title: "Video" };

const RECENT = FEED_ITEMS.filter((item) => item.kind === "video").slice(0, 3);

export default function VideoPage() {
  return (
    <div className="container py-8">
      <PageHeader
        eyebrow="Generate"
        title="Video"
        description="Describe the shot and the camera move. Renders run async — you can leave the page."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Composer
          placeholder="Slow dolly through a rain-slick alley, neon bleeding into puddles…"
          cost={6}
          cta="Render"
          options={[
            { label: "Model", values: ["Kinora Motion v1", "Kinora Motion Turbo"] },
            { label: "Duration", values: ["4s", "6s", "8s"] },
            { label: "Aspect", values: ["16:9", "9:16", "1:1"] },
            { label: "Camera", values: ["Static", "Dolly in", "Orbit", "Whip pan"] },
          ]}
        />

        <div className="flex flex-col gap-6">
          <EmptyState
            icon={<Film />}
            title="No renders in the queue"
            description="Start a render and its live status shows up here — queued, rendering, then playable inline."
            action={<Button variant="outline">Start from an effect</Button>}
            className="min-h-[320px]"
          />

          <section>
            <p className="eyebrow">Recent on Kinora</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {RECENT.map((item, i) => (
                <MediaCard key={item.id} item={item} seed={i + 7} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
