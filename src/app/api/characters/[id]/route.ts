import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { characters } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { apiError, isUuid, toResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Removes the character. The stills themselves stay in the library. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return apiError("not_found", "That character does not exist.", 404);
    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    const rows = await getDb()
      .delete(characters)
      .where(and(eq(characters.id, id), eq(characters.userId, user.id)))
      .returning({ id: characters.id });

    if (!rows.length) return apiError("not_found", "That character does not exist.", 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
