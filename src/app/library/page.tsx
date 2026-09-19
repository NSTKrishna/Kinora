import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { LibraryGrid } from "@/components/library/library-grid";
import { getCurrentUser } from "@/lib/auth";
import { getLibraryPage } from "@/lib/queries";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="container py-8">
        <PageHeader eyebrow="Your work" title="Library" />
        <EmptyState
          icon={<FolderOpen />}
          title="Your library is empty"
          description="Start a render and it will be waiting here when you come back."
          action={
            <Button asChild>
              <Link href="/image">Generate an image</Link>
            </Button>
          }
          className="mt-6"
        />
      </div>
    );
  }

  const initial = await getLibraryPage(user.id, "all");

  return (
    <div className="container py-8">
      <PageHeader
        eyebrow="Your work"
        title="Library"
        description="Everything you render lands here — stills, clips and uploads, newest first. Recreate any of them with the same settings, or share one to Explore."
      />

      <LibraryGrid initial={initial} />
    </div>
  );
}
