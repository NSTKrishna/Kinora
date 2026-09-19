import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { getBalance } from "@/lib/credits";
import { SiteFooter } from "@/components/site-footer";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Kinora — a studio for generated motion",
    template: "%s · Kinora",
  },
  description:
    "Kinora is a creative studio for AI images and video. Explore what others made, generate your own, remix anything.",
  openGraph: {
    title: "Kinora — a studio for generated motion",
    description: "Explore, generate and remix AI images and video.",
    siteName: "Kinora",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Guest-first: a fresh visitor already has a session and starter credits here.
  const user = await getCurrentUser();
  const credits = user ? await getBalance(user.id) : null;

  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans`}>
        <div className="flex min-h-dvh flex-col">
          <SiteHeader credits={credits} />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
