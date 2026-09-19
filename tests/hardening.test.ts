import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import { closeDb, getDb } from "@/db";
import { jobs, users, type Job } from "@/db/schema";
import { charge, getBalance, grantStarter, STARTER_CREDITS } from "@/lib/credits";
import {
  assertCanGenerate,
  CapacityError,
  capacitySnapshot,
  countActiveJobs,
  MAX_ACTIVE_JOBS_PER_USER,
  MAX_GUESTS_PER_IP_PER_DAY,
} from "@/lib/guards";
import {
  countStuckJobs,
  resetSweepThrottle,
  STUCK_AFTER_MS,
  sweepOpportunistically,
  sweepStuckJobs,
  transition,
} from "@/lib/jobs";
import { retry, TimeoutError, withTimeout } from "@/lib/retry";
import { createTestUser, deleteTestUser, requireTestDatabase } from "./helpers";

const created: string[] = [];

async function newUser(credits = 200) {
  const userId = await createTestUser();
  created.push(userId);
  await grantStarter(userId, credits);
  return userId;
}

async function makeJob(
  userId: string,
  options: { cost?: number; status?: Job["status"]; ageMs?: number } = {},
) {
  const { cost = 6, status = "running", ageMs = 0 } = options;
  const createdAt = new Date(Date.now() - ageMs);

  const [job] = await getDb()
    .insert(jobs)
    .values({
      userId,
      kind: "image",
      modelId: "flux-schnell",
      status,
      input: { prompt: "test" },
      compiledPrompt: "test",
      provider: "mock",
      costCredits: cost,
      createdAt,
      providerRequestId: `mock:${randomUUID()}`,
    })
    .returning();

  await charge({ userId, jobId: job.id, cost });
  return job;
}

beforeAll(requireTestDatabase);
afterEach(async () => {
  while (created.length) await deleteTestUser(created.pop()!);
});
afterAll(closeDb);

/* ----------------------------------------------------------- cost safety */

describe("cost safety", () => {
  it("refuses a third render while two are in flight", async () => {
    const userId = await newUser();
    for (let i = 0; i < MAX_ACTIVE_JOBS_PER_USER; i += 1) await makeJob(userId);

    expect(await countActiveJobs(userId)).toBe(MAX_ACTIVE_JOBS_PER_USER);
    await expect(assertCanGenerate({ userId, cost: 2 })).rejects.toMatchObject({
      code: "too_many_active_jobs",
    });
  });

  it("lets a render through once one finishes", async () => {
    const userId = await newUser();
    const first = await makeJob(userId);
    await makeJob(userId);

    await transition(first, { status: "completed", assets: [] });
    await expect(assertCanGenerate({ userId, cost: 2 })).resolves.toBeUndefined();
  });

  it("caps new guests from one network per day", async () => {
    const ipHash = `test-${randomUUID()}`;

    // The guard counts guests created today, so make more than the limit.
    for (let i = 0; i <= MAX_GUESTS_PER_IP_PER_DAY; i += 1) {
      const [user] = await getDb()
        .insert(users)
        .values({ isGuest: true, signupIpHash: ipHash })
        .returning();
      created.push(user.id);
    }

    const userId = created[created.length - 1];
    await grantStarter(userId, 50);

    await expect(assertCanGenerate({ userId, cost: 2, ipHash })).rejects.toMatchObject({
      code: "too_many_guests",
    });
    // A different network is unaffected.
    await expect(
      assertCanGenerate({ userId, cost: 2, ipHash: `other-${randomUUID()}` }),
    ).resolves.toBeUndefined();
  });

  it("refuses everything once the global daily cap is reached", async () => {
    const userId = await newUser(10_000);
    const before = await capacitySnapshot();

    // Spend up to the cap. Charges are what the cap counts.
    const toSpend = before.remaining;
    if (toSpend > 0) {
      const [job] = await getDb()
        .insert(jobs)
        .values({
          userId,
          kind: "image",
          modelId: "flux-schnell",
          status: "completed",
          input: {},
          compiledPrompt: "cap",
          provider: "mock",
          costCredits: toSpend,
        })
        .returning();
      await getDb().execute(
        sql`insert into credit_ledger (user_id, delta, kind, idempotency_key, job_id)
            values (${userId}, ${-toSpend}, 'charge', ${`cap:${job.id}`}, ${job.id})`,
      );
    }

    const after = await capacitySnapshot();
    expect(after.remaining).toBe(0);
    expect(after.used).toBe(1);

    await expect(assertCanGenerate({ userId, cost: 1 })).rejects.toBeInstanceOf(CapacityError);
    await expect(assertCanGenerate({ userId, cost: 1 })).rejects.toMatchObject({
      code: "daily_cap_reached",
    });
  });
});

/* -------------------------------------------------------------- the sweep */

describe("the stuck-job sweep", () => {
  it("fails and refunds a job abandoned past the deadline", async () => {
    const userId = await newUser();
    const job = await makeJob(userId, { cost: 20, ageMs: STUCK_AFTER_MS + 60_000 });
    expect(await getBalance(userId)).toBe(180);

    expect(await countStuckJobs()).toBeGreaterThan(0);
    await sweepStuckJobs();

    const [row] = await getDb().select().from(jobs).where(eq(jobs.id, job.id)).limit(1);
    expect(row.status).toBe("failed");
    expect(row.error).toMatch(/stopped responding/);
    expect(await getBalance(userId)).toBe(200);
  });

  it("leaves a job that is merely slow alone", async () => {
    const userId = await newUser();
    const job = await makeJob(userId, { cost: 20, ageMs: STUCK_AFTER_MS - 60_000 });

    await sweepStuckJobs();

    const [row] = await getDb().select().from(jobs).where(eq(jobs.id, job.id)).limit(1);
    expect(row.status).toBe("running");
    expect(await getBalance(userId)).toBe(180);
  });

  it("refunds exactly once even if it sweeps twice", async () => {
    const userId = await newUser();
    await makeJob(userId, { cost: 20, ageMs: STUCK_AFTER_MS + 60_000 });

    await sweepStuckJobs();
    await sweepStuckJobs();

    expect(await getBalance(userId)).toBe(200);
  });

  it("throttles itself so it cannot run on every request", async () => {
    const userId = await newUser();
    await makeJob(userId, { cost: 20, ageMs: STUCK_AFTER_MS + 60_000 });

    resetSweepThrottle();
    await sweepOpportunistically();
    expect(await getBalance(userId)).toBe(200);

    // A second job goes stale, but the throttle means this call does nothing.
    const second = await makeJob(userId, { cost: 20, ageMs: STUCK_AFTER_MS + 60_000 });
    await sweepOpportunistically();

    const [row] = await getDb().select().from(jobs).where(eq(jobs.id, second.id)).limit(1);
    expect(row.status).toBe("running");
  });
});

/* ------------------------------------------------------ timeouts + retry */

describe("timeouts and retries", () => {
  it("gives up on a call that never resolves", async () => {
    const forever = new Promise<never>(() => {});
    await expect(withTimeout(forever, 20, "test call")).rejects.toBeInstanceOf(TimeoutError);
  });

  it("passes a fast call straight through", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 500, "test")).resolves.toBe("ok");
  });

  it("retries a flaky read and then succeeds", async () => {
    let calls = 0;
    const result = await retry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("fetch failed");
        return "ok";
      },
      { attempts: 3, baseMs: 1 },
    );

    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("gives up after the last attempt and reports the real error", async () => {
    let calls = 0;
    await expect(
      retry(
        async () => {
          calls += 1;
          throw new Error("still broken");
        },
        { attempts: 3, baseMs: 1 },
      ),
    ).rejects.toThrow("still broken");
    expect(calls).toBe(3);
  });
});
