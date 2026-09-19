import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { assets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { apiError, isUuid, toResponse } from "@/lib/api";
import { serializeAsset } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({ isPublic: z.boolean() });

/** Share or unshare one asset. Public assets are what Explore reads. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return apiError("not_found", "That item does not exist.", 404);

    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    const body = patchSchema.parse(await request.json());

    const [updated] = await getDb()
      .update(assets)
      .set({ isPublic: body.isPublic })
      .where(and(eq(assets.id, id), eq(assets.userId, user.id)))
      .returning();

    if (!updated) return apiError("not_found", "That item is not in your library.", 404);
    return NextResponse.json({ asset: serializeAsset(updated) });
  } catch (error) {
    return toResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return apiError("not_found", "That item does not exist.", 404);

    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    const [deleted] = await getDb()
      .delete(assets)
      .where(and(eq(assets.id, id), eq(assets.userId, user.id)))
      .returning();

    if (!deleted) return apiError("not_found", "That item is not in your library.", 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
