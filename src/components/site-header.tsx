"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { CreditPill } from "@/components/credits/credit-pill";
import { NAV_LINKS } from "@/lib/nav";

export function SiteHeader({
  credits,
  claimable = false,
  dailyAmount,
  lowAt,
}: {
  credits?: number | null;
  claimable?: boolean;
  dailyAmount: number;
  lowAt: number;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-14 items-center gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Kinora home">
          <Logo className="size-6" />
          <span className="text-base font-semibold tracking-tight">Kinora</span>
        </Link>

        <nav className="ml-4 hidden lg:flex lg:items-center lg:gap-1" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                isActive(link.href)
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <CreditPill
            credits={credits ?? null}
            claimable={claimable}
            dailyAmount={dailyAmount}
            lowAt={lowAt}
          />
          <Button
            size="sm"
            variant="secondary"
            className="hidden shrink-0 sm:inline-flex"
            disabled
            title="Accounts are not in this build — everything works as a guest"
          >
            Sign in
          </Button>
        </div>
      </div>

      {/* Below lg the nav becomes a scrollable strip so it survives 390px. */}
      <nav
        className="no-scrollbar -mb-px flex gap-1 overflow-x-auto border-t border-border/60 px-4 py-2 lg:hidden"
        aria-label="Primary mobile"
      >
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive(link.href) ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors",
              isActive(link.href)
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
