import "server-only";

import { and, count, eq, gte, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { creditLedger, jobs, users } from "@/db/schema";
import { ACTIVE_STATUSES } from "@/lib/jobs";

/**
 * Demo capacity limits.
 *
 * This is a public demo with a real provider bill behind it. Every limit here
 * fails loudly with a clear message — the product never invents a result to
 * hide the fact that it is out of capacity.
 */

export const MAX_ACTIVE_JOBS_PER_USER = 2;
export const MAX_GUESTS_PER_IP_PER_DAY = 8;

export function dailyCreditCap(): number {
  const raw = Number(process.env.DAILY_CREDIT_CAP);
  return Number.isFinite(raw) && raw > 0 ? raw : 5_000;
}

export type CapacityCode =
  "too_many_active_jobs" | "too_many_guests" | "daily_cap_reached" | "insufficient_credits";

export class CapacityError extends Error {
  readonly code: CapacityCode;
  readonly status: number;

  constructor(code: CapacityCode, message: string, status = 429) {
    super(message);
    this.name = "CapacityError";
    this.code = code;
    this.status = status;
  }
}

/** Salted so the table never holds anything that identifies a visitor. */
export async function hashIp(ip: string): Promise<string> {
  const salt = process.env.SESSION_SECRET ?? "kinora-dev-only-insecure-secret";
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function startOfUtcDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function countActiveJobs(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ total: count() })
    .from(jobs)
    .where(and(eq(jobs.userId, userId), inArray(jobs.status, [...ACTIVE_STATUSES])));
  return row?.total ?? 0;
}

/** Credits spent across the whole deployment since midnight UTC. */
export async function creditsSpentToday(): Promise<number> {
  const [row] = await getDb()
    .select({ spent: sql<number>`coalesce(-sum(${creditLedger.delta}), 0)::int` })
    .from(creditLedger)
    .where(and(eq(creditLedger.kind, "charge"), gte(creditLedger.createdAt, startOfUtcDay())));
  return row?.spent ?? 0;
}

async function countGuestsFromIp(ipHash: string): Promise<number> {
  const [row] = await getDb()
    .select({ total: count() })
    .from(users)
    .where(and(eq(users.signupIpHash, ipHash), gte(users.createdAt, startOfUtcDay())));
  return row?.total ?? 0;
}

/**
 * Everything that must be true before a generation is allowed to cost money.
 * Runs before the charge, never on the client's word.
 */
export async function assertCanGenerate(params: {
  userId: string;
  cost: number;
  ipHash?: string | null;
}): Promise<void> {
  const { userId, cost, ipHash } = params;

  const active = await countActiveJobs(userId);
  if (active >= MAX_ACTIVE_JOBS_PER_USER) {
    throw new CapacityError(
      "too_many_active_jobs",
      `You already have ${active} renders in flight. Wait for one to finish.`,
    );
  }

  if (ipHash) {
    const guests = await countGuestsFromIp(ipHash);
    if (guests > MAX_GUESTS_PER_IP_PER_DAY) {
      throw new CapacityError(
        "too_many_guests",
        "Too many guest sessions from this network today. Try again tomorrow.",
      );
    }
  }

  const cap = dailyCreditCap();
  const spent = await creditsSpentToday();
  if (spent + cost > cap) {
    throw new CapacityError(
      "daily_cap_reached",
      "Demo capacity reached for today. Kinora caps what the demo can spend — nothing was charged, and renders resume at midnight UTC.",
    );
  }
}

/** Everything /api/health and /status need about today's spend. */
export async function capacitySnapshot() {
  const cap = dailyCreditCap();
  const spent = await creditsSpentToday();

  return {
    cap,
    spent,
    remaining: Math.max(0, cap - spent),
    /** 0..1, for a bar that never goes past full. */
    used: cap > 0 ? Math.min(1, spent / cap) : 1,
    maxActiveJobsPerUser: MAX_ACTIVE_JOBS_PER_USER,
    maxGuestsPerIpPerDay: MAX_GUESTS_PER_IP_PER_DAY,
  };
}
