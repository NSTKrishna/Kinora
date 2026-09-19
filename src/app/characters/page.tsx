import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/error-state";
import { CharacterManager } from "@/components/characters/character-manager";
import { isDatabaseConfigured } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { getCharacters } from "@/lib/queries";
import type { CharacterView } from "@/lib/characters";

export const metadata: Metadata = {
  title: "Characters",
  description: "Stored reference photos you can attach to any render.",
};

export default async function CharactersPage() {
  const user = isDatabaseConfigured() ? await getCurrentUser() : null;
  const characters: CharacterView[] = user ? await getCharacters(user.id).catch(() => []) : [];

  return (
    <div className="container py-8">
      <PageHeader
        eyebrow="Identity"
        title="Characters"
        description="A character is a named set of reference photos. Nothing is trained — Kinora stores them and attaches them to models that accept references, so the same face, prop or place carries across renders."
        actions={
          <Button asChild variant="outline">
            <Link href="/library">Open library</Link>
          </Button>
        }
      />

      {user ? (
        <CharacterManager initial={characters} />
      ) : (
        <ErrorState
          title="Characters are unavailable"
          description="They are saved server-side, and the database could not be reached."
          className="mt-8"
        />
      )}
    </div>
  );
}
