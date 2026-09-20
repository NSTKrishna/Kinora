import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { capacitySnapshot } from "@/lib/guards";
import { countPlaceholderFallbacks, countStuckJobs, STUCK_AFTER_MS } from "@/lib/jobs";
import { providerRouting } from "@/lib/providers";

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
      { ok: false, database: "unconfigured", providers: providerRouting() },
      { status: 503 },
    );
  }

  try {
    await getDb().execute(sql`select 1`);
    const routing = providerRouting();
    const [capacity, stuck, fallbacks] = await Promise.all([
      capacitySnapshot(),
      countStuckJobs(),
      // Only meaningful in hybrid mode; in mock mode every job is a mock and
      // the number would say nothing.
      routing.fallback === "mock" ? countPlaceholderFallbacks() : Promise.resolve(0),
    ]);

    return NextResponse.json({
      ok: capacity.remaining > 0,
      database: "ok",
      providers: routing,
      uploads: isCloudinaryConfigured() ? "cloudinary" : "unconfigured",
      capacity,
      jobs: {
        stuck,
        stuckAfterMinutes: STUCK_AFTER_MS / 60_000,
        // A monitor can alert on this: a non-zero count means a real provider
        // has been refusing us and renders are quietly degraded.
        placeholderFallbacks24h: fallbacks,
      },
      latencyMs: Date.now() - started,
    });
  } catch (error) {
    console.error("[kinora] health check failed", error);
    return NextResponse.json(
      { ok: false, database: "unreachable", providers: providerRouting() },
      { status: 503 },
    );
  }
}
