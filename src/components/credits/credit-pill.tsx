"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Coins, Gift, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The credit pill, and the daily claim beside it.
 *
 * The claim is a button rather than something that happens on page load: free
 * credits arriving silently teaches nobody that renders cost anything, and a
 * balance that changes without being asked looks like a bug.
 */
export function CreditPill({
  credits,
  claimable,
  dailyAmount,
  lowAt,
}: {
  credits: number | null;
  claimable: boolean;
  dailyAmount: number;
  /** At or below this, the pill starts warning. */
  lowAt: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const claim = async () => {
    setBusy(true);
    try {
      await fetch("/api/credits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "claim" }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const empty = credits !== null && credits <= 0;
  const low = credits !== null && credits > 0 && credits <= lowAt;

  return (
    <div className="flex items-center gap-1.5">
      {claimable ? (
        <button
          type="button"
          onClick={() => void claim()}
          disabled={busy}
          className="flex shrink-0 items-center gap-1.5 rounded-sm border border-primary/40 bg-primary/[0.08] px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/[0.14] disabled:opacity-60"
          title={`Claim ${dailyAmount} free credits for today`}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Gift className="size-3.5" />}
          <span className="hidden sm:inline">Claim {dailyAmount}</span>
          <span className="sm:hidden">+{dailyAmount}</span>
        </button>
      ) : null}

      <Link
        href="/pricing"
        className={cn(
          "flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-xs font-medium tabular-nums transition-colors",
          empty
            ? "border-destructive/50 bg-destructive/[0.08] text-destructive"
            : low
              ? "border-primary/40 bg-primary/[0.06]"
              : "border-border bg-secondary/60 hover:border-primary/50",
        )}
        title={empty ? "You are out of credits" : "Credits remaining"}
      >
        <Coins className={cn("size-3.5", empty ? "text-destructive" : "text-primary")} />
        <span>{credits ?? "—"}</span>
        <span className="hidden text-muted-foreground sm:inline">credits</span>
      </Link>
    </div>
  );
}
