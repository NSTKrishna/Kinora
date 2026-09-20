import Link from "next/link";
import { ArrowRight, Image as ImageIcon, Clapperboard, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EffectCard } from "@/components/effects/effect-card";
import { ExploreFeed } from "@/components/explore/explore-feed";
import { isDatabaseConfigured } from "@/db";
import { getEffects } from "@/lib/presets";
import type { EffectView } from "@/lib/presets";
import { getPublicFeed } from "@/lib/queries";
import { CinematicHero } from "@/components/explore/cinematic-hero";

export default async function ExplorePage() {
  // Neither of these is a reason the landing page fails to render.
  let effects: EffectView[] = [];
  let feed = { items: [], nextCursor: null } as Awaited<ReturnType<typeof getPublicFeed>>;

  if (isDatabaseConfigured()) {
    [effects, feed] = await Promise.all([
      getEffects().catch(() => []),
      getPublicFeed("all").catch(() => ({ items: [], nextCursor: null })),
    ]);
  }

  return (
    <div className="pb-4">
      {/* Hero — a full-bleed clip with the promise over it. */}
      <section className="relative isolate overflow-hidden">
        <CinematicHero />

        <div className="container flex min-h-[78vh] flex-col items-start justify-end gap-6 pb-20 pt-32 sm:min-h-[82vh]">
          <Badge>
            <span className="size-1.5 rounded-full bg-primary" />
            Now in open preview
          </Badge>
          {/* Film-title density: line-height 1.0, negative tracking, weight 400. */}
          <h1 className="max-w-4xl text-balance text-4xl font-normal sm:text-5xl">
            A studio for generated motion.
          </h1>
          <p className="max-w-xl text-pretty text-base text-muted-foreground">
            Write a shot. Kinora renders it as an image or a video, keeps every version in your
            library, and lets you remix anything you see here — including other people&apos;s work.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/effects">
                <Wand2 />
                Try an effect
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
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
            No account needed to start — you get 30 credits as a guest.
          </p>
        </div>
      </section>

      {/* Effects rail — the shortest path from landing to a finished clip. */}
      {effects.length ? (
        <section className="container pt-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Effects</p>
              <h2 className="mt-2 text-xl font-normal">One photo, one tap</h2>
              <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                The camera move, the lighting and the model are already decided. Add a photo and it
                renders.
              </p>
            </div>
            <Button asChild variant="ghost" className="text-muted-foreground">
              <Link href="/effects">
                All effects
                <ArrowRight />
              </Link>
            </Button>
          </div>

          {/* A rail, not a grid: it scrolls on a phone and never wraps to a
              lonely third row on a laptop. */}
          <div className="no-scrollbar -mx-4 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {effects.slice(0, 6).map((effect) => (
              <EffectCard
                key={effect.slug}
                effect={effect}
                className="w-[78vw] shrink-0 snap-start sm:w-[320px]"
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Explore feed */}
      <section className="container pt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Explore</p>
            <h2 className="mt-2 text-xl font-normal">Shared by other visitors</h2>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              Anything made here stays private until someone publishes it. Hit Recreate on a tile to
              start from that prompt.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <ExploreFeed initial={feed} />
        </div>
      </section>
    </div>
  );
}
