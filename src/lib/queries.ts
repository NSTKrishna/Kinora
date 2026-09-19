import "server-only";

import { and, desc, eq, inArray, isNotNull, lt } from "drizzle-orm";

import { getDb } from "@/db";
import { assets, characterAssets, characters, jobs } from "@/db/schema";
import { getModel } from "@/lib/models";
import {
  serializeAsset,
  serializeJob,
  type AssetView,
  type ExploreItem,
  type JobView,
} from "@/lib/serialize";

export type { ExploreItem };

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
  /** Effect pages show only their own runs, not the whole video queue. */
  presetSlug?: string,
): Promise<JobWithAssets[]> {
  const rows = await getDb()
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.userId, userId),
        eq(jobs.kind, kind),
        presetSlug ? eq(jobs.presetSlug, presetSlug) : undefined,
      ),
    )
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

/* ---------------------------------------------------------------- explore */

export const EXPLORE_PAGE_SIZE = 24;

export type ExploreFilter = "all" | "image" | "video" | "effect";

/**
 * The Explore feed.
 *
 * Public assets only, newest first, and nothing about the author beyond the
 * work itself — a guest who shares a render has not agreed to be identified.
 * The join is on the job so an effect render can be told apart from a
 * composer one, which is what the Effects filter needs.
 */
export async function getPublicFeed(
  filter: ExploreFilter = "all",
  cursor?: string,
): Promise<{ items: ExploreItem[]; nextCursor: string | null }> {
  const kinds =
    filter === "image" || filter === "video" ? ([filter] as const) : (["image", "video"] as const);

  const rows = await getDb()
    .select({ asset: assets, presetSlug: jobs.presetSlug })
    .from(assets)
    .leftJoin(jobs, eq(jobs.id, assets.jobId))
    .where(
      and(
        eq(assets.isPublic, true),
        inArray(assets.kind, [...kinds]),
        filter === "effect" ? isNotNull(jobs.presetSlug) : undefined,
        cursor ? lt(assets.createdAt, new Date(cursor)) : undefined,
      ),
    )
    .orderBy(desc(assets.createdAt))
    .limit(EXPLORE_PAGE_SIZE + 1);

  const hasMore = rows.length > EXPLORE_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, EXPLORE_PAGE_SIZE) : rows;

  return {
    items: page.map((row) => ({
      ...serializeAsset(row.asset),
      presetSlug: row.presetSlug,
      modelLabel: row.asset.modelId ? (getModel(row.asset.modelId)?.label ?? null) : null,
    })),
    nextCursor: hasMore ? page[page.length - 1].asset.createdAt.toISOString() : null,
  };
}

/** One public asset, for a shared link straight to the detail view. */
export async function getPublicAsset(assetId: string): Promise<ExploreItem | null> {
  const [row] = await getDb()
    .select({ asset: assets, presetSlug: jobs.presetSlug })
    .from(assets)
    .leftJoin(jobs, eq(jobs.id, assets.jobId))
    .where(and(eq(assets.id, assetId), eq(assets.isPublic, true)))
    .limit(1);

  if (!row) return null;
  return {
    ...serializeAsset(row.asset),
    presetSlug: row.presetSlug,
    modelLabel: row.asset.modelId ? (getModel(row.asset.modelId)?.label ?? null) : null,
  };
}

/* ------------------------------------------------------------- characters */

/** The user's characters with their reference URLs, for pages and pickers. */
export async function getCharacters(userId: string) {
  const rows = await getDb()
    .select()
    .from(characters)
    .where(eq(characters.userId, userId))
    .orderBy(desc(characters.createdAt))
    .limit(50);

  if (!rows.length) return [];

  const links = await getDb()
    .select({ characterId: characterAssets.characterId, url: assets.url })
    .from(characterAssets)
    .innerJoin(assets, eq(assets.id, characterAssets.assetId))
    .where(
      inArray(
        characterAssets.characterId,
        rows.map((row) => row.id),
      ),
    );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    urls: links.filter((link) => link.characterId === row.id).map((link) => link.url),
    createdAt: row.createdAt.toISOString(),
  }));
}
