import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { generatedMedia } from "@/db/schema";
import { apiError, isUuid } from "@/lib/api";

export const runtime = "nodejs";

/**
 * Serves an image Kinora holds itself.
 *
 * Cloudflare Workers AI returns bytes rather than a URL, and with no object
 * store configured they live in Postgres. Rows are immutable, so this is
 * cacheable forever — the database is read once per image per client, and
 * never again.
 *
 * Deliberately unauthenticated: the id is an unguessable uuid, these are the
 * same images that get published to Explore, and putting a session check here
 * would break every <img> tag on a shared page.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isUuid(id)) return apiError("not_found", "That image does not exist.", 404);

  const [row] = await getDb()
    .select({
      bytes: generatedMedia.bytes,
      contentType: generatedMedia.contentType,
    })
    .from(generatedMedia)
    .where(eq(generatedMedia.id, id))
    .limit(1);

  if (!row) return apiError("not_found", "That image does not exist.", 404);

  return new Response(new Uint8Array(row.bytes), {
    headers: {
      "content-type": row.contentType,
      "content-length": String(row.bytes.length),
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
