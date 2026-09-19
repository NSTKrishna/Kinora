import "server-only";

import { and, desc, eq, inArray, lt } from "drizzle-orm";

import { getDb } from "@/db";
import { assets, jobs } from "@/db/schema";
import { serializeAsset, serializeJob, type AssetView, type JobView } from "@/lib/serialize";

export type JobWithAssets = JobView & { assets: AssetView[] };

/**
 * The studio's starting state.
 *
 * Jobs live in Postgres, not in the tab, so a refresh mid-render picks the
 * queue back up exactly where it was — including anything that finished while
 * the page was closed.
 */
export async function getRecentJobs(
  userId: string,
  kind: "image" | "video",
  limit = 8,
): Promise<JobWithAssets[]> {
  const rows = await getDb()
    .select()
    .from(jobs)
    .where(and(eq(jobs.userId, userId), eq(jobs.kind, kind)))
    .orderBy(desc(jobs.createdAt))
    .limit(limit);

  if (!rows.length) return [];

  const jobAssets = await getDb()
    .select()
    .from(assets)
    .where(
      inArray(
        assets.jobId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(desc(assets.createdAt));

  return rows.map((job) => ({
    ...serializeJob(job),
    assets: jobAssets.filter((asset) => asset.jobId === job.id).map(serializeAsset),
  }));
}

/** One of the user's own assets, for "Animate" and "Use as reference". */
export async function getOwnAsset(userId: string, assetId: string): Promise<AssetView | null> {
  const [asset] = await getDb()
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.userId, userId)))
    .limit(1);
  return asset ? serializeAsset(asset) : null;
}

/** The stored input of one of the user's jobs, for "Recreate". */
export async function getOwnJob(userId: string, jobId: string): Promise<JobView | null> {
  const [job] = await getDb()
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
    .limit(1);
  return job ? serializeJob(job) : null;
}

export const LIBRARY_PAGE_SIZE = 24;

/**
 * One page of the library, newest first. The server renders the first page so
 * the grid has something real on first paint; the client asks for the rest.
 */
export async function getLibraryPage(
  userId: string,
  filter: "all" | "image" | "video",
  cursor?: string,
): Promise<{ assets: AssetView[]; nextCursor: string | null }> {
  const kinds = filter === "all" ? (["image", "video", "upload"] as const) : ([filter] as const);

  const rows = await getDb()
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.userId, userId),
        inArray(assets.kind, [...kinds]),
        cursor ? lt(assets.createdAt, new Date(cursor)) : undefined,
      ),
    )
    .orderBy(desc(assets.createdAt))
    .limit(LIBRARY_PAGE_SIZE + 1);

  // One extra row tells us whether another page exists without a count query.
  const hasMore = rows.length > LIBRARY_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, LIBRARY_PAGE_SIZE) : rows;

  return {
    assets: page.map(serializeAsset),
    nextCursor: hasMore ? page[page.length - 1].createdAt.toISOString() : null,
  };
}
