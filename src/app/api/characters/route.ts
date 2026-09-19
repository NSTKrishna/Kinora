import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { assets, characterAssets, characters } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  assetUrlCandidates,
  CHARACTER_MAX_PHOTOS,
  CHARACTER_MIN_PHOTOS,
  characterCreateSchema,
  type CharacterView,
} from "@/lib/characters";
import { apiError, toResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    const rows = await getDb()
      .select()
      .from(characters)
      .where(eq(characters.userId, user.id))
      .orderBy(desc(characters.createdAt))
      .limit(50);

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
      createdAt: row.createdAt.toISOString(),
    }));

    return NextResponse.json({ characters: view });
  } catch (error) {
    return toResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    const { name, urls } = characterCreateSchema.parse(await request.json());

    // Only the caller's own stills can be saved. A pasted URL from elsewhere
    // is not an asset we hold, so there is nothing to attach it to.
    const candidates = [...new Set(urls.flatMap(assetUrlCandidates))];
    const owned = await getDb()
      .select({ id: assets.id, url: assets.url })
      .from(assets)
      .where(and(eq(assets.userId, user.id), inArray(assets.url, candidates)));

    if (owned.length < CHARACTER_MIN_PHOTOS) {
      return apiError(
        "not_enough_photos",
        `Only ${owned.length} of those are stills you own. A character needs at least ${CHARACTER_MIN_PHOTOS} — upload them first.`,
        400,
      );
    }

    const kept = owned.slice(0, CHARACTER_MAX_PHOTOS);

    const [character] = await getDb()
      .insert(characters)
      .values({ userId: user.id, name, coverAssetId: kept[0].id })
      .returning();

    await getDb()
      .insert(characterAssets)
      .values(kept.map((asset) => ({ characterId: character.id, assetId: asset.id })));

    const view: CharacterView = {
      id: character.id,
      name: character.name,
      urls: kept.map((asset) => asset.url),
      createdAt: character.createdAt.toISOString(),
    };

    // Say so plainly when some photos could not be saved, rather than letting
    // the user believe all of them went in.
    return NextResponse.json({ character: view, skipped: urls.length - kept.length });
  } catch (error) {
    return toResponse(error);
  }
}
