import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { draftSpecSchema, defaultSpec } from "@/lib/cinema";
import { createProject, toView } from "@/lib/cinema-projects";
import { apiError, toResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Start a sequence. Created lazily on the first real edit, never on a page view. */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    const body = (await request.json().catch(() => ({}))) as { spec?: unknown; title?: string };
    const spec = draftSpecSchema.parse(body.spec ?? defaultSpec());

    const project = await createProject(user.id, spec, body.title);
    return NextResponse.json({ project: await toView(project) });
  } catch (error) {
    return toResponse(error);
  }
}
