import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { apiError, toResponse } from "@/lib/api";
import {
  ALLOWED_UPLOAD_TYPES,
  isCloudinaryConfigured,
  MAX_UPLOAD_BYTES,
  signedUpload,
} from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mints a one-shot signature so the browser can post a file straight to
 * Cloudinary. The bytes never pass through this function, which is what keeps
 * a 12MB phone photo working on Vercel — a serverless request body is capped
 * at roughly 4.5MB on the Hobby plan.
 *
 * The signed public id carries the caller's own user id, and /api/assets will
 * only record a URL whose path contains it. That is what stops this becoming a
 * way to attach an arbitrary remote image to an account.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    if (!isCloudinaryConfigured()) {
      return apiError(
        "uploads_unavailable",
        "Uploads are not configured on this deployment. Paste an image URL instead.",
        503,
      );
    }

    const signed = signedUpload(user.id);

    return NextResponse.json({
      ...signed,
      maxBytes: MAX_UPLOAD_BYTES,
      allowedTypes: ALLOWED_UPLOAD_TYPES,
    });
  } catch (error) {
    return toResponse(error);
  }
}
