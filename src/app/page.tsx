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
import { FEED_ITEMS, posterStyle } from "@/lib/placeholder";

export default async function ExplorePage() {
  const hero = FEED_ITEMS[0];

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
        <section className="container pt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Effects</p>
              <h2 className="mt-1 text-xl font-medium">One photo, one tap</h2>
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
      <section className="container pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Explore</p>
            <h2 className="mt-1 text-xl font-medium">Shared by other visitors</h2>
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
