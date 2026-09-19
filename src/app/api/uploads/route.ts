import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "@/db";
import { assets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { apiError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/avif"];

/**
 * Uploads go straight from the browser to Vercel Blob. This route only mints a
 * scoped token and records the finished file — the bytes never pass through it,
 * so a big reference image cannot tie up a serverless function.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return apiError(
      "uploads_unavailable",
      "Uploads are not configured on this deployment. Paste an image URL instead.",
      503,
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED,
        maximumSizeInBytes: MAX_UPLOAD_BYTES,
        addRandomSuffix: true,
        // Echoed back to us on completion; never trusted for identity beyond this.
        tokenPayload: JSON.stringify({ userId: user.id }),
      }),
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const { userId } = JSON.parse(tokenPayload ?? "{}") as { userId?: string };
        if (!userId) return;

        await getDb().insert(assets).values({
          userId,
          kind: "upload",
          url: blob.url,
          isPublic: false,
        });
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return apiError("upload_failed", message, 400);
  }
}
