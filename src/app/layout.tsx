import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { canClaimDaily, DAILY_CREDITS, getBalance } from "@/lib/credits";
import { SiteFooter } from "@/components/site-footer";
import { LOW_BALANCE } from "@/lib/pricing";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

const DESCRIPTION =
  "Kinora is a creative studio for AI images and video. Explore what others made, generate your own with one-tap effects or a full director's panel, and remix anything. No account needed.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Kinora — a studio for generated motion",
    template: "%s · Kinora",
  },
  description: DESCRIPTION,
  applicationName: "Kinora",
  keywords: ["AI video", "AI images", "generative video", "image to video", "Kinora"],
  openGraph: {
    title: "Kinora — a studio for generated motion",
    description: DESCRIPTION,
    siteName: "Kinora",
    type: "website",
    locale: "en",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Kinora" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kinora — a studio for generated motion",
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Guest-first: a fresh visitor already has a session and starter credits here.
  const user = await getCurrentUser();
  const [credits, claimable] = user
    ? await Promise.all([getBalance(user.id), canClaimDaily(user.id)])
    : [null, false];

  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans`}>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <div className="flex min-h-dvh flex-col">
          <SiteHeader
            credits={credits}
            claimable={claimable}
            dailyAmount={DAILY_CREDITS}
            lowAt={LOW_BALANCE}
          />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
