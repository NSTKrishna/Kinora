import type { Metadata } from "next";
import { ImagePlus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Composer } from "@/components/composer";
import { EmptyState } from "@/components/empty-state";
import { MediaCard } from "@/components/media-card";
import { Button } from "@/components/ui/button";
import { FEED_ITEMS } from "@/lib/placeholder";

export const metadata: Metadata = { title: "Image" };

const RECENT = FEED_ITEMS.filter((item) => item.kind === "image").slice(0, 3);

export default function ImagePage() {
  return (
    <div className="container py-8">
      <PageHeader
        eyebrow="Generate"
        title="Image"
        description="One prompt, one still. Pick a model and a frame, then send it to the queue."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Composer
          placeholder="A portrait lit by a single practical lamp, 85mm, heavy film grain…"
          cost={1}
          cta="Render"
          options={[
            { label: "Model", values: ["Kinora Still XL", "Kinora Still Fast"] },
            { label: "Aspect", values: ["1:1", "4:5", "3:4", "16:9", "9:16"] },
            { label: "Count", values: ["1", "2", "4"] },
          ]}
        />

        <div className="flex flex-col gap-6">
          <EmptyState
            icon={<ImagePlus />}
            title="Nothing rendered yet"
            description="Write a prompt on the left and your stills will appear here as they finish — one card per output."
            action={<Button variant="outline">Try a sample prompt</Button>}
            className="min-h-[320px]"
          />

          <section>
            <p className="eyebrow">Recent on Kinora</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {RECENT.map((item, i) => (
                <MediaCard key={item.id} item={item} seed={i + 4} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
