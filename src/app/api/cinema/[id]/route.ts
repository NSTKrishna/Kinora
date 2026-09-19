import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { draftSpecSchema } from "@/lib/cinema";
import { deleteProject, getProject, toView, updateProject } from "@/lib/cinema-projects";
import { getOwnAsset } from "@/lib/queries";
import { apiError, toResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().trim().max(120).optional(),
  step: z.enum(["scene", "rig", "frames", "motion", "result"]).optional(),
  spec: draftSpecSchema.optional(),
  /** null clears the anchor; a uuid must be one of the caller's own assets. */
  anchorAssetId: z.string().uuid().nullable().optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    const project = await getProject(user.id, id);
    if (!project) return apiError("not_found", "That sequence does not exist.", 404);

    return NextResponse.json({ project: await toView(project) });
  } catch (error) {
    return toResponse(error);
  }
}

/** Autosave. Every step writes here, which is what survives a refresh. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    const patch = patchSchema.parse(await request.json());

    // An anchor has to be a still this user owns — it becomes the first frame
    // of a render we are about to pay for.
    if (patch.anchorAssetId) {
      const asset = await getOwnAsset(user.id, patch.anchorAssetId);
      if (!asset || asset.kind === "video") {
        return apiError("bad_anchor", "That frame is not one of yours.", 400);
      }
    }

    const project = await updateProject(user.id, id, patch);
    if (!project) return apiError("not_found", "That sequence does not exist.", 404);

    return NextResponse.json({ project: await toView(project) });
  } catch (error) {
    return toResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    const removed = await deleteProject(user.id, id);
    if (!removed) return apiError("not_found", "That sequence does not exist.", 404);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
