import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { assets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { apiError, toResponse } from "@/lib/api";
import { serializeAsset } from "@/lib/serialize";
import { getLibraryPage } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const filterSchema = z.enum(["all", "image", "video"]).default("all");

const recordSchema = z.object({
  url: z.string().url(),
  width: z.coerce.number().int().positive().optional(),
  height: z.coerce.number().int().positive().optional(),
});

/** One page of the current user's library, newest first. */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    const filter = filterSchema.parse(request.nextUrl.searchParams.get("filter") ?? "all");
    const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;

    return NextResponse.json(await getLibraryPage(user.id, filter, cursor));
  } catch (error) {
    return toResponse(error);
  }
}

/** Records a file the browser uploaded straight to Blob storage. */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    const body = recordSchema.parse(await request.json());

    // Only accept URLs from blob storage: this endpoint must not become a way
    // to attach arbitrary remote images to an account.
    if (!/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(body.url)) {
      return apiError("invalid_url", "That file did not come from Kinora's storage.", 400);
    }

    // The Blob webhook may have recorded this already on a real deployment;
    // locally it cannot fire at all. Either way, one row per URL.
    const [existing] = await getDb()
      .select()
      .from(assets)
      .where(and(eq(assets.userId, user.id), eq(assets.url, body.url)))
      .limit(1);

    if (existing) return NextResponse.json({ asset: serializeAsset(existing) });

    const [asset] = await getDb()
      .insert(assets)
      .values({
        userId: user.id,
        kind: "upload",
        url: body.url,
        width: body.width ?? null,
        height: body.height ?? null,
      })
      .returning();

    return NextResponse.json({ asset: serializeAsset(asset) });
  } catch (error) {
    return toResponse(error);
  }
}
