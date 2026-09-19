import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { closeDb } from "@/db";
import {
  InsufficientCreditsError,
  charge,
  getBalance,
  grantDaily,
  grantStarter,
  refund,
  STARTER_CREDITS,
} from "@/lib/credits";
import { createTestUser, deleteTestUser, requireTestDatabase } from "./helpers";

describe("credit ledger", () => {
  const created: string[] = [];

  async function newUserWithCredits(amount = STARTER_CREDITS) {
    const userId = await createTestUser();
    created.push(userId);
    await grantStarter(userId, amount);
    return userId;
  }

  beforeAll(() => {
    requireTestDatabase();
  });

  afterEach(async () => {
    await Promise.all(created.splice(0).map(deleteTestUser));
  });

  afterAll(async () => {
    await closeDb();
  });

  it("grants starter credits exactly once", async () => {
    const userId = await newUserWithCredits();
    expect(await getBalance(userId)).toBe(STARTER_CREDITS);

    await grantStarter(userId);
    expect(await getBalance(userId)).toBe(STARTER_CREDITS);
  });

  it("charges and leaves the balance reduced", async () => {
    const userId = await newUserWithCredits();

    const balance = await charge({ userId, jobId: randomUUID(), cost: 6 });

    expect(balance).toBe(STARTER_CREDITS - 6);
    expect(await getBalance(userId)).toBe(STARTER_CREDITS - 6);
  });

  it("rejects a charge that exceeds the balance and writes nothing", async () => {
    const userId = await newUserWithCredits(5);

    await expect(charge({ userId, jobId: randomUUID(), cost: 6 })).rejects.toBeInstanceOf(
      InsufficientCreditsError,
    );

    expect(await getBalance(userId)).toBe(5);
  });

  it("treats a repeated charge for the same job as a no-op", async () => {
    const userId = await newUserWithCredits();
    const jobId = randomUUID();

    await charge({ userId, jobId, cost: 6 });
    await charge({ userId, jobId, cost: 6 });

    expect(await getBalance(userId)).toBe(STARTER_CREDITS - 6);
  });

  it("refunds a job once, and a second refund is a no-op", async () => {
    const userId = await newUserWithCredits();
    const jobId = randomUUID();

    await charge({ userId, jobId, cost: 6 });
    await refund({ userId, jobId, amount: 6 });
    await refund({ userId, jobId, amount: 6 });

    expect(await getBalance(userId)).toBe(STARTER_CREDITS);
  });

  it("cannot be overdrawn by concurrent charges", async () => {
    // 30 credits, four simultaneous 10-credit jobs: three may pass, never four.
    const userId = await newUserWithCredits(30);

    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => charge({ userId, jobId: randomUUID(), cost: 10 })),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(3);
    expect(rejected).toHaveLength(1);
    for (const failure of rejected) {
      expect((failure as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientCreditsError);
    }

    const balance = await getBalance(userId);
    expect(balance).toBe(0);
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  it("grants daily credits once per day", async () => {
    const userId = await newUserWithCredits();
    const date = new Date("2026-01-02T09:00:00Z");

    await grantDaily(userId, { amount: 15, date });
    await grantDaily(userId, { amount: 15, date: new Date("2026-01-02T23:59:00Z") });
    expect(await getBalance(userId)).toBe(STARTER_CREDITS + 15);

    await grantDaily(userId, { amount: 15, date: new Date("2026-01-03T00:01:00Z") });
    expect(await getBalance(userId)).toBe(STARTER_CREDITS + 30);
  });
});
