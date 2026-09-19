import type { Metadata } from "next";
import Link from "next/link";
import { Wand2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { EffectsGrid } from "@/components/effects/effects-grid";
import { isDatabaseConfigured } from "@/db";
import { getEffects } from "@/lib/presets";
import type { EffectView } from "@/lib/presets";

export const metadata: Metadata = {
  title: "Effects",
  description: "One-click effects. Add a photo, get a clip back.",
};

export default async function EffectsPage() {
  let effects: EffectView[] = [];
  let failed = false;

  if (isDatabaseConfigured()) {
    try {
      effects = await getEffects();
    } catch {
      failed = true;
    }
  } else {
    failed = true;
  }

  return (
    <div className="container py-8">
      <PageHeader
        eyebrow="Presets"
        title="Effects"
        description="One photo in, one clip out. Every effect is a fixed recipe — the camera move, the lighting and the model are already decided, so there is one thing left to choose."
        actions={
          <Button asChild variant="outline">
            <Link href="/video">Open the video composer</Link>
          </Button>
        }
      />

      {failed ? (
        <ErrorState
          title="Effects are unavailable"
          description="The preset library could not be reached. The composer still works."
          action={
            <Button asChild variant="outline">
              <Link href="/video">Open the video composer</Link>
            </Button>
          }
          className="mt-8"
        />
      ) : effects.length === 0 ? (
        <EmptyState
          icon={<Wand2 />}
          title="No effects yet"
          description="The preset library is empty. Run `pnpm db:seed` to load them."
          className="mt-8"
        />
      ) : (
        <EffectsGrid effects={effects} />
      )}
    </div>
  );
}
