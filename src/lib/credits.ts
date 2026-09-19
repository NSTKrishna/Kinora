import { and, eq, sql } from "drizzle-orm";

import { getDb, type Database } from "@/db";
import { creditLedger, users } from "@/db/schema";

/** Credits a brand-new guest starts with. */
export const STARTER_CREDITS = 30;
/** Credits handed out on each new day a user comes back. */
export const DAILY_CREDITS = 15;

export class InsufficientCreditsError extends Error {
  readonly balance: number;
  readonly required: number;

  constructor(balance: number, required: number) {
    super(`Insufficient credits: balance ${balance}, required ${required}`);
    this.name = "InsufficientCreditsError";
    this.balance = balance;
    this.required = required;
  }
}

type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Balance is always derived — SUM(delta) over the append-only ledger. */
export async function getBalance(userId: string, tx?: Executor): Promise<number> {
  const db = tx ?? getDb();
  const [row] = await db
    .select({ balance: sql<number>`coalesce(sum(${creditLedger.delta}), 0)::int` })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId));
  return row?.balance ?? 0;
}

async function hasEntry(tx: Executor, userId: string, key: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: creditLedger.id })
    .from(creditLedger)
    .where(and(eq(creditLedger.userId, userId), eq(creditLedger.idempotencyKey, key)))
    .limit(1);
  return Boolean(row);
}

/**
 * Write one ledger entry under a lock on the user row.
 *
 * Locking the user (rather than relying on the unique key alone) is what makes
 * concurrent charges safe: two requests cannot both read the same balance and
 * both decide they can afford it.
 */
async function append(
  userId: string,
  entry: {
    delta: number;
    kind: (typeof creditLedger.$inferInsert)["kind"];
    idempotencyKey: string;
    jobId?: string | null;
    note?: string | null;
  },
  options: { requireFunds?: number } = {},
): Promise<number> {
  const db = getDb();

  return db.transaction(async (tx) => {
    // Serialises every credit write for this user.
    const [locked] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .for("update");

    if (!locked) throw new Error(`Unknown user: ${userId}`);

    // Replay of an entry we already wrote: return the balance, change nothing.
    if (await hasEntry(tx, userId, entry.idempotencyKey)) {
      return getBalance(userId, tx);
    }

    const balance = await getBalance(userId, tx);
    if (options.requireFunds !== undefined && balance < options.requireFunds) {
      throw new InsufficientCreditsError(balance, options.requireFunds);
    }

    await tx.insert(creditLedger).values({
      userId,
      delta: entry.delta,
      kind: entry.kind,
      jobId: entry.jobId ?? null,
      idempotencyKey: entry.idempotencyKey,
      note: entry.note ?? null,
    });

    return balance + entry.delta;
  });
}

/**
 * Take `cost` credits for a job. Throws InsufficientCreditsError rather than
 * letting a balance go negative. Safe to retry — one charge per job id.
 */
export async function charge(params: {
  userId: string;
  jobId: string;
  cost: number;
  note?: string;
}): Promise<number> {
  const { userId, jobId, cost, note } = params;
  if (cost < 0) throw new Error("charge cost must be >= 0");

  return append(
    userId,
    {
      delta: -cost,
      kind: "charge",
      idempotencyKey: `job:${jobId}:charge`,
      jobId,
      note: note ?? null,
    },
    { requireFunds: cost },
  );
}

/** Give a job's credits back. A second call for the same job is a no-op. */
export async function refund(params: {
  userId: string;
  jobId: string;
  amount: number;
  note?: string;
}): Promise<number> {
  const { userId, jobId, amount, note } = params;
  if (amount < 0) throw new Error("refund amount must be >= 0");

  return append(userId, {
    delta: amount,
    kind: "refund",
    idempotencyKey: `job:${jobId}:refund`,
    jobId,
    note: note ?? null,
  });
}

/** The one-off grant a guest gets on their first visit. */
export async function grantStarter(userId: string, amount = STARTER_CREDITS): Promise<number> {
  return append(userId, {
    delta: amount,
    kind: "grant",
    idempotencyKey: `grant:${userId}:starter`,
    note: "Welcome to Kinora",
  });
}

/** Tops a user up once per UTC day. Calling it on every visit is fine. */
export async function grantDaily(
  userId: string,
  options: { amount?: number; date?: Date } = {},
): Promise<number> {
  const { amount = DAILY_CREDITS, date = new Date() } = options;
  const day = date.toISOString().slice(0, 10);

  return append(userId, {
    delta: amount,
    kind: "daily_grant",
    idempotencyKey: `daily:${userId}:${day}`,
    note: `Daily credits for ${day}`,
  });
}
