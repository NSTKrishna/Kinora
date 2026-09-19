import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/error-state";
import { CinemaStudio } from "@/components/cinema/cinema-studio";
import { isDatabaseConfigured } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { getBalance } from "@/lib/credits";
import {
  getLatestProject,
  getProject,
  listProjects,
  toView,
  type CinemaProjectView,
} from "@/lib/cinema-projects";
import { MAX_REFERENCES } from "@/lib/cinema";
import { getCharacters } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Cinema",
  description: "A director's panel: scene, rig, frames, motion.",
};

export default async function CinemaPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; new?: string; character?: string }>;
}) {
  const { p, new: fresh, character } = await searchParams;

  if (!isDatabaseConfigured()) {
    return (
      <div className="container py-8">
        <PageHeader eyebrow="Studio" title="Cinema" />
        <ErrorState
          title="Cinema is unavailable"
          description="Sequences are saved server-side, and the database could not be reached."
          action={
            <Button asChild variant="outline">
              <Link href="/video">Open the video composer</Link>
            </Button>
          }
          className="mt-8"
        />
      </div>
    );
  }

  const user = await getCurrentUser();
  const balance = user ? await getBalance(user.id) : null;

  // `?p=` names a sequence, `?new=1` forces a blank panel, and a bare /cinema
  // resumes the last one — so coming back to the tab picks up where it stopped.
  let project: CinemaProjectView | null = null;
  if (user && !fresh) {
    const row = p ? await getProject(user.id, p) : await getLatestProject(user.id);
    if (row) project = await toView(row);
  }

  const projects = user ? await listProjects(user.id) : [];

  // `?character=` comes from the Characters page: open a fresh panel with that
  // character's photos already in the reference slots, capped at what the
  // frames model can take.
  let referenceUrls: string[] = [];
  if (user && character) {
    const saved = (await getCharacters(user.id)).find((entry) => entry.id === character);
    referenceUrls = saved?.urls.slice(0, MAX_REFERENCES) ?? [];
  }

  return (
    <div className="container py-8">
      <PageHeader
        eyebrow="Studio"
        title="Cinema"
        description="A director's panel. Describe the shot, choose the rig, render four frames, pick one and give it a camera move. Every step is saved as you go."
      />

      <CinemaStudio
        initialProject={project}
        initialBalance={balance}
        projects={projects}
        initialReferenceUrls={referenceUrls}
      />
    </div>
  );
}
