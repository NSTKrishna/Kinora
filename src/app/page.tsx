import Link from "next/link";
import { ArrowRight, Image as ImageIcon, Clapperboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MediaCard } from "@/components/media-card";
import { FEED_ITEMS, posterStyle } from "@/lib/placeholder";

const FILTERS = ["All", "Video", "Image", "Effects", "Cinema"];

export default function ExplorePage() {
  const hero = FEED_ITEMS[0];

  return (
    <div className="pb-4">
      {/* Hero — media behind, one promise, two doors. */}
      <section className="relative isolate overflow-hidden border-b border-border/70">
        <div className="absolute inset-0 -z-10" style={posterStyle(hero.palette, 3)} />
        <div className="grain absolute inset-0 -z-10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/85 to-background/40" />

        <div className="container flex flex-col items-start gap-6 py-16 sm:py-24 lg:py-32">
          <Badge>
            <span className="size-1.5 rounded-full bg-primary" />
            Now in open preview
          </Badge>
          <h1 className="max-w-3xl text-balance text-3xl font-semibold sm:text-4xl lg:text-5xl">
            A studio for generated motion.
          </h1>
          <p className="max-w-xl text-pretty text-base text-muted-foreground">
            Write a shot. Kinora renders it as an image or a video, keeps every version in your
            library, and lets you remix anything you see here — including other people&apos;s work.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/video">
                <Clapperboard />
                Generate a video
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/image">
                <ImageIcon />
                Generate an image
              </Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            No account needed to start — you get 40 credits as a guest.
          </p>
        </div>
      </section>

      {/* Explore feed */}
      <section className="container pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Explore</p>
            <h2 className="mt-1 text-xl font-medium">Fresh from the queue</h2>
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {FILTERS.map((filter, i) => (
              <button
                key={filter}
                type="button"
                className={
                  i === 0
                    ? "shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs text-foreground"
                    : "shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 columns-1 gap-4 [column-fill:_balance] sm:columns-2 lg:columns-3 xl:columns-4">
          {FEED_ITEMS.map((item, i) => (
            <div key={item.id} className="mb-4 animate-fade-up break-inside-avoid">
              <MediaCard item={item} seed={i} />
            </div>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Button variant="outline">
            Load more
            <ArrowRight />
          </Button>
        </div>
      </section>
    </div>
  );
}
