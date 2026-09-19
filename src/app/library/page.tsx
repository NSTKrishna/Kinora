import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Library" };

const TABS = ["All", "Images", "Videos", "Sequences"];

export default function LibraryPage() {
  return (
    <div className="container py-8">
      <PageHeader
        eyebrow="Your work"
        title="Library"
        description="Everything you render lands here — stills, clips and sequences, newest first. Open any item to recreate or remix it."
      />

      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            type="button"
            className={
              i === 0
                ? "shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs text-foreground"
                : "shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            {tab}
          </button>
        ))}
      </div>

      <EmptyState
        icon={<FolderOpen />}
        title="Your library is empty"
        description="Renders are kept for guests too — start one and it will be waiting here when you come back."
        action={
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/image">Generate an image</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/video">Generate a video</Link>
            </Button>
          </div>
        }
        className="mt-6"
      />
    </div>
  );
}
