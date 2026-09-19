import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isDatabaseConfigured } from "@/db";
import { getPublicFeed } from "@/lib/queries";
import { toResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const filterSchema = z.enum(["all", "image", "video", "effect"]).default("all");

/** Public by design: no session needed to read the feed. */
export async function GET(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) return NextResponse.json({ items: [], nextCursor: null });

    const filter = filterSchema.parse(request.nextUrl.searchParams.get("filter") ?? "all");
    const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;

    return NextResponse.json(await getPublicFeed(filter, cursor));
  } catch (error) {
    return toResponse(error);
  }
}
