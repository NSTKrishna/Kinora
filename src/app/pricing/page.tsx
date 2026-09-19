import * as React from "react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { PlanCards, type PlanCard } from "@/components/credits/plan-cards";
import { getCurrentUser } from "@/lib/auth";
import {
  canClaimDaily,
  canPurchase,
  DAILY_CREDITS,
  getBalance,
  PLANS,
  STARTER_CREDITS,
} from "@/lib/credits";

export const metadata: Metadata = { title: "Pricing" };

export default async function PricingPage() {
  const user = await getCurrentUser();

  const [balance, claimable, proOpen, maxOpen] = user
    ? await Promise.all([
        getBalance(user.id),
        canClaimDaily(user.id),
        canPurchase(user.id, "pro"),
        canPurchase(user.id, "max"),
      ])
    : [null, false, false, false];

  const plans: PlanCard[] = [
    {
      id: "free",
      name: PLANS.free.name,
      price: PLANS.free.price,
      note: "No account, no card",
      credits: `${STARTER_CREDITS} to start · ${DAILY_CREDITS} a day`,
      features: [
        "Image and video generation",
        "Effects and Cinema",
        "Library and characters",
        "Publish to Explore",
      ],
      featured: false,
      action: "claim",
      available: Boolean(user) && claimable,
      grant: DAILY_CREDITS,
    },
    {
      id: "pro",
      name: PLANS.pro.name,
      price: PLANS.pro.price,
      note: "per month, if this were real",
      credits: `${PLANS.pro.credits} credits`,
      features: [
        "Everything in Free",
        "Reference-image models",
        "Longer clips at higher resolution",
        "Enough for a full Cinema sequence",
      ],
      featured: true,
      action: "purchase",
      available: Boolean(user) && proOpen,
      grant: PLANS.pro.credits,
    },
    {
      id: "max",
      name: PLANS.max.name,
      price: PLANS.max.price,
      note: "per month, if this were real",
      credits: `${PLANS.max.credits} credits`,
      features: [
        "Everything in Pro",
        "Multi-reference characters throughout",
        "Room to iterate on a whole shot list",
        "Bulk export",
      ],
      featured: false,
      action: "purchase",
      available: Boolean(user) && maxOpen,
      grant: PLANS.max.credits,
    },
  ];

  return (
    <div className="container py-8">
      <PageHeader
        eyebrow="Credits"
        title="Pricing"
        description={`Every render is charged against a real ledger: 2 credits for a standard still, 20 for a six-second clip. ${
          balance === null ? "" : `You have ${balance}.`
        }`}
      />

      <div className="mt-6 rounded-md border border-border bg-secondary/40 p-4 text-sm">
        <p className="font-medium">No payment provider is connected.</p>
        <p className="mt-1 text-muted-foreground">
          These plans are a demo. &ldquo;Upgrade&rdquo; writes credits straight to your balance and
          nothing is charged — there is no card form, and there is nothing to cancel. Each top-up is
          available once per day.
        </p>
      </div>

      <PlanCards plans={plans} />

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="surface p-5">
          <h2 className="text-sm font-medium">What a render costs</h2>
          <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-y-1.5 text-xs">
            {[
              ["Standard still (1024²)", "2"],
              ["Four widescreen frames", "4"],
              ["Reference-image still", "12"],
              ["Six-second clip at 1080p", "20"],
              ["Ten-second clip at 1080p", "33"],
              ["One effect", "20"],
            ].map(([label, cost]) => (
              <React.Fragment key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right tabular-nums">{cost}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>

        <div className="surface p-5">
          <h2 className="text-sm font-medium">How the ledger works</h2>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Your balance is not a number we store — it is the sum of every entry ever written for
            you. Credits are taken before a render is sent to the provider, and a render that fails,
            is refused or is cancelled is refunded exactly once. That is why a failed render never
            costs anything, and why the number in the header is always the truth.
          </p>
        </div>
      </div>
    </div>
  );
}
