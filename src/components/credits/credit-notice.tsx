"use client";

import Link from "next/link";
import { Coins, Gift } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LOW_BALANCE } from "@/lib/pricing";

/**
 * What to say when a render is about to be unaffordable.
 *
 * Three states, and each one ends in something to do: enough, running low, and
 * out. "Out of credits" with no next step is the worst screen in a demo — the
 * visitor assumes it is broken rather than that it is metered.
 */
export function CreditNotice({
  balance,
  cost,
  className,
}: {
  balance: number | null;
  cost: number | null;
  className?: string;
}) {
  if (balance === null) return null;

  const short = cost !== null && balance < cost;
  const low = !short && balance <= LOW_BALANCE;
  if (!short && !low) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-2 rounded-md border p-3 text-xs",
        short ? "border-destructive/30 bg-destructive/[0.06]" : "border-border bg-secondary/40",
        className,
      )}
    >
      <p className="flex items-start gap-2">
        <Coins
          className={cn("mt-0.5 size-3.5 shrink-0", short ? "text-destructive" : "text-primary")}
        />
        <span>
          {short ? (
            <>
              This render costs {cost} and you have {balance}.
            </>
          ) : (
            <>You have {balance} credits left — about one more clip.</>
          )}
        </span>
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={short ? "default" : "outline"} asChild>
          <Link href="/pricing">
            <Gift />
            Get more credits
          </Link>
        </Button>
      </div>
    </div>
  );
}
