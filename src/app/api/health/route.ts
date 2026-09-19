import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { capacitySnapshot } from "@/lib/guards";
import { countStuckJobs, STUCK_AFTER_MS } from "@/lib/jobs";
import { providerName } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One request that answers "is this deployment actually working, and is it
 * about to cost me money".
 *
 * Deliberately says nothing about any user: no ids, no prompts, no balances.
 * It is safe to leave open, which is the point — a health check behind auth is
 * a health check nobody runs.
 */
export async function GET() {
  const started = Date.now();

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { ok: false, database: "unconfigured", provider: providerName() },
      { status: 503 },
    );
  }

  try {
    await getDb().execute(sql`select 1`);
    const [capacity, stuck] = await Promise.all([capacitySnapshot(), countStuckJobs()]);

    return NextResponse.json({
      ok: capacity.remaining > 0,
      database: "ok",
      provider: providerName(),
      uploads: process.env.BLOB_READ_WRITE_TOKEN ? "configured" : "unconfigured",
      capacity,
      jobs: { stuck, stuckAfterMinutes: STUCK_AFTER_MS / 60_000 },
      latencyMs: Date.now() - started,
    });
  } catch (error) {
    console.error("[kinora] health check failed", error);
    return NextResponse.json(
      { ok: false, database: "unreachable", provider: providerName() },
      { status: 503 },
    );
  }
}
