import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { closeDb, getDb } from "@/db";
import { assets as assetsTable, jobs, type Job } from "@/db/schema";
import { getBalance, grantStarter, charge } from "@/lib/credits";
import { transition } from "@/lib/jobs";
import { createTestUser, deleteTestUser, requireTestDatabase } from "./helpers";

describe("job transitions", () => {
  const created: string[] = [];

  async function setup(cost = 6) {
    const userId = await createTestUser();
    created.push(userId);
    await grantStarter(userId, 30);

    const [job] = await getDb()
      .insert(jobs)
      .values({
        userId,
        kind: "image",
        modelId: "flux-schnell",
        status: "queued",
        input: { prompt: "test" },
        compiledPrompt: "test",
        provider: "mock",
        costCredits: cost,
        providerRequestId: `mock:ok:${Date.now()}:1:${randomUUID()}`,
      })
      .returning();

    await charge({ userId, jobId: job.id, cost });
    return { userId, job };
  }

  async function reload(job: Job) {
    const [row] = await getDb().select().from(jobs).where(eq(jobs.id, job.id)).limit(1);
    return row;
  }

  beforeAll(() => requireTestDatabase());
  afterEach(async () => {
    await Promise.all(created.splice(0).map(deleteTestUser));
  });
  afterAll(async () => closeDb());

  it("does not refund a job that is merely running", async () => {
    const { userId, job } = await setup(6);
    expect(await getBalance(userId)).toBe(24);

    await transition(job, { status: "running" });

    // The render is still coming. The credits stay spent.
    expect(await getBalance(userId)).toBe(24);
  });

  it("saves assets on completion and refunds nothing", async () => {
    const { userId, job } = await setup(6);

    await transition(job, {
      status: "completed",
      assets: [{ kind: "image", url: "https://example.test/a.png", width: 8, height: 8 }],
    });

    const saved = await getDb().select().from(assetsTable).where(eq(assetsTable.jobId, job.id));
    expect(saved).toHaveLength(1);
    expect(await getBalance(userId)).toBe(24);
    expect((await reload(job))?.completedAt).not.toBeNull();
  });

  it("refunds exactly once on failure", async () => {
    const { userId, job } = await setup(6);

    await transition(job, { status: "failed", error: "boom" });
    expect(await getBalance(userId)).toBe(30);

    // The webhook and the poller both arriving must not pay out twice.
    await transition(job, { status: "failed", error: "boom" });
    expect(await getBalance(userId)).toBe(30);
  });

  it("refunds on nsfw and on cancel", async () => {
    const flagged = await setup(6);
    await transition(flagged.job, { status: "nsfw", error: "flagged" });
    expect(await getBalance(flagged.userId)).toBe(30);

    const canceled = await setup(6);
    await transition(canceled.job, { status: "canceled", error: "by you" });
    expect(await getBalance(canceled.userId)).toBe(30);
  });

  it("will not move a job that already finished", async () => {
    const { userId, job } = await setup(6);

    await transition(job, { status: "failed", error: "boom" });
    // A late completion callback must not resurrect it or re-charge anyone.
    const after = await transition(job, {
      status: "completed",
      assets: [{ kind: "image", url: "https://example.test/late.png" }],
    });

    expect(after.status).toBe("failed");
    expect(await getBalance(userId)).toBe(30);
    expect(
      await getDb().select().from(assetsTable).where(eq(assetsTable.jobId, job.id)),
    ).toHaveLength(0);
  });
});
