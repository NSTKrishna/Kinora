import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { MediaCard } from "@/components/media-card";
import { ImageStudio } from "@/components/studio/image-studio";
import { getCurrentUser } from "@/lib/auth";
import { getBalance } from "@/lib/credits";
import { modelsByKind, type ModelId } from "@/lib/models";
import { FEED_ITEMS } from "@/lib/placeholder";

export const metadata: Metadata = { title: "Image" };

const RECENT = FEED_ITEMS.filter((item) => item.kind === "image").slice(0, 3);

export default async function ImagePage() {
  const user = await getCurrentUser();
  const balance = user ? await getBalance(user.id) : null;
  const modelIds = modelsByKind("image").map((model) => model.id as ModelId);

  return (
    <div className="container py-8">
      <PageHeader
        eyebrow="Generate"
        title="Image"
        description="One prompt, one still. Pick a model, set the frame, and send it to the queue — renders run async, so you can keep writing."
      />

      <ImageStudio modelIds={modelIds} initialBalance={balance} />

      <section className="mt-12">
        <p className="eyebrow">Recent on Kinora</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {RECENT.map((item, i) => (
            <MediaCard key={item.id} item={item} seed={i + 4} />
          ))}
        </div>
      </section>
    </div>
  );
}
