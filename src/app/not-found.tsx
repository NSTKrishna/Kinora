import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clapperboard, Compass, ImagePlus, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NAV_LINKS } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/**
 * A 404 that is still a way in.
 *
 * Someone who mistypes a URL has not stopped wanting to make something, so
 * this offers the three things they most likely came for rather than a dead
 * end with a back button.
 */
export default function NotFound() {
  const shortcuts = [
    { href: "/effects", label: "Try an effect", hint: "One photo, one tap", icon: <Wand2 /> },
    {
      href: "/image",
      label: "Generate an image",
      hint: "A prompt and a model",
      icon: <ImagePlus />,
    },
    { href: "/cinema", label: "Open Cinema", hint: "The director's panel", icon: <Clapperboard /> },
  ];

  return (
    <div className="container flex flex-col items-start gap-8 py-20 sm:py-28">
      <div className="flex flex-col gap-3">
        <p className="eyebrow flex items-center gap-2">
          <Compass className="size-3.5" />
          404
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          That page isn&apos;t here.
        </h1>
        <p className="max-w-md text-pretty text-sm text-muted-foreground">
          The link may be old, or the render it pointed at may have been deleted. Everything else
          still works — you are signed in as a guest and your credits are intact.
        </p>
      </div>

      <div className="grid w-full gap-3 sm:grid-cols-3">
        {shortcuts.map((shortcut) => (
          <Link
            key={shortcut.href}
            href={shortcut.href}
            className="surface group flex items-center gap-3 p-4 transition-colors hover:border-primary/40"
          >
            <span className="text-primary [&_svg]:size-5">{shortcut.icon}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{shortcut.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{shortcut.hint}</span>
            </span>
            <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link href="/">Back to Explore</Link>
        </Button>
        <nav aria-label="All pages" className="flex flex-wrap gap-x-4 gap-y-1">
          {NAV_LINKS.filter((link) => link.href !== "/").map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
