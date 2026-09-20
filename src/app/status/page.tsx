import type { Metadata } from "next";
import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2, Database, Server } from "lucide-react";

import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { isDatabaseConfigured } from "@/db";
import { capacitySnapshot } from "@/lib/guards";
import { countStuckJobs, STUCK_AFTER_MS } from "@/lib/jobs";
import { providerName } from "@/lib/providers";
import { DAILY_CREDITS, STARTER_CREDITS } from "@/lib/credits";

export const metadata: Metadata = {
  title: "Status",
  description: "Today's demo capacity, provider and limits.",
};

export const dynamic = "force-dynamic";

/**
 * What the demo is spending, in public.
 *
 * This page exists because the honest failure mode of a metered demo is
 * "capacity reached", and a visitor who hits that deserves to see it is a cap
 * rather than a bug.
 */
export default async function StatusPage() {
  const configured = isDatabaseConfigured();

  const [capacity, stuck] = configured
    ? await Promise.all([capacitySnapshot().catch(() => null), countStuckJobs().catch(() => 0)])
    : [null, 0];

  const healthy = Boolean(capacity && capacity.remaining > 0);

  return (
    <div className="container py-8">
      <PageHeader
        eyebrow="Operations"
        title="Status"
        description="Kinora is a demo with a real provider bill behind it, so it caps what it can spend in a day. This is that cap, live."
        actions={
          <Button asChild variant="outline">
            <Link href="/api/health">Raw health JSON</Link>
          </Button>
        }
      />

      <div
        className={cn(
          "mt-8 flex items-start gap-3 rounded-lg border p-4",
          healthy
            ? "border-emerald-500/30 bg-emerald-500/[0.06]"
            : "border-primary/40 bg-primary/[0.06]",
        )}
      >
        {healthy ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
        ) : (
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-primary" />
        )}
        <div>
          <p className="text-sm font-medium">
            {!configured
              ? "Database not configured"
              : !capacity
                ? "Database unreachable"
                : healthy
                  ? "Generating normally"
                  : "Demo capacity reached for today"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {healthy
              ? "Renders are running. Nothing here is queued behind anyone else."
              : "New renders are refused until midnight UTC. Nothing is charged, and no fake results are produced."}
          </p>
        </div>
      </div>

      {capacity ? (
        <div className="surface mt-6 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">Today&apos;s spend</h2>
            <p className="text-xs tabular-nums text-muted-foreground">
              {capacity.spent} / {capacity.cap} credits
            </p>
          </div>

          <div
            className="mt-3 h-2 w-full overflow-hidden rounded-sm bg-secondary"
            role="progressbar"
            aria-valuenow={capacity.spent}
            aria-valuemin={0}
            aria-valuemax={capacity.cap}
            aria-label="Credits spent today against the daily cap"
          >
            <div
              className={cn(
                "h-full rounded-sm transition-[width]",
                capacity.used > 0.9 ? "bg-destructive" : "bg-primary",
              )}
              style={{ width: `${Math.round(capacity.used * 100)}%` }}
            />
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {capacity.remaining} credits left today. Resets at midnight UTC.
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="surface p-5">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Server className="size-4 text-muted-foreground" />
            Configuration
          </h2>
          <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-y-1.5 text-xs">
            <Row label="Provider" value={providerName()} />
            <Row
              label="Database"
              value={configured ? (capacity ? "reachable" : "unreachable") : "unconfigured"}
            />
            <Row
              label="Uploads"
              value={process.env.BLOB_READ_WRITE_TOKEN ? "configured" : "paste a URL instead"}
            />
          </dl>
          {providerName() === "mock" ? (
            <p className="mt-3 text-xs text-muted-foreground">
              The mock provider returns Kinora&apos;s own sample media after a short delay. Nothing
              is sent to a paid API and nothing is charged.
            </p>
          ) : null}
        </div>

        <div className="surface p-5">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Activity className="size-4 text-muted-foreground" />
            Limits
          </h2>
          <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-y-1.5 text-xs">
            <Row
              label="Renders at once, per visitor"
              value={String(capacity?.maxActiveJobsPerUser ?? "—")}
            />
            <Row
              label="New guests per network per day"
              value={String(capacity?.maxGuestsPerIpPerDay ?? "—")}
            />
            <Row label="Starter credits" value={String(STARTER_CREDITS)} />
            <Row label="Daily claim" value={String(DAILY_CREDITS)} />
            <Row label="Abandoned after" value={`${STUCK_AFTER_MS / 60_000} min`} />
            <Row label="Stuck right now" value={String(stuck)} />
          </dl>
        </div>
      </div>

      <div className="surface mt-6 flex items-start gap-3 p-5">
        <Database className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Credits are taken before anything reaches a provider, and a render that fails, is refused,
          is cancelled or is abandoned is refunded exactly once. When the cap is reached the app
          says so and refuses the render — it never invents a result to hide it.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </>
  );
}
