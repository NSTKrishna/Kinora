import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { assets, characterAssets, characters } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { MAX_REFERENCES } from "@/lib/cinema";
import { apiError, toResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Characters are reference images under a name — no training, per the brief.
 * They exist so a sequence can be pointed at "the same person as last time"
 * without hunting through the library for the four stills again.
 */

export type CharacterView = { id: string; name: string; urls: string[] };

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    const rows = await getDb()
      .select()
      .from(characters)
      .where(eq(characters.userId, user.id))
      .orderBy(desc(characters.createdAt))
      .limit(24);

    if (!rows.length) return NextResponse.json({ characters: [] });

    const links = await getDb()
      .select({ characterId: characterAssets.characterId, url: assets.url })
      .from(characterAssets)
      .innerJoin(assets, eq(assets.id, characterAssets.assetId))
      .where(
        inArray(
          characterAssets.characterId,
          rows.map((row) => row.id),
        ),
      );

    const view: CharacterView[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      urls: links.filter((link) => link.characterId === row.id).map((link) => link.url),
    }));

    return NextResponse.json({ characters: view });
  } catch (error) {
    return toResponse(error);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Give the character a name.").max(60),
  urls: z.array(z.string().url()).min(1).max(MAX_REFERENCES),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    const { name, urls } = createSchema.parse(await request.json());

    // Only the caller's own stills can be saved. A pasted URL from elsewhere
    // is not an asset we hold, so there is nothing to attach it to.
    const owned = await getDb()
      .select({ id: assets.id, url: assets.url })
      .from(assets)
      .where(and(eq(assets.userId, user.id), inArray(assets.url, urls)));

    if (!owned.length) {
      return apiError(
        "no_owned_assets",
        "Upload the reference images first — a character is built from your own stills.",
        400,
      );
    }

    const [character] = await getDb()
      .insert(characters)
      .values({ userId: user.id, name, coverAssetId: owned[0].id })
      .returning();

    await getDb()
      .insert(characterAssets)
      .values(owned.map((asset) => ({ characterId: character.id, assetId: asset.id })));

    const view: CharacterView = {
      id: character.id,
      name: character.name,
      urls: owned.map((asset) => asset.url),
    };

    // Say so plainly when some references could not be saved, rather than
    // letting the user believe all four went in.
    return NextResponse.json({
      character: view,
      skipped: urls.length - owned.length,
    });
  } catch (error) {
    return toResponse(error);
  }
}
