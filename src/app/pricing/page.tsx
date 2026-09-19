import type { Metadata } from "next";
import { Check } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pricing" };

const PLANS = [
  {
    name: "Guest",
    price: "Free",
    note: "No account, no card",
    credits: "40 credits",
    features: [
      "Image + video generation",
      "Library kept on this device",
      "Remix anything on Explore",
    ],
    cta: "You're on this",
    featured: false,
  },
  {
    name: "Creator",
    price: "$12",
    note: "per month",
    credits: "1,200 credits / month",
    features: ["Everything in Guest", "Effects presets", "Cinema sequences", "Priority queue"],
    cta: "Choose Creator",
    featured: true,
  },
  {
    name: "Studio",
    price: "$39",
    note: "per month",
    credits: "5,000 credits / month",
    features: ["Everything in Creator", "Longer clips", "Reference characters", "Bulk export"],
    cta: "Choose Studio",
    featured: false,
  },
];

export default function PricingPage() {
  return (
    <div className="container py-8">
      <PageHeader
        eyebrow="Credits"
        title="Pricing"
        description="Every render costs credits — 1 for a still, 6 for a clip. Plans are a demo in this build; nothing is charged."
      />

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={cn(
              "surface flex flex-col gap-5 p-6",
              plan.featured && "glow-ember border-primary/40",
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-medium">{plan.name}</h2>
                <p className="text-xs text-muted-foreground">{plan.note}</p>
              </div>
              {plan.featured ? <Badge>Popular</Badge> : null}
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

            <Button variant={plan.featured ? "default" : "outline"} className="w-full">
              {plan.cta}
            </Button>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Demo billing only — no payment provider is connected in this build.
      </p>
    </div>
  );
}
