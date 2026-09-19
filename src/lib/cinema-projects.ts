import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { assets, cinemaProjects, jobs, type CinemaProject } from "@/db/schema";
import { furthestStep, readDraft, type CinemaDraft, type CinemaStep } from "@/lib/cinema";
import { serializeAsset, serializeJob, type AssetView, type JobView } from "@/lib/serialize";

/** Compile-time proof that the step list and the pgEnum cannot drift apart. */
type StepsMatch = CinemaStep extends CinemaProject["step"]
  ? CinemaProject["step"] extends CinemaStep
    ? true
    : never
  : never;
const _stepsMatch: StepsMatch = true;
void _stepsMatch;

export type JobWithAssets = JobView & { assets: AssetView[] };

/** Everything the stepper needs to resume, in one shape. */
export type CinemaProjectView = {
  id: string;
  title: string;
  step: CinemaStep;
  spec: CinemaDraft;
  frames: JobWithAssets | null;
  anchor: AssetView | null;
  video: JobWithAssets | null;
  updatedAt: string;
};

async function jobWithAssets(jobId: string | null): Promise<JobWithAssets | null> {
  if (!jobId) return null;
  const [job] = await getDb().select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) return null;
  const rows = await getDb()
    .select()
    .from(assets)
    .where(eq(assets.jobId, job.id))
    .orderBy(assets.createdAt);
  return { ...serializeJob(job), assets: rows.map(serializeAsset) };
}

export async function toView(project: CinemaProject): Promise<CinemaProjectView> {
  const [frames, video] = await Promise.all([
    jobWithAssets(project.framesJobId),
    jobWithAssets(project.videoJobId),
  ]);

  let anchor: AssetView | null = null;
  if (project.anchorAssetId) {
    const [row] = await getDb()
      .select()
      .from(assets)
      .where(and(eq(assets.id, project.anchorAssetId), eq(assets.userId, project.userId)))
      .limit(1);
    anchor = row ? serializeAsset(row) : null;
  }

  // A clip that finished while the tab was closed means the sequence is done,
  // whatever step it was on when the browser last wrote to us.
  const step = video?.status === "completed" ? furthestStep(project.step, "result") : project.step;

  return {
    id: project.id,
    title: project.title,
    step,
    // Read through the tolerant schema so an old project still opens.
    spec: readDraft(project.spec),
    frames,
    anchor,
    video,
    updatedAt: project.updatedAt.toISOString(),
  };
}

export async function getProject(userId: string, id: string): Promise<CinemaProject | null> {
  const [project] = await getDb()
    .select()
    .from(cinemaProjects)
    .where(and(eq(cinemaProjects.id, id), eq(cinemaProjects.userId, userId)))
    .limit(1);
  return project ?? null;
}

/** What `/cinema` resumes when no project is named in the URL. */
export async function getLatestProject(userId: string): Promise<CinemaProject | null> {
  const [project] = await getDb()
    .select()
    .from(cinemaProjects)
    .where(eq(cinemaProjects.userId, userId))
    .orderBy(desc(cinemaProjects.updatedAt))
    .limit(1);
  return project ?? null;
}

export async function listProjects(userId: string, limit = 12) {
  const rows = await getDb()
    .select({
      id: cinemaProjects.id,
      title: cinemaProjects.title,
      step: cinemaProjects.step,
      updatedAt: cinemaProjects.updatedAt,
    })
    .from(cinemaProjects)
    .where(eq(cinemaProjects.userId, userId))
    .orderBy(desc(cinemaProjects.updatedAt))
    .limit(limit);

  return rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
}

export async function createProject(userId: string, spec: CinemaDraft, title?: string) {
  const [project] = await getDb()
    .insert(cinemaProjects)
    .values({ userId, spec, title: title?.trim() || "Untitled sequence" })
    .returning();
  return project;
}

type ProjectPatch = {
  title?: string;
  step?: CinemaStep;
  /**
   * Rewinds the high-water mark. Re-rendering the frames throws away the
   * anchor and the clip, so the sequence really has gone backwards and
   * pretending otherwise would leave Result reachable with nothing in it.
   */
  resetStep?: boolean;
  spec?: CinemaDraft;
  framesJobId?: string | null;
  anchorAssetId?: string | null;
  videoJobId?: string | null;
};

/**
 * Scoped to the owner in the WHERE clause, not checked beforehand — one
 * statement, and no window where someone else's project could be written.
 */
export async function updateProject(
  userId: string,
  id: string,
  patch: ProjectPatch,
): Promise<CinemaProject | null> {
  const db = getDb();
  const scope = and(eq(cinemaProjects.id, id), eq(cinemaProjects.userId, userId));

  const { resetStep, ...fields } = patch;

  // `step` only ever moves forward, unless a stage was explicitly redone.
  let step = patch.step;
  if (step && !resetStep) {
    const [current] = await db
      .select({ step: cinemaProjects.step })
      .from(cinemaProjects)
      .where(scope)
      .limit(1);
    if (!current) return null;
    step = furthestStep(current.step, step);
  }

  const [project] = await db
    .update(cinemaProjects)
    .set({ ...fields, ...(step ? { step } : {}), updatedAt: new Date() })
    .where(scope)
    .returning();
  return project ?? null;
}

export async function deleteProject(userId: string, id: string): Promise<boolean> {
  const rows = await getDb()
    .delete(cinemaProjects)
    .where(and(eq(cinemaProjects.id, id), eq(cinemaProjects.userId, userId)))
    .returning({ id: cinemaProjects.id });
  return rows.length > 0;
}
