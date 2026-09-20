import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    /**
     * Every host that can hold an image we render: Cloudinary (uploads and
     * Workers AI stills), fal (video posters and its own image output), and
     * Vercel Blob for anything recorded before the move to Cloudinary. Seed
     * media is local and needs no entry.
     *
     * SVG is deliberately NOT allowed: the mock provider serves it, and
     * `dangerouslyAllowSVG` would turn the optimizer into an SVG proxy for any
     * host listed here. AssetMedia renders those through a plain `img`.
     */
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "*.fal.media" },
      { protocol: "https", hostname: "fal.media" },
    ],
  },
};

export default nextConfig;
