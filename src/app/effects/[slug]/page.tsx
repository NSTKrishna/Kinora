import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EffectRunner } from "@/components/effects/effect-runner";
import { isDatabaseConfigured } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { getBalance } from "@/lib/credits";
import { getPreset, serializePreset } from "@/lib/presets";
import { getRecentJobs } from "@/lib/queries";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  if (!isDatabaseConfigured()) return { title: "Effect" };

  const preset = await getPreset(slug).catch(() => null);
  if (!preset) return { title: "Effect" };
  return { title: preset.title, description: preset.description ?? undefined };
}

export default async function EffectPage({ params }: Params) {
  const { slug } = await params;
  if (!isDatabaseConfigured()) notFound();

  const preset = await getPreset(slug);
  if (!preset) notFound();

  const effect = serializePreset(preset);

  const user = await getCurrentUser();
  const balance = user ? await getBalance(user.id) : null;
  // Only this effect's runs, so the page is about one thing. They come from
  // Postgres, so a refresh mid-render picks the same job back up.
  const jobs = user ? await getRecentJobs(user.id, "video", 6, preset.slug) : [];

  return (
    <div className="container py-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4 text-muted-foreground">
        <Link href="/effects">
          <ArrowLeft />
          All effects
        </Link>
      </Button>

      <PageHeader
        eyebrow="Effect"
        title={effect.title}
        description={effect.description ?? undefined}
        actions={
          <Button asChild variant="outline">
            <Link href="/effects">Try another</Link>
          </Button>
        }
      />

      <EffectRunner effect={effect} initialBalance={balance} initialJobs={jobs} />
    </div>
  );
}
