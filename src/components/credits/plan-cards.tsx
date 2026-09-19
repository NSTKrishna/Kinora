"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Gift, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type PlanCard = {
  id: string;
  name: string;
  price: string;
  note: string;
  credits: string;
  features: string[];
  featured: boolean;
  /** Free is the plan everyone is already on; the others top up on demand. */
  action: "claim" | "purchase" | null;
  available: boolean;
  grant: number;
};

/**
 * Demo billing.
 *
 * Upgrade writes a `purchase` row to the same ledger every render is charged
 * against — no payment provider is connected, and the button says so. The
 * top-up is keyed per plan per day, so a double-click cannot buy twice.
 */
export function PlanCards({ plans }: { plans: PlanCard[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const run = async (plan: PlanCard) => {
    setBusy(plan.id);
    setMessage(null);

    try {
      const response = await fetch("/api/credits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          plan.action === "claim" ? { action: "claim" } : { action: "purchase", plan: plan.id },
        ),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data?.error?.message ?? "That did not go through.");
        return;
      }

      setMessage(
        data.granted > 0
          ? `${data.granted} credits added. Balance: ${data.balance}.`
          : (data.message ?? "Nothing to add right now."),
      );
      router.refresh();
    } catch {
      setMessage("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              "surface flex flex-col gap-5 p-6",
              plan.featured && "glow-ember border-primary/40",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-medium">{plan.name}</h2>
                <p className="text-xs text-muted-foreground">{plan.note}</p>
              </div>
              <Badge variant={plan.featured ? "default" : "outline"}>Demo billing</Badge>
            </div>

            <p className="text-3xl font-semibold tracking-tight">{plan.price}</p>
            <p className="text-sm text-primary">{plan.credits}</p>

            <ul className="flex flex-1 flex-col gap-2 text-sm text-muted-foreground">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>

            <Button
              variant={plan.featured ? "default" : "outline"}
              className="w-full"
              disabled={!plan.action || !plan.available || busy !== null}
              onClick={() => void run(plan)}
            >
              {busy === plan.id ? <Loader2 className="animate-spin" /> : <Gift />}
              {!plan.action
                ? "You're on this"
                : !plan.available
                  ? "Taken today"
                  : plan.action === "claim"
                    ? `Claim ${plan.grant} credits`
                    : `Add ${plan.grant} credits`}
            </Button>
          </div>
        ))}
      </div>

      {message ? (
        <p role="status" className="mt-4 text-sm text-primary">
          {message}
        </p>
      ) : null}
    </>
  );
}
