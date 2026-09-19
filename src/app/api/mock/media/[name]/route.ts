import type { NextRequest } from "next/server";

/**
 * Sample output for the mock provider — generated here, by us, from a seed.
 * No third-party media ships with Kinora, and development stays free.
 */
export const runtime = "edge";

const PALETTES = [
  ["#1b0a14", "#8c1f4b", "#ff7a2f"],
  ["#0b1020", "#2d3f73", "#8fb8ff"],
  ["#241405", "#a85b1f", "#ffd9a0"],
  ["#060d0b", "#1f4c40", "#7fd8b4"],
  ["#2b1055", "#7f2b8e", "#ff6a3d"],
  ["#0a0a0c", "#3a3a45", "#cfd4dd"],
];

function hash(value: string): number {
  let out = 0;
  for (let i = 0; i < value.length; i += 1) out = (out * 31 + value.charCodeAt(i)) >>> 0;
  return out;
}

export async function GET(request: NextRequest, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  const seed = hash(name);
  const [a, b, c] = PALETTES[seed % PALETTES.length];

  const width = Number(request.nextUrl.searchParams.get("w")) || 1024;
  const height = Number(request.nextUrl.searchParams.get("h")) || 1024;
  const angle = seed % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0%" stop-color="${a}"/>
      <stop offset="55%" stop-color="${b}"/>
      <stop offset="100%" stop-color="${c}"/>
    </linearGradient>
    <radialGradient id="r" cx="${30 + (seed % 40)}%" cy="${25 + (seed % 50)}%">
      <stop offset="0%" stop-color="${c}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
    </radialGradient>
    <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3"/></filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#r)"/>
  <rect width="100%" height="100%" filter="url(#n)" opacity="0.18"/>
</svg>`;

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
